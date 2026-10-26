import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../auth.js';
import config from '../config.js';
import { logger } from '../logger.js';
import { chat, getMode, OFFLINE_TAG } from '../ai/agent.js';

const router = Router();

// 简单内存限流：每用户每分钟 AI_RATE_LIMIT_PER_MIN 次
const rateMap = new Map();
function rateLimit(userId) {
  const now = Date.now();
  const win = 60000;
  const entry = rateMap.get(userId) || { count: 0, resetAt: now + win };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + win; }
  entry.count++;
  rateMap.set(userId, entry);
  return entry.count <= config.aiRateLimitPerMin;
}

function getOrCreateConversation(userId) {
  let row = db.prepare('SELECT id FROM ai_conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);
  if (!row) {
    const info = db.prepare('INSERT INTO ai_conversations (user_id, created_at) VALUES (?,?)').run(userId, Date.now());
    row = { id: Number(info.lastInsertRowid) };
  }
  return row.id;
}

function loadHistory(conversationId) {
  const rows = db.prepare(
    'SELECT role, content, meta FROM ai_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?'
  ).all(conversationId, config.aiMaxHistory);
  return rows.reverse();
}

function saveMessage(conversationId, role, content, meta) {
  db.prepare(
    'INSERT INTO ai_messages (conversation_id, role, content, meta, created_at) VALUES (?,?,?,?,?)'
  ).run(conversationId, role, content, meta ? JSON.stringify(meta) : null, Date.now());
}

router.get('/mode', (req, res) => {
  const user = req.user;
  res.json({
    mode: getMode(),
    offlineNote: getMode() === 'offline' ? '离线演示模式：未接入真实大模型。规则流程演示，工具调用真实执行于本平台数据库。' : null,
    loggedIn: !!user
  });
});

router.post('/chat', requireAuth, async (req, res) => {
  if (!rateLimit(req.user.id)) {
    return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  }
  const userMessage = req.body?.message;
  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: '消息不能为空' });
  }
  if (userMessage.length > config.aiMaxMessageChars) {
    return res.status(400).json({ error: `消息过长，上限 ${config.aiMaxMessageChars} 字` });
  }

  let conversationId = req.body.conversationId;
  if (conversationId !== undefined && conversationId !== null) {
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) return res.status(400).json({ error: '对话编号无效' });
    if (!db.prepare('SELECT id FROM ai_conversations WHERE id = ? AND user_id = ?').get(conversationId, req.user.id)) return res.status(403).json({ error: '无权访问此对话' });
  } else {
    conversationId = Number(db.prepare('INSERT INTO ai_conversations (user_id, created_at) VALUES (?,?)').run(req.user.id, Date.now()).lastInsertRowid);
  }
  const history = loadHistory(conversationId);
  let searchFilters = null;
  for (const message of [...history].reverse()) {
    const meta = message.meta ? JSON.parse(message.meta) : null;
    if (meta?.searchFilters) { searchFilters = meta.searchFilters; break; }
  }

  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });

  let result;
  try {
    result = await chat({ userMessage, history, signal: ac.signal, searchFilters });
  } catch (e) {
    logger.error('AI 对话异常', { user: req.user.id, msg: e.message });
    return res.status(502).json({ error: e.message || 'AI 对话出错，请稍后重试' });
  }

  // 持久化用户消息与助手回复（不存完整 tool_calls 到 content，避免过大；meta 存摘要）
  saveMessage(conversationId, 'user', userMessage);
  saveMessage(conversationId, 'assistant', result.reply, {
    mode: result.mode,
    searchFilters: result.searchFilters,
    toolCalls: result.toolCalls.map((t) => ({ id: t.id, name: t.name, ok: t.ok, round: t.round })),
    productCardIds: result.productCards.map((c) => c.id),
    onlineError: result.onlineError || null
  });

  res.json({
    conversationId,
    mode: result.mode,
    reply: result.reply,
    toolCalls: result.toolCalls,
    productCards: result.productCards,
    offline: result.mode === 'offline'
  });
});

router.get('/history', requireAuth, (req, res) => {
  const conversationId = getOrCreateConversation(req.user.id);
  const rows = db.prepare(
    'SELECT role, content, meta, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC'
  ).all(conversationId);
  res.json({
    items: rows.slice(-config.aiMaxHistory).map((r) => ({
      role: r.role,
      content: r.content,
      meta: r.meta ? JSON.parse(r.meta) : null,
      createdAt: r.created_at
    }))
  });
});

router.delete('/history', requireAuth, (req, res) => {
  db.prepare('DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = ?)').run(req.user.id);
  db.prepare('DELETE FROM ai_conversations WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

export default router;
