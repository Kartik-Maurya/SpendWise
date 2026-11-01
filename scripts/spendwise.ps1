[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'restart', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$RunDir = Join-Path $Root '.run'
$PidFile = Join-Path $RunDir 'processes.json'
$ProjectPrefix = $Root.TrimEnd('\') + '\'
$Ports = @(3000, 5000)

function Write-Step($message) {
  Write-Host $message -ForegroundColor Cyan
}

function Write-Ok($message) {
  Write-Host "  [ok] $message" -ForegroundColor Green
}

function Write-Warn($message) {
  Write-Host "  [!] $message" -ForegroundColor Yellow
}

function Stop-ProcessTree([int]$targetId) {
  & cmd.exe /c "taskkill /PID $targetId /T /F >nul 2>&1"
}

function Get-ExcludedIds {
  $ids = @([int]$PID)
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction SilentlyContinue
  $depth = 0
  while ($current -and $current.ParentProcessId -and $depth -lt 10) {
    $parentId = [int]$current.ParentProcessId
    $ids += $parentId
    $current = Get-CimInstance Win32_Process -Filter "ProcessId=$parentId" -ErrorAction SilentlyContinue
    $depth++
  }
  return $ids
}

function Test-ProjectCommand($commandLine) {
  return $commandLine -and $commandLine.IndexOf($ProjectPrefix, [StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Get-ProjectProcesses {
  $excluded = Get-ExcludedIds
  $found = @{}

  Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'" | ForEach-Object {
    if ($excluded -contains [int]$_.ProcessId) { return }
    if (Test-ProjectCommand ([string]$_.CommandLine)) {
      $found[[int]$_.ProcessId] = $_
    }
  }

  foreach ($port in $Ports) {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    foreach ($listener in $listeners) {
      $ownerId = [int]$listener.OwningProcess
      if ($excluded -contains $ownerId -or $found.ContainsKey($ownerId)) { continue }

      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId" -ErrorAction SilentlyContinue
      if (-not $proc) { continue }

      $commandLine = [string]$proc.CommandLine
      $isProject =
        (Test-ProjectCommand $commandLine) -or
        ($port -eq 5000 -and $commandLine -match 'server\.js') -or
        ($port -eq 3000 -and $commandLine -match 'vite')

      if ($isProject) {
        $found[$ownerId] = $proc
      } else {
        Write-Warn "Port $port is held by another program (PID $ownerId, $($proc.Name)); left untouched."
      }
    }
  }

  return @($found.Values)
}

function Get-BusyPorts {
  $busy = @()
  foreach ($port in $Ports) {
    if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
      $busy += $port
    }
  }
  return $busy
}

function Test-WebUi {
  foreach ($url in @('http://localhost:3000/', 'http://[::1]:3000/', 'http://127.0.0.1:3000/')) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{ Accept = '*/*' } -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return $true }
    } catch {}
  }
  return $false
}

function Wait-UntilReady($api, $web) {
  $deadline = (Get-Date).AddSeconds(45)
  $apiReady = $false
  $webReady = $false

  while ((Get-Date) -lt $deadline -and (-not $apiReady -or -not $webReady)) {
    Start-Sleep -Milliseconds 750
    if (-not $apiReady -and $api) {
      try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5000/api/health' -TimeoutSec 2
        $apiReady = $response.StatusCode -eq 200
      } catch {}
    }
    if (-not $webReady -and $web) {
      $webReady = Test-WebUi
    }
  }

  return @{ Api = $apiReady; Web = $webReady }
}

function Stop-SpendWise {
  Write-Step 'Stopping SpendWise...'
  $stopped = @{}

  if (Test-Path $PidFile) {
    try {
      $saved = Get-Content $PidFile -Raw | ConvertFrom-Json
      foreach ($entry in @($saved.backend, $saved.frontend)) {
        if ($entry -and $entry.pid) {
          $savedPid = [int]$entry.pid
          if (Get-Process -Id $savedPid -ErrorAction SilentlyContinue) {
            Stop-ProcessTree $savedPid
            $stopped[$savedPid] = "saved window PID $savedPid"
          }
        }
      }
    } catch {
      Write-Warn "Could not read $PidFile; falling back to process matching."
    }
  }

  $processes = @(Get-ProjectProcesses)
  foreach ($proc in $processes) {
    $targetId = [int]$proc.ProcessId
    if ($stopped.ContainsKey($targetId)) { continue }
    if (-not (Get-Process -Id $targetId -ErrorAction SilentlyContinue)) { continue }
    Stop-ProcessTree $targetId
    $stopped[$targetId] = "PID $targetId ($($proc.Name))"
  }

  Start-Sleep -Milliseconds 800

  foreach ($port in $Ports) {
    $listener = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    if ($listener.Count -gt 0) {
      Write-Warn "Port $port is still in use by PID $($listener[0].OwningProcess)."
    } else {
      Write-Ok "Port $port is free"
    }
  }

  if (Test-Path $PidFile) { Remove-Item $PidFile -Force }

  if ($stopped.Count -eq 0) {
    Write-Host '  Nothing was running.'
  } else {
    foreach ($message in $stopped.Values) { Write-Ok "Stopped $message" }
  }
}

