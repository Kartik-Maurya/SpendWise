const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
let cachedKey = null;

function getEncryptionKey() {
  if (cachedKey) return cachedKey;

  const envKey = process.env.ENCRYPTION_KEY;
  if (envKey) {
    const key = Buffer.from(envKey, 'hex');
    if (key.length !== 32) {
      throw new Error(
        'ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    cachedKey = key;
    return cachedKey;
  }

  const keyFile = path.join(__dirname, '..', '.enc_key');
  if (fs.existsSync(keyFile)) {
    try {
      const keyData = fs.readFileSync(keyFile, 'utf8').trim();
      const key = Buffer.from(keyData, 'hex');
      if (key.length !== 32) {
        throw new Error('Invalid encryption key in .enc_key file');
      }
      cachedKey = key;
      return cachedKey;
    } catch (err) {
      throw new Error('Failed to read encryption key file: ' + err.message);
    }
  }

  cachedKey = crypto.randomBytes(32);
  fs.writeFileSync(keyFile, cachedKey.toString('hex'));
  console.warn('WARNING: ENCRYPTION_KEY environment variable is not set.');
  console.warn('A random encryption key has been generated and saved to server/.enc_key.');
  console.warn('For production, set ENCRYPTION_KEY in your .env file (see .env.example).');
  return cachedKey;
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

function decrypt(ciphertext, key) {
  if (!ciphertext) {
    return null;
  }
  const k = key || getEncryptionKey();
  try {
    const data = Buffer.from(ciphertext, 'base64');
    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error('Ciphertext too short');
    }
    const iv = data.slice(0, IV_LENGTH);
    const authTag = data.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.slice(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv('aes-256-gcm', k, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error('Decryption failed: invalid encryption key or corrupted data');
  }
}

module.exports = { getEncryptionKey, encrypt, decrypt };
