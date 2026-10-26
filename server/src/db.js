import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import config from './config.js';
import { logger } from './logger.js';

mkdirSync(config.dataDir, { recursive: true });
const dbPath = resolve(config.dataDir, 'yihuan.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  contact_note TEXT NOT NULL DEFAULT '',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  category TEXT NOT NULL,
  condition TEXT NOT NULL,
  location TEXT NOT NULL,
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'on_sale',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  tool_call_id TEXT,
  meta TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);
`);

db.exec('CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const hash = scryptSync(password, salt, expected.length);
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

const CATEGORIES = ['教材', '数码', '生活用品', '运动器材', '其他'];
const CONDITIONS = ['全新', '九成新', '八成新', '七成新', '六成新及以下'];

export function validCategory(c) { return CATEGORIES.includes(c); }
export function validCondition(c) { return CONDITIONS.includes(c); }
export { CATEGORIES, CONDITIONS };

function seedIfEmpty() {
  if (db.prepare('SELECT value FROM app_meta WHERE key = ?').get('demo_seeded')) return;
  const row = db.prepare('SELECT COUNT(*) AS n FROM products').get();
  if (row.n > 0) {
    db.prepare('INSERT INTO app_meta (key, value) VALUES (?,?)').run('demo_seeded', '1');
    return;
  }

  const now = Date.now();
  const demoUser = db.prepare(
    'INSERT OR IGNORE INTO users (username, password_hash, display_name, contact_note, is_demo, created_at) VALUES (?,?,?,?,?,?)'
  );
  const demoPwd = hashPassword('demo123456');
  demoUser.run('demo_seller', demoPwd, '演示卖家小张', '演示账号：仅用于展示，未通过学生认证。可在校内食堂南门当面交易。', 1, now);
  demoUser.run('demo_buyer', hashPassword('demo123456'), '演示买家小李', '演示账号：仅用于展示，未通过学生认证。', 1, now);

  const sellerRow = db.prepare('SELECT id FROM users WHERE username = ?').get('demo_seller');
  const sellerId = sellerRow.id;

  const products = [
    ['高等数学（同济第八版）上册', '同济大学数学系编，第八版，上册。有少量铅笔笔记，整体干净。', 1200, '教材', '八成新', '图书馆一楼自提'],
    ['大学英语精读 第三册', '外研社大学英语精读第三册，配套光盘已遗失，书内无缺页。', 800, '教材', '九成新', '三号教学楼自提'],
    ['线性代数 同济版', '同济版线性代数，期末复习用，重点已用荧光笔标注。', 600, '教材', '七成新', '图书馆一楼自提'],
    ['数据结构与算法分析 C语言描述', '机械工业出版社，英文影印版，封面有轻微磨损。', 2500, '教材', '八成新', '计算机学院自提'],
    ['新视野大学英语读写教程 2', '外研社新视野读写教程第二册，几乎全新。', 1000, '教材', '九成新', '外语学院自提'],
    ['小米 Redmi K40 手机', '2021 年购入，8+128G，屏幕无划痕，电池健康度约 85%，附原装充电器。', 85000, '数码', '八成新', '校门口奶茶店自提'],
    ['罗技 G304 无线鼠标', '购入半年，使用少，电池仓无锈，附未拆封电池。', 9000, '数码', '九成新', '宿舍楼下自提'],
    ['小米小爱音箱 触屏版', '宿舍用，屏幕完好，音质正常，附电源线。', 12000, '数码', '八成新', '宿舍楼下自提'],
    ['绿联 65W 氮化镓充电器', '三口 Type-C，出差用，外观有轻微使用痕迹。', 8000, '数码', '九成新', '校门口自提'],
    ['罗技 K380 蓝牙键盘', '粉色，连接稳定，键帽无掉字，附两节七号电池。', 11000, '数码', '九成新', '图书馆一楼自提'],
    ['宿舍收纳箱 大号', '塑料材质，带盖，搬家后不再需要，可叠放。', 1500, '生活用品', '七成新', '宿舍楼下自提'],
    ['台灯 USB 护眼款', '五档调光，无频闪，附 USB 线，灯罩有轻微划痕。', 2500, '生活用品', '八成新', '宿舍楼下自提'],
    ['电热水壶 1.5L', '宿舍用，烧水正常，外壳有水渍痕迹，附电源底座。', 3500, '生活用品', '七成新', '宿舍楼下自提'],
    ['床边挂篮 收纳袋', '帆布材质，挂床栏用，洗过一次，无破损。', 800, '生活用品', '九成新', '宿舍楼下自提'],
    ['瑜伽垫 加厚 6mm', 'TPE 材质，用了一学期，有轻微压痕，附绑带。', 4500, '运动器材', '八成新', '体育馆门口自提'],
    ['羽毛球拍 胜利挑战者 9500', '入门拍，线已断需自备，拍框无伤，附拍套。', 12000, '运动器材', '八成新', '体育馆门口自提'],
    ['跳绳 计数款', '钢丝绳，手柄计数正常，宿舍闲置。', 1500, '运动器材', '九成新', '体育馆门口自提'],
    ['篮球 斯伯丁 74-604', '室内外两用，气嘴完好，表面有轻微磨损。', 9000, '运动器材', '七成新', '操场自提'],
    ['宿舍小冰箱 50L', '毕业转让，制冷正常，噪音不大，需自搬。', 28000, '其他', '七成新', '宿舍楼下自提'],
    ['自行车 捷安特山地车', '大三毕业转让，变速正常，刹车刚换，需自取。', 45000, '其他', '七成新', '车棚自提']
  ];

  const ins = db.prepare(
    'INSERT INTO products (seller_id, title, description, price_cents, category, condition, location, status, is_demo, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)'
  );
  db.exec('BEGIN');
  try {
    for (const r of products) {
      ins.run(sellerId, r[0], r[1], r[2], r[3], r[4], r[5], 'on_sale', now, now);
    }
    db.prepare('INSERT INTO app_meta (key, value) VALUES (?,?)').run('demo_seeded', '1');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  logger.info('演示数据已初始化', { users: 2, products: products.length });
}

seedIfEmpty();

export default db;
