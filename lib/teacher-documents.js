import { createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { deriveTeacherKey, getTeacherServerSecret } from './teacher-auth.js';

const MAGIC = Buffer.from('EEPDF1');
const HEADER_BYTES = MAGIC.length + 12 + 16;

export function decryptTeacherDocument(filename) {
  if (!/^[a-z0-9-]+\.eepdf$/.test(filename)) {
    throw new Error('Invalid document name.');
  }

  const masterSecret = getTeacherServerSecret();
  if (!masterSecret) throw new Error('Teacher server secret is not configured.');

  const encryptedPath = path.join(process.cwd(), 'private-docs', filename);
  const encrypted = readFileSync(encryptedPath);
  if (encrypted.length <= HEADER_BYTES || !encrypted.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Encrypted document format is invalid.');
  }

  const ivStart = MAGIC.length;
  const tagStart = ivStart + 12;
  const cipherStart = tagStart + 16;
  const iv = encrypted.subarray(ivStart, tagStart);
  const authTag = encrypted.subarray(tagStart, cipherStart);
  const ciphertext = encrypted.subarray(cipherStart);
  const decipher = createDecipheriv('aes-256-gcm', deriveTeacherKey('pdf-encryption', masterSecret), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
