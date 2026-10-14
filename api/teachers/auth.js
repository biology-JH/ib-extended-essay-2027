import { createHmac } from 'node:crypto';
import {
  clearTeacherSessionCookie,
  createTeacherSessionCookie,
  deriveTeacherKey,
  getTeacherPassword,
  getTeacherServerSecret,
  isTeacherAuthenticated,
  passwordMatches,
  setPrivateResponseHeaders,
} from '../../lib/teacher-auth.js';

const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const failedAttempts = new Map();

function readPassword(req) {
  if (req.body && typeof req.body === 'object') return req.body.password;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body).password;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function attemptKey(req, masterSecret) {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const address = typeof forwardedFor === 'string'
    ? forwardedFor.split(',')[0].trim().slice(0, 128)
    : (req.socket?.remoteAddress || 'unknown');
  return createHmac('sha256', deriveTeacherKey('rate-limit', masterSecret)).update(address).digest('hex');
}

function cleanExpiredAttempts(now) {
  if (failedAttempts.size <= 5000) return;
  for (const [key, attempt] of failedAttempts) {
    if (attempt.resetAt <= now) failedAttempts.delete(key);
  }
}

function remainingWait(req, masterSecret, now = Date.now()) {
  const key = attemptKey(req, masterSecret);
  const current = failedAttempts.get(key);
  if (!current || current.resetAt <= now) {
    failedAttempts.delete(key);
    return { key, retryAfter: 0 };
  }
  if (current.count < MAX_FAILED_ATTEMPTS) return { key, retryAfter: 0 };
  return { key, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

function recordFailure(key, now = Date.now()) {
  const current = failedAttempts.get(key);
  if (!current || current.resetAt <= now) {
    failedAttempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
  } else {
    current.count += 1;
  }
  cleanExpiredAttempts(now);
}

export default function handler(req, res) {
  setPrivateResponseHeaders(res);

  if (req.method === 'GET') {
    if (!getTeacherPassword() || !getTeacherServerSecret()) {
      return res.status(503).json({ error: 'Teacher access is temporarily unavailable.' });
    }
    return res.status(200).json({ authenticated: isTeacherAuthenticated(req) });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearTeacherSessionCookie());
    return res.status(200).json({ authenticated: false });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const password = getTeacherPassword();
  const masterSecret = getTeacherServerSecret();
  if (!password || !masterSecret) {
    return res.status(503).json({ error: 'Teacher access is temporarily unavailable.' });
  }

  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return res.status(415).json({ error: 'Send the password as JSON.' });
  }

  const { key, retryAfter } = remainingWait(req, masterSecret);
  if (retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many attempts. Please wait before trying again.' });
  }

  if (!passwordMatches(readPassword(req), password)) {
    recordFailure(key);
    return res.status(401).json({ error: 'Password not accepted.' });
  }

  failedAttempts.delete(key);
  res.setHeader('Set-Cookie', createTeacherSessionCookie(masterSecret));
  return res.status(200).json({ authenticated: true });
}
