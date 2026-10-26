import { Router } from 'express';
import db, { CATEGORIES, CONDITIONS, validCategory, validCondition } from '../db.js';
import { requireAuth } from '../auth.js';
import { yuanToCents, centsToYuan, isNonEmpty, sanitize } from '../util.js';

const router = Router();

function publicProduct(p) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    priceYuan: centsToYuan(p.price_cents),
    category: p.category,
    condition: p.condition,
    location: p.location,
    image: p.image_path ? `/uploads/${p.image_path}` : null,
    status: p.status,
    isDemo: !!p.is_demo,
    sellerName: p.seller_name,
    sellerIsDemo: !!p.seller_is_demo,
    createdAt: p.created_at
  };
}

function detailProduct(p, includeContact) {
  const base = publicProduct(p);
  base.sellerId = p.seller_id;
  if (includeContact) {
    base.sellerContactNote = p.seller_contact_note || '';
  }
  return base;
}

router.get('/', (req, res) => {
  const q = sanitize(req.query.q || '', 100);
  const category = req.query.category || '';
  const minYuan = req.query.minPrice;
  const maxYuan = req.query.maxPrice;
  const sort = req.query.sort || 'newest';

  let sql = `SELECT p.*, u.display_name AS seller_name, u.is_demo AS seller_is_demo
             FROM products p JOIN users u ON u.id = p.seller_id
             WHERE p.status = 'on_sale'`;
  const args = [];
  if (q) {
    sql += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.category LIKE ?)`;
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category && validCategory(category)) {
    sql += ` AND p.category = ?`;
    args.push(category);
  }
  const minCents = yuanToCents(minYuan);
  const maxCents = yuanToCents(maxYuan);
  if (minCents !== null) { sql += ` AND p.price_cents >= ?`; args.push(minCents); }
  if (maxCents !== null) { sql += ` AND p.price_cents <= ?`; args.push(maxCents); }

  if (sort === 'price_asc') sql += ` ORDER BY p.price_cents ASC, p.id DESC`;
  else if (sort === 'price_desc') sql += ` ORDER BY p.price_cents DESC, p.id DESC`;
  else sql += ` ORDER BY p.created_at DESC, p.id DESC`;

  sql += ` LIMIT 200`;
  const rows = db.prepare(sql).all(...args);
  res.json({ items: rows.map(publicProduct), categories: CATEGORIES, conditions: CONDITIONS });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的商品 ID' });
  const row = db.prepare(
    `SELECT p.*, u.display_name AS seller_name, u.is_demo AS seller_is_demo, u.contact_note AS seller_contact_note
     FROM products p JOIN users u ON u.id = p.seller_id WHERE p.id = ?`
  ).get(id);
  if (!row) return res.status(404).json({ error: '商品不存在' });
  const includeContact = !!req.user;
  res.json(detailProduct(row, includeContact));
});

router.post('/', requireAuth, (req, res) => {
  const { title, description, priceYuan, category, condition, location, image } = req.body || {};
  if (!isNonEmpty(title, 100)) return res.status(400).json({ error: '标题不能为空（最多 100 字）' });
  if (!isNonEmpty(description, 1000)) return res.status(400).json({ error: '描述不能为空（最多 1000 字）' });
  const cents = yuanToCents(priceYuan);
  if (cents === null || cents <= 0) return res.status(400).json({ error: '价格必须是大于 0 的金额，最多两位小数' });
  if (!validCategory(category)) return res.status(400).json({ error: '分类无效' });
  if (!validCondition(condition)) return res.status(400).json({ error: '成色无效' });
  if (!isNonEmpty(location, 100)) return res.status(400).json({ error: '自提地点不能为空' });
  const img = typeof image === 'string' && /^[a-f0-9]{32}\.(jpg|png|webp)$/.test(image) ? image : null;
  const now = Date.now();
  const info = db.prepare(
    `INSERT INTO products (seller_id, title, description, price_cents, category, condition, location, image_path, status, is_demo, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,'on_sale',0,?,?)`
  ).run(req.user.id, title.trim(), description.trim(), cents, category, condition, location.trim(), img, now, now);
  res.json({ id: Number(info.lastInsertRowid) });
});

router.put('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的商品 ID' });
  const row = db.prepare('SELECT seller_id FROM products WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '商品不存在' });
  if (row.seller_id !== req.user.id) return res.status(403).json({ error: '只能编辑自己的商品' });
  const { title, description, priceYuan, category, condition, location } = req.body || {};
  const sets = [];
  const args = [];
  if (title !== undefined) {
    if (!isNonEmpty(title, 100)) return res.status(400).json({ error: '标题不能为空' });
    sets.push('title = ?'); args.push(title.trim());
  }
  if (description !== undefined) {
    if (!isNonEmpty(description, 1000)) return res.status(400).json({ error: '描述不能为空' });
    sets.push('description = ?'); args.push(description.trim());
  }
  if (priceYuan !== undefined) {
    const cents = yuanToCents(priceYuan);
    if (cents === null || cents <= 0) return res.status(400).json({ error: '价格无效' });
    sets.push('price_cents = ?'); args.push(cents);
  }
  if (category !== undefined) {
    if (!validCategory(category)) return res.status(400).json({ error: '分类无效' });
    sets.push('category = ?'); args.push(category);
  }
  if (condition !== undefined) {
    if (!validCondition(condition)) return res.status(400).json({ error: '成色无效' });
    sets.push('condition = ?'); args.push(condition);
  }
  if (location !== undefined) {
    if (!isNonEmpty(location, 100)) return res.status(400).json({ error: '自提地点不能为空' });
    sets.push('location = ?'); args.push(location.trim());
  }
  if (sets.length === 0) return res.status(400).json({ error: '没有可更新字段' });
  sets.push('updated_at = ?'); args.push(Date.now());
  args.push(id);
  db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  res.json({ ok: true });
});

router.post('/:id/offsale', requireAuth, (req, res) => setStatus(req, res, 'off_shelf'));
router.post('/:id/onsale', requireAuth, (req, res) => setStatus(req, res, 'on_sale'));

function setStatus(req, res, status) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的商品 ID' });
  const row = db.prepare('SELECT seller_id FROM products WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '商品不存在' });
  if (row.seller_id !== req.user.id) return res.status(403).json({ error: '只能操作自己的商品' });
  db.prepare('UPDATE products SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), id);
  res.json({ ok: true, status });
}

router.delete('/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的商品 ID' });
  const row = db.prepare('SELECT seller_id, image_path FROM products WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '商品不存在' });
  if (row.seller_id !== req.user.id) return res.status(403).json({ error: '只能删除自己的商品' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  res.json({ ok: true, deletedImage: row.image_path });
});

router.get('/my/list', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT p.*, u.display_name AS seller_name, u.is_demo AS seller_is_demo
     FROM products p JOIN users u ON u.id = p.seller_id WHERE p.seller_id = ? ORDER BY p.created_at DESC`
  ).all(req.user.id);
  res.json({ items: rows.map(publicProduct) });
});

router.get('/favorites/list', requireAuth, (req, res) => {
  const rows = db.prepare(
    `SELECT p.*, u.display_name AS seller_name, u.is_demo AS seller_is_demo
     FROM favorites f JOIN products p ON p.id = f.product_id JOIN users u ON u.id = p.seller_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`
  ).all(req.user.id);
  res.json({ items: rows.map(publicProduct) });
});

router.post('/favorites/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的商品 ID' });
  const row = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: '商品不存在' });
  try {
    db.prepare('INSERT INTO favorites (user_id, product_id, created_at) VALUES (?,?,?)').run(req.user.id, id, Date.now());
  } catch {
    return res.json({ ok: true, already: true });
  }
  res.json({ ok: true });
});

router.delete('/favorites/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: '无效的商品 ID' });
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.user.id, id);
  res.json({ ok: true });
});

export default router;