import crypto from 'crypto';
import { config } from '../config/env';

const getKey = (): Buffer => {
  const raw = config.jwt.secret; // reuse a strong secret; ideally have a dedicated key
  const hash = crypto.createHash('sha256').update(raw).digest();
  return hash; // 32 bytes
};

export const encryptToBase64 = (plaintext: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
};

export const decryptFromBase64 = (payload: string): string => {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return plaintext;
};
