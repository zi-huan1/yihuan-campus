import { randomBytes } from 'node:crypto';
import db, { verifyPassword } from './db.js';
import config from './config.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createSession(userId) {
  const sid = randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?,?,?,?)').run(sid, userId, now, now + SESSION_TTL_MS);
  return sid;
}

export function destroySession(sid) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sid);
}

export function getUserBySession(sid) {
  if (!sid) return null;
  const row = db.prepare(
    'SELECT u.id, u.username, u.display_name, u.contact_note, u.is_demo, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?'
  ).get(sid);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    destroySession(sid);
    return null;
  }
  return { id: row.id, username: row.username, displayName: row.display_name, contactNote: row.contact_note, isDemo: !!row.is_demo };
}

export function authenticate(username, password) {
  const row = db.prepare('SELECT id, username, display_name, contact_note, is_demo, password_hash FROM users WHERE username = ?').get(username);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return { id: row.id, username: row.username, displayName: row.display_name, contactNote: row.contact_note, isDemo: !!row.is_demo };
}

export function requireAuth(req, res, next) {
  const user = getUserBySession(req.sessionId);
  if (!user) {
    res.status(401).json({ error: '未登录或会话已过期' });
    return;
  }
  req.user = user;
  next();
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.host === host;
  } catch {
    return false;
  }
}

export { config };