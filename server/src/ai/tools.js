// AI 工具定义与受控执行。模型不直接执行 SQL；所有工具参数在后端校验后用参数化查询访问数据库。
// 金额按分存储，对模型/前端以元（字符串两位小数）呈现，避免不受约束的浮点。
import db, { CATEGORIES, CONDITIONS, validCategory, validCondition } from '../db.js';
import { yuanToCents, centsToYuan, sanitize } from '../util.js';
import { SAFETY_KNOWLEDGE, knowledgeText } from './knowledge.js';

const PRICE_MIN = 0;
const PRICE_MAX = 999999; // 元上限，对应 99_999_999 分

function toYuan(cents) {
  return centsToYuan(cents);
}

function productCard(p) {
  return {
    id: p.id,
    title: p.title,
    priceYuan: toYuan(p.price_cents),
    category: p.category,
    condition: p.condition,
    location: p.location,
    image: p.image_path ? `/uploads/${p.image_path}` : null,
    status: p.status,
    isDemo: !!p.is_demo,
    sellerName: p.seller_name
  };
}

function detailCard(p) {
  return {
    ...productCard(p),
    description: p.description,
    createdAt: p.created_at
  };
}

// ---- 参数校验工具 ----
function str(v, max) {
  if (v === undefined || v === null) return undefined;
  const s = String(v);
  return s.length > max ? s.slice(0, max) : s;
}
function num(v) {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function int(v, def, lo, hi) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

// ---- 工具 1: search_products ----
function searchProducts(args, ctx) {
  const inherit = args?.inherit === true;
  const base = inherit && ctx.lastSearchFilters ? { ...ctx.lastSearchFilters } : {};
  const keyword = str(args?.keyword ?? base.keyword, 100);
  const category = validCategory(args?.category ?? base.category) ? (args?.category ?? base.category) : undefined;
  const minPrice = num(args?.minPrice ?? base.minPrice);
  const maxPrice = num(args?.maxPrice ?? base.maxPrice);
  const condition = validCondition(args?.condition ?? base.condition) ? (args?.condition ?? base.condition) : undefined;
  const limit = int(args?.limit, 10, 1, 30);

  if (minPrice !== undefined && (minPrice < PRICE_MIN || minPrice > PRICE_MAX)) return { error: 'minPrice 超出范围' };
  if (maxPrice !== undefined && (maxPrice < PRICE_MIN || maxPrice > PRICE_MAX)) return { error: 'maxPrice 超出范围' };
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) return { error: 'minPrice 不能大于 maxPrice' };

  let sql = `SELECT p.*, u.display_name AS seller_name FROM products p JOIN users u ON u.id = p.seller_id WHERE p.status = 'on_sale'`;
  const params = [];
  if (keyword) { sql += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.category LIKE ?)`; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (category) { sql += ` AND p.category = ?`; params.push(category); }
  if (condition) { sql += ` AND p.condition = ?`; params.push(condition); }
  const minC = minPrice !== undefined ? yuanToCents(minPrice) : null;
  const maxC = maxPrice !== undefined ? yuanToCents(maxPrice) : null;
  if (minC !== null) { sql += ` AND p.price_cents >= ?`; params.push(minC); }
  if (maxC !== null) { sql += ` AND p.price_cents <= ?`; params.push(maxC); }
  sql += ` ORDER BY p.created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = db.prepare(sql).all(...params);

  // 记录本次筛选条件，支持后续"再便宜点""只要教材"追问
  ctx.lastSearchFilters = { keyword, category, minPrice, maxPrice, condition };
  // 记录成功查询到的在售商品，供最终商品卡片引用
  ctx.verifiedProducts.clear();
  for (const r of rows) ctx.verifiedProducts.set(r.id, productCard(r));

  if (rows.length === 0) {
    return {
      content: `没有找到符合条件的在售商品。筛选条件：${describeFilters({ keyword, category, minPrice, maxPrice, condition })}。可以尝试放宽价格或关键词。`,
      products: []
    };
  }
  const list = rows.map((r) => `• #${r.id} ${r.title}（${r.category}/${r.condition}）¥${toYuan(r.price_cents)}，自提：${r.location}`).join('\n');
  return {
    content: `找到 ${rows.length} 件在售商品：\n${list}`,
    products: rows.map(productCard)
  };
}

