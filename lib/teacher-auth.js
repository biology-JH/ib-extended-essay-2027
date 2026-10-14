import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

export const TEACHER_COOKIE_NAME = 'ee_teacher_session';
export const TEACHER_SESSION_SECONDS = 8 * 60 * 60;

export function getTeacherPassword() {
  const value = process.env.EE_TEACHER_ACCESS_PASSWORD;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function getTeacherServerSecret() {
  const value = process.env.EE_TEACHER_SERVER_SECRET;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const key = Buffer.from(value, 'base64url');
  return key.length >= 32 ? key : null;
}

export function deriveTeacherKey(purpose, masterSecret = getTeacherServerSecret()) {
  if (!Buffer.isBuffer(masterSecret) || masterSecret.length < 32) {
    throw new Error('Teacher server secret is not configured.');
  }
  return Buffer.from(hkdfSync(
    'sha256',
    masterSecret,
    Buffer.from('ib-ee-teacher-key-v1'),
    Buffer.from(`ib-ee-${purpose}-v1`),
    32,
  ));
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function passwordMatches(candidate, expected = getTeacherPassword()) {
  if (!expected || typeof candidate !== 'string' || candidate.length > 512) return false;
  return constantTimeEqual(candidate, expected);
}

function sign(payload, masterSecret) {
  const signingKey = deriveTeacherKey('cookie-signing', masterSecret);
  return createHmac('sha256', signingKey).update(payload).digest('base64url');
}

export function createTeacherSessionCookie(masterSecret = getTeacherServerSecret()) {
  if (!masterSecret) throw new Error('Teacher server secret is not configured.');
  const expiresAt = Date.now() + TEACHER_SESSION_SECONDS * 1000;
  const payload = Buffer.from(JSON.stringify({
    expiresAt,
    nonce: randomBytes(18).toString('base64url'),
  })).toString('base64url');
  const token = `${payload}.${sign(payload, masterSecret)}`;
  return `${TEACHER_COOKIE_NAME}=${token}; Max-Age=${TEACHER_SESSION_SECONDS}; Path=/api/teachers; HttpOnly; Secure; SameSite=Lax`;
}

export function clearTeacherSessionCookie() {
  return `${TEACHER_COOKIE_NAME}=; Max-Age=0; Path=/api/teachers; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(req, name) {
  const cookieHeader = req.headers?.cookie;
  if (typeof cookieHeader !== 'string') return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    if (trimmed.slice(0, separator) === name) return trimmed.slice(separator + 1);
  }
  return null;
}

export function isTeacherAuthenticated(req, masterSecret = getTeacherServerSecret()) {
  if (!masterSecret) return false;
  const token = readCookie(req, TEACHER_COOKIE_NAME);
  if (!token || token.length > 4096) return false;

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const [payload, providedSignature] = parts;
  if (!constantTimeEqual(providedSignature, sign(payload, masterSecret))) return false;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const now = Date.now();
    return Number.isSafeInteger(session.expiresAt)
      && session.expiresAt > now
      && session.expiresAt <= now + TEACHER_SESSION_SECONDS * 1000 + 60_000;
  } catch {
    return false;
  }
}

export function setPrivateResponseHeaders(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Cookie');
}