function Start-SpendWise {
  $busy = Get-BusyPorts
  if ($busy.Count -gt 0) {
    Write-Warn "Ports already in use: $($busy -join ', ')."
    Write-Host '  Run stop.bat first if these are leftovers from SpendWise.'
    return $false
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Warn 'Node.js is not installed or not on PATH.'
    return $false
  }
  if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    Write-Warn 'npm is not installed or not on PATH.'
    return $false
  }
  if (-not (Test-Path (Join-Path $Root 'server\node_modules'))) {
    Write-Warn 'Server dependencies are missing. Run: npm run install-all'
    return $false
  }
  if (-not (Test-Path (Join-Path $Root 'client\node_modules'))) {
    Write-Warn 'Client dependencies are missing. Run: npm run install-all'
    return $false
  }

  New-Item -ItemType Directory -Force -Path $RunDir | Out-Null

  Write-Step 'Starting backend on port 5000...'
  $backend = Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'npm start' `
    -WorkingDirectory (Join-Path $Root 'server') -PassThru

  Write-Step 'Starting frontend on port 3000...'
  $frontend = Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'npm run dev' `
    -WorkingDirectory (Join-Path $Root 'client') -PassThru

  @{
    backend  = @{ pid = $backend.Id }
    frontend = @{ pid = $frontend.Id }
  } | ConvertTo-Json -Depth 3 | Set-Content -Encoding ASCII -Path $PidFile

  Write-Host '  Waiting for both services to respond...'
  $ready = Wait-UntilReady $true $true

  if ($ready.Api) {
    Write-Ok 'API is responding on http://localhost:5000'
  } else {
    Write-Warn 'API did not respond within 45 seconds; check the backend window.'
  }
  if ($ready.Web) {
    Write-Ok 'Web UI is responding on http://localhost:3000'
  } else {
    Write-Warn 'Web UI did not respond within 45 seconds; check the frontend window.'
  }

  return ($ready.Api -and $ready.Web)
}

function Show-Status {
  Write-Step 'SpendWise status'

  foreach ($port in $Ports) {
    $listener = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    if ($listener.Count -gt 0) {
      $ownerId = $listener[0].OwningProcess
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId" -ErrorAction SilentlyContinue
      Write-Host "  Port ${port}: listening (PID $ownerId, $($proc.Name))"
    } else {
      Write-Host "  Port ${port}: not listening"
    }
  }

  try {
    $health = Invoke-RestMethod -Uri 'http://localhost:5000/api/health' -TimeoutSec 2
    Write-Ok "API: $($health.status) - $($health.service)"
  } catch {
    Write-Warn 'API is not responding'
  }

  if (Test-WebUi) {
    Write-Ok 'Web UI is responding'
  } else {
    Write-Warn 'Web UI is not responding'
  }

  $processes = @(Get-ProjectProcesses)
  if ($processes.Count -gt 0) {
    Write-Host '  Project processes:'
    foreach ($proc in $processes) {
      $line = [string]$proc.CommandLine
      if ($line.Length -gt 110) { $line = $line.Substring(0, 110) + '...' }
      Write-Host "    PID $($proc.ProcessId)  $($proc.Name)  $line"
    }
  } else {
    Write-Host '  No project node/cmd processes found.'
  }
}

switch ($Action) {
  'start' {
    $ok = Start-SpendWise
    if (-not $ok) { exit 1 }
  }
  'stop' {
    Stop-SpendWise
  }
  'restart' {
    Stop-SpendWise
    Start-Sleep -Seconds 1
    $ok = Start-SpendWise
    if (-not $ok) { exit 1 }
  }
  'status' {
    Show-Status
  }
}
