import crypto from 'crypto';

// Load encryption key from ENV
// It must be 32 bytes when decoded from Base64
const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'base64');
if (key.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes (Base64 encoded)');
}

/**
 * Encrypt text using AES-256-CBC
 */
export function encryptAES(text: string): string {
  const iv = crypto.randomBytes(16); // 16-byte IV
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  // Format: iv:encrypted
  return iv.toString('base64') + ':' + encrypted.toString('base64');
}

/**
 * Decrypt text using AES-256-CBC
 */
export function decryptAES(encryptedData: string): string {
  const [ivStr, encStr] = encryptedData.split(':');
  if (!ivStr || !encStr) {
    throw new Error('Invalid encrypted data format');
  }
  const iv = Buffer.from(ivStr, 'base64');
  const encrypted = Buffer.from(encStr, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