function describeFilters(f) {
  const parts = [];
  if (f.keyword) parts.push(`关键词"${f.keyword}"`);
  if (f.category) parts.push(`分类${f.category}`);
  if (f.condition) parts.push(`成色${f.condition}`);
  if (f.minPrice !== undefined) parts.push(`≥¥${f.minPrice}`);
  if (f.maxPrice !== undefined) parts.push(`≤¥${f.maxPrice}`);
  return parts.length ? parts.join('、') : '无';
}

// ---- 工具 2: get_product ----
function getProduct(args, ctx) {
  const id = int(args?.productId, 0, 1, 1e9);
  if (!id) return { error: 'productId 必须是正整数' };
  const row = db.prepare(
    `SELECT p.*, u.display_name AS seller_name FROM products p JOIN users u ON u.id = p.seller_id WHERE p.id = ?`
  ).get(id);
  if (!row) return { content: `商品 #${id} 不存在。`, products: [] };
  const onSale = row.status === 'on_sale';
  if (onSale) ctx.verifiedProducts.set(row.id, productCard(row));
  const statusText = onSale ? '在售' : `已${row.status === 'off_shelf' ? '下架' : '其他状态'}`;
  return {
    content: `商品 #${row.id}：${row.title}\n分类：${row.category}，成色：${row.condition}\n价格：¥${toYuan(row.price_cents)}\n自提地点：${row.location}\n描述：${row.description}\n状态：${statusText}\n卖家：${row.seller_name}${row.is_demo ? '（演示账号，未通过学生认证）' : ''}`,
    products: onSale ? [detailCard(row)] : []
  };
}

