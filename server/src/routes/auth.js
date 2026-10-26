import { Router } from 'express';
import db, { hashPassword, verifyPassword } from '../db.js';
import { createSession, destroySession, getUserBySession, requireAuth, sameOrigin } from '../auth.js';
import { isNonEmpty, sanitize } from '../util.js';

const router = Router();

router.get('/me', (req, res) => {
  const user = getUserBySession(req.sessionId);
  res.json({ user: user || null });
});

router.post('/register', (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: '同源校验失败' });
  const { username, password, displayName } = req.body || {};
  if (!isNonEmpty(username, 30) || !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    return res.status(400).json({ error: '用户名需 3-30 位字母数字下划线' });
  }
  if (!isNonEmpty(password, 100) || password.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' });
  }
  const name = sanitize(displayName || username, 30).trim() || username;
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: '用户名已存在' });
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, display_name, contact_note, is_demo, created_at) VALUES (?,?,?,?,0,?)'
  ).run(username, hashPassword(password), name, '', Date.now());
  const sid = createSession(Number(info.lastInsertRowid));
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
  res.json({ user: { id: Number(info.lastInsertRowid), username, displayName: name, contactNote: '', isDemo: false } });
});

router.post('/login', (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: '同源校验失败' });
  const { username, password } = req.body || {};
  if (!isNonEmpty(username, 30) || !isNonEmpty(password, 100)) {
    return res.status(400).json({ error: '用户名或密码不能为空' });
  }
  const row = db.prepare('SELECT id, username, display_name, contact_note, is_demo, password_hash FROM users WHERE username = ?').get(username);
  if (!row) return res.status(401).json({ error: '用户名或密码错误' });

  if (!verifyPassword(password, row.password_hash)) return res.status(401).json({ error: '用户名或密码错误' });
  const sid = createSession(row.id);
  res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000, path: '/' });
  res.json({ user: { id: row.id, username: row.username, displayName: row.display_name, contactNote: row.contact_note, isDemo: !!row.is_demo } });
});

router.post('/logout', (req, res) => {
  if (req.sessionId) destroySession(req.sessionId);
  res.clearCookie('sid', { path: '/' });
  res.json({ ok: true });
});

router.put('/contact', requireAuth, (req, res) => {
  const note = sanitize(req.body?.contactNote || '', 300);
  db.prepare('UPDATE users SET contact_note = ? WHERE id = ?').run(note, req.user.id);
  res.json({ ok: true });
});

export default router;