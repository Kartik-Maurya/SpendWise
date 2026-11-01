const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_FILE = path.join(__dirname, '..', '.enc_key');
let cachedKeys = null;

function parseKey(value, label) {
  const key = Buffer.from(String(value || '').trim(), 'hex');
  if (key.length !== 32) {
    throw new Error(
      `${label} must decode to exactly 32 bytes for AES-256-GCM. ` +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return key;
}

function readKeyFile() {
  const keyData = fs.readFileSync(KEY_FILE, 'utf8').trim();
  return parseKey(keyData, 'The key in server/.enc_key');
}

function getKeyCandidates() {
  if (cachedKeys) return cachedKeys;

  const keys = [];

  if (process.env.ENCRYPTION_KEY) {
    keys.push(parseKey(process.env.ENCRYPTION_KEY, 'ENCRYPTION_KEY'));
  } else if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ENCRYPTION_KEY is required in production. Set it to 32 random bytes as hex in the environment.'
    );
  } else if (fs.existsSync(KEY_FILE)) {
    keys.push(readKeyFile());
  } else {
    const generated = crypto.randomBytes(32);
    fs.writeFileSync(KEY_FILE, generated.toString('hex'), { mode: 0o600 });
    keys.push(generated);
    console.warn('WARNING: ENCRYPTION_KEY environment variable is not set.');
    console.warn('A random encryption key has been generated and saved to server/.enc_key.');
    console.warn('For production, set ENCRYPTION_KEY in .env (see .env.example).');
  }

  if (process.env.ENCRYPTION_KEY_PREVIOUS) {
    for (const part of String(process.env.ENCRYPTION_KEY_PREVIOUS).split(',')) {
      if (!part.trim()) continue;
      const previous = parseKey(part, 'ENCRYPTION_KEY_PREVIOUS');
      if (!keys.some((key) => key.equals(previous))) {
        keys.push(previous);
      }
    }
  }

  cachedKeys = keys;
  return cachedKeys;
}

function getEncryptionKey() {
  return getKeyCandidates()[0];
}

function encrypt(plaintext, key) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }
  const k = key || getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function decryptWithKey(ciphertext, key) {
  const data = Buffer.from(ciphertext, 'base64');
  if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Ciphertext too short');
  }
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

function decrypt(ciphertext, key) {
  if (!ciphertext) {
    return null;
  }
  const keys = key ? [key] : getKeyCandidates();
  let lastError = null;
  for (const candidate of keys) {
    try {
      return decryptWithKey(ciphertext, candidate);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Decryption failed: invalid encryption key or corrupted data${lastError ? ` (${lastError.message})` : ''}`
  );
}

function verifyEncryption() {
  const sample = `spendwise-key-check-${Date.now()}`;
  const roundTrip = decrypt(encrypt(sample));
  if (roundTrip !== sample) {
    throw new Error('Encryption self-test failed: ciphertext did not round-trip');
  }
}

function resetKeyCache() {
  cachedKeys = null;
}

module.exports = {
  getEncryptionKey,
  getKeyCandidates,
  encrypt,
  decrypt,
  verifyEncryption,
  resetKeyCache,
};