// ---- 工具 3: suggest_price ----
function suggestPrice(args, ctx) {
  const category = validCategory(args?.category) ? args.category : undefined;
  const keyword = str(args?.keyword, 100);
  const productId = int(args?.productId, 0, 1, 1e9);

  let cat = category;
  let kw = keyword;
  if (productId && !cat) {
    const row = db.prepare('SELECT category, title FROM products WHERE id = ?').get(productId);
    if (row) { cat = row.category; kw = kw || row.title; }
  }
  if (!cat && !kw) return { error: '请提供 category 或 keyword 或 productId 以确定参考范围' };

  let sql = `SELECT price_cents FROM products WHERE status = 'on_sale'`;
  const params = [];
  if (cat) { sql += ` AND category = ?`; params.push(cat); }
  if (kw) { sql += ` AND (title LIKE ? OR description LIKE ? OR category LIKE ?)`; params.push(`%${kw}%`, `%${kw}%`, `%${kw}%`); }
  sql += ` ORDER BY price_cents ASC`;
  const rows = db.prepare(sql).all(...params);

  if (rows.length === 0) {
    return {
      content: `平台上没有找到同类在售商品作为参考（分类：${cat || '未指定'}，关键词：${kw || '未指定'}）。样本数为 0，无法给出参考区间。这不是全网成交价，仅基于本平台在售数据。`,
      products: []
    };
  }
  const prices = rows.map((r) => r.price_cents);
  const min = prices[0];
  const max = prices[prices.length - 1];
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const median = prices[Math.floor(prices.length / 2)];

  // 重新查回这些商品用于卡片（最多 5 件代表性）
  let cardSql = `SELECT p.*, u.display_name AS seller_name FROM products p JOIN users u ON u.id = p.seller_id WHERE p.status = 'on_sale'`;
  const cardParams = [];
  if (cat) { cardSql += ` AND p.category = ?`; cardParams.push(cat); }
  if (kw) { cardSql += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.category LIKE ?)`; cardParams.push(`%${kw}%`, `%${kw}%`, `%${kw}%`); }
  cardSql += ` ORDER BY p.price_cents ASC LIMIT 5`;
  const cardRows = db.prepare(cardSql).all(...cardParams);
  for (const r of cardRows) ctx.verifiedProducts.set(r.id, productCard(r));

  const uncertainty = rows.length < 5 ? '样本较少，参考价值有限，请谨慎判断。' : '样本量尚可，但仍仅供参考。';
  return {
    content: `基于本平台 ${rows.length} 件同类在售商品（分类：${cat || '未指定'}${kw ? `，关键词：${kw}` : ''}）的参考区间：\n最低 ¥${toYuan(min)}，中位 ¥${toYuan(median)}，平均 ¥${toYuan(avg)}，最高 ¥${toYuan(max)}。\n${uncertainty}\n说明：这只是本平台在售标价分布，不是全网成交价，也不是鉴定结果。`,
    products: cardRows.map(productCard)
  };
}

// ---- 工具 4: check_trade_risk ----
function checkTradeRisk(args, ctx) {
  const text = str(args?.text, 1000);
  if (!text || !text.trim()) return { error: 'text 不能为空' };
  const matched = [];
  const t = text;
  for (const k of SAFETY_KNOWLEDGE) {
    if (k.content && (t.includes(k.title) || k.content.split(/[，。、]/).some((seg) => seg && t.includes(seg)))) {
      matched.push(k);
    }
  }
  // 关键词补充匹配
  const KW = ['面交', '见面', '转账', '定金', '先付', '扫码', '链接', '便宜', '急出', '微信', '私下', '手机号', '身份证', '宿舍', '学生证'];
  const hitKw = KW.filter((k) => t.includes(k));
  if (hitKw.length > 0) {
    for (const k of SAFETY_KNOWLEDGE) {
      if (!matched.includes(k) && hitKw.some((kw) => k.content.includes(kw) || k.title.includes(kw))) matched.push(k);
    }
  }

  const parts = [];
  parts.push('【交易风险分析】以下仅基于项目内校园二手交易安全知识库给出建议，不能鉴别商品真伪，也不能保证交易安全。');
  parts.push(`已分析文本：${text.slice(0, 200)}${text.length > 200 ? '…' : ''}`);
  if (matched.length === 0) {
    parts.push('未匹配到明显风险关键词。仍建议：校内公共场所当面交易、先验货再付款。');
  } else {
    parts.push('相关安全提示：');
    for (const k of matched) parts.push(`• 【${k.title}】${k.content}`);
  }
  parts.push('最终交易决策请由你自行判断，如觉可疑请终止交易。');
  return { content: parts.join('\n'), products: [] };
}

// ---- 工具 5: draft_listing ----
function draftListing(args, ctx) {
  const title = str(args?.title, 100);
  const category = validCategory(args?.category) ? args.category : undefined;
  const condition = validCondition(args?.condition) ? args.condition : undefined;
  const location = str(args?.location, 100);
  const features = Array.isArray(args?.features) ? args.features.map((f) => str(f, 100)).filter(Boolean).slice(0, 8) : [];
  const priceHint = num(args?.expectedPrice);

  if (!title && !features.length) return { error: '请至少提供 title 或 features 以生成草稿' };

  const parts = [];
  if (title) parts.push(title);
  const segs = [];
  if (category) segs.push(`分类：${category}`);
  if (condition) segs.push(`成色：${condition}（请卖家自行确认，本草稿不代为保证）`);
  if (location) segs.push(`校内自提地点：${location}`);
  if (priceHint !== undefined) segs.push(`期望价格约 ¥${priceHint}（需卖家自行定价）`);
  if (features.length) segs.push(`特点：${features.join('；')}`);
  parts.push(segs.join('，'));
  parts.push('【草稿说明】本描述由 AI 根据你提供的信息生成，不得捏造成色、保修或认证。发布前请卖家核对所有信息，确认无误后自行发布。本工具不代替你发布。');

  return {
    content: parts.join('\n'),
    products: []
  };
}

// ---- 工具表 ----
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: '在平台真实数据库中检索在售商品。可按关键词、分类、价格区间、成色筛选。设置 inherit=true 可在上一次筛选基础上追加条件（用于"再便宜点""只要教材"等追问）。排除已下架商品。',
      parameters: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: '关键词，匹配标题和描述' },
          category: { type: 'string', enum: CATEGORIES, description: '分类' },
          minPrice: { type: 'number', description: '最低价格（元）' },
          maxPrice: { type: 'number', description: '最高价格（元）' },
          condition: { type: 'string', enum: CONDITIONS, description: '成色' },
          limit: { type: 'integer', description: '返回数量，1-30，默认 10' },
          inherit: { type: 'boolean', description: '是否继承上一次筛选条件' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_product',
      description: '按 ID 获取单个商品的真实信息，避免编造商品、价格和库存。',
      parameters: {
        type: 'object',
        properties: { productId: { type: 'integer', description: '商品 ID' } },
        required: ['productId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'suggest_price',
      description: '基于平台同类在售商品给出参考价格区间。返回样本数、最低/中位/平均/最高价与不确定性说明。数据少时如实说明。不是全网成交价，也不是鉴定结果。',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: CATEGORIES },
          keyword: { type: 'string' },
          productId: { type: 'integer', description: '若提供则取该商品的分类与标题作为参考依据' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_trade_risk',
      description: '对用户提供的交易文本做风险分析，参考项目内校园二手交易安全知识库。不声称能鉴别真伪或保证安全。',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string', description: '待分析的文本，例如对方说辞或交易描述' } },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'draft_listing',
      description: '根据用户提供的信息生成商品描述草稿。不得捏造成色、保修或认证，不直接代用户发布。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          condition: { type: 'string', enum: CONDITIONS },
          location: { type: 'string' },
          expectedPrice: { type: 'number' },
          features: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
];

const HANDLERS = {
  search_products: searchProducts,
  get_product: getProduct,
  suggest_price: suggestPrice,
  check_trade_risk: checkTradeRisk,
  draft_listing: draftListing
};

export function executeTool(name, args, ctx) {
  if (!Object.hasOwn(HANDLERS, name)) return { error: `未知工具：${name}` };
  const handler = HANDLERS[name];
  try {
    if (!args || typeof args !== 'object' || Array.isArray(args)) return { error: '工具参数必须是对象' };
    const schema = TOOL_DEFINITIONS.find(t => t.function.name === name).function.parameters;
    for (const key of schema.required || []) if (args[key] === undefined) return { error: `缺少参数：${key}` };
    for (const [key, value] of Object.entries(args)) {
      const rule = schema.properties[key];
      if (!rule) return { error: `不支持的参数：${key}` };
      if (value === undefined) continue;
      if (rule.type === 'array') {
        if (!Array.isArray(value) || value.length > 8 || value.some(v => typeof v !== 'string' || v.length > 100)) return { error: `${key} 必须是最多8条短文本的数组` };
      } else if (rule.type === 'integer') {
        if (!Number.isSafeInteger(value) || value < 1 || (key === 'limit' && value > 30)) return { error: `${key} 必须是范围内的正整数` };
      } else if (rule.type === 'number') {
        if (typeof value !== 'number' || !Number.isFinite(value) || yuanToCents(value) === null) return { error: `${key} 必须是非负且最多两位小数的金额` };
      } else if (typeof value !== rule.type) return { error: `${key} 类型不正确` };
      if (rule.enum && !rule.enum.includes(value)) return { error: `${key} 不在允许范围内` };
      if (typeof value === 'string' && value.length > (key === 'text' ? 1000 : 100)) return { error: `${key} 过长` };
    }
    const r = handler(args || {}, ctx);
    return r;
  } catch (e) {
    return { error: `工具 ${name} 执行异常：${e.message}` };
  }
}

export { productCard, detailCard };
