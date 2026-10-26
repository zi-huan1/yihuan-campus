import { setTimeout as sleep } from 'node:timers/promises';

process.env.NODE_ENV = 'test';
const app = (await import('./server/src/index.js')).default;

const server = app.listen(0);
await sleep(300);
const port = server.address().port;
const base = `http://localhost:${port}`;

const results = [];
function ok(name, cond, extra = '') { results.push({ name, pass: !!cond, extra }); }

async function get(p, headers) {
  const r = await fetch(base + p, { headers });
  let body; try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body, headers: r.headers };
}
async function post(p, body, headers) {
  const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let b; try { b = await r.json(); } catch { b = null; }
  return { status: r.status, body: b, headers: r.headers };
}
async function del(p, headers) {
  const r = await fetch(base + p, { method: 'DELETE', headers });
  let b; try { b = await r.json(); } catch { b = null; }
  return { status: r.status, body: b, headers: r.headers };
}
async function put(p, body, headers) {
  const r = await fetch(base + p, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(headers || {}) }, body: JSON.stringify(body) });
  let b; try { b = await r.json(); } catch { b = null; }
  return { status: r.status, body: b, headers: r.headers };
}
function cookie(res) {
  const sc = res.headers.get('set-cookie');
  if (!sc) return '';
  const m = sc.match(/sid=([^;]+)/);
  return m ? `sid=${m[1]}` : '';
}

// 1. 健康检查
let r = await get('/api/health');
ok('健康检查 200', r.status === 200);
ok('健康检查 mode=offline', r.body?.mode === 'offline', `mode=${r.body?.mode}`);

// 2. 商品列表
r = await get('/api/products');
ok('商品列表 200', r.status === 200);
ok('演示商品 >=20', (r.body?.items?.length || 0) >= 20, `n=${r.body?.items?.length}`);
ok('分类返回', Array.isArray(r.body?.categories) && r.body.categories.length === 5);

// 3. 搜索关键词
r = await get('/api/products?q=教材');
ok('搜索教材有结果', (r.body?.items?.length || 0) > 0);
r = await get('/api/products?q=高等数学');
ok('搜索高数命中', (r.body?.items?.length || 0) >= 1);

// 4. 分类筛选
r = await get('/api/products?category=数码');
ok('分类数码全部为数码', (r.body?.items || []).every(i => i.category === '数码'));

// 5. 价格范围
r = await get('/api/products?minPrice=10&maxPrice=50');
ok('价格范围筛选', (r.body?.items || []).every(i => Number(i.priceYuan) >= 10 && Number(i.priceYuan) <= 50));

// 6. 排序
r = await get('/api/products?sort=price_asc');
const prices = (r.body?.items || []).map(i => Number(i.priceYuan));
ok('价格升序', prices.every((v, i) => i === 0 || prices[i - 1] <= v));

// 7. 商品详情（未登录，不含联系信息）
r = await get('/api/products/1');
ok('详情 200', r.status === 200);
ok('详情不含联系信息(未登录)', r.body?.sellerContactNote === undefined);

// 8. 未登录发布被拒
r = await post('/api/products', { title: '测试', description: 'x', priceYuan: '10', category: '教材', condition: '九成新', location: '图书馆' });
ok('未登录发布 401', r.status === 401);

// 9. 注册（若已存在则登录，保证可重复运行）
r = await post('/api/auth/register', { username: 'tester_smoke', password: 'pass1234', displayName: '冒烟用户' });
if (r.status === 409) r = await post('/api/auth/login', { username: 'tester_smoke', password: 'pass1234' });
ok('注册成功', r.status === 200 && !!r.body?.user, `status=${r.status} body=${JSON.stringify(r.body)}`);
const ck1 = cookie(r);
ok('注册返回 cookie', !!ck1);

// 10. 已登录发布
r = await post('/api/products', { title: '冒烟测试商品-可乐球拍', description: '冒烟用，可删除', priceYuan: '12.50', category: '运动器材', condition: '八成新', location: '体育馆' }, { Cookie: ck1 });
ok('登录发布 200', r.status === 200 && !!r.body?.id, `status=${r.status} body=${JSON.stringify(r.body)}`);
const newId = r.body?.id;

// 11. 发布后能搜到
r = await get('/api/products?q=可乐球拍');
ok('发布后可搜到', (r.body?.items || []).some(i => i.id === newId));

// 12. 金额边界：负价
r = await post('/api/products', { title: '负价', description: 'x', priceYuan: '-5', category: '教材', condition: '九成新', location: 'x' }, { Cookie: ck1 });
ok('负价被拒 400', r.status === 400);

// 13. 金额边界：三位小数
r = await post('/api/products', { title: '三位小数', description: 'x', priceYuan: '1.234', category: '教材', condition: '九成新', location: 'x' }, { Cookie: ck1 });
ok('三位小数被拒 400', r.status === 400);

// 14. 非法分类
r = await post('/api/products', { title: 'x', description: 'x', priceYuan: '10', category: '武器', condition: '九成新', location: 'x' }, { Cookie: ck1 });
ok('非法分类被拒 400', r.status === 400);

// 15. 详情登录后含联系信息
r = await get('/api/products/1', { Cookie: ck1 });
ok('登录后详情含联系信息', r.body?.sellerContactNote !== undefined);

// 16. 注册第二个用户，尝试编辑第一个用户的商品 -> 403
r = await post('/api/auth/register', { username: 'tester_smoke2', password: 'pass1234', displayName: '冒烟2' });
if (r.status === 409) r = await post('/api/auth/login', { username: 'tester_smoke2', password: 'pass1234' });
const ck2 = cookie(r);
r = await put(`/api/products/${newId}`, { title: '篡改' }, { Cookie: ck2 });
ok('跨用户编辑被拒 403', r.status === 403, `status=${r.status}`);

// 17. 下架后不再推荐
r = await post(`/api/products/${newId}/offsale`, {}, { Cookie: ck1 });
ok('下架成功', r.status === 200);
r = await get('/api/products?q=可乐球拍');
ok('下架后搜不到', !(r.body?.items || []).some(i => i.id === newId));

// 18. 收藏
r = await post('/api/products/favorites/1', {}, { Cookie: ck1 });
ok('收藏 200', r.status === 200);
r = await get('/api/products/favorites/list', { Cookie: ck1 });
ok('收藏列表含1', (r.body?.items || []).some(i => i.id === 1));

// 19. AI 模式
r = await get('/api/ai/mode');
ok('AI mode=offline', r.body?.mode === 'offline');

// 20. AI 对话（离线演示模式，需登录）
r = await post('/api/ai/chat', { message: '帮我找一本高数教材' }, { Cookie: ck1 });
ok('AI 对话 200', r.status === 200, `status=${r.status} body=${JSON.stringify(r.body).slice(0,200)}`);
ok('AI 回复含离线标注', typeof r.body?.reply === 'string' && r.body.reply.includes('离线演示模式'));
ok('AI 返回 toolCalls 数组', Array.isArray(r.body?.toolCalls));

// 21. AI 未登录被拒
r = await post('/api/ai/chat', { message: 'hi' });
ok('AI 未登录 401', r.status === 401);

// 22. AI 消息过长被拒
r = await post('/api/ai/chat', { message: 'x'.repeat(3000) }, { Cookie: ck1 });
ok('AI 消息过长 400', r.status === 400);

// 23. 对话隔离：用户2看不到用户1的历史
r = await get('/api/ai/history', { Cookie: ck2 });
ok('用户2历史为空', (r.body?.items || []).length === 0);

// 24. 登出
r = await post('/api/auth/logout', {}, { Cookie: ck1 });
ok('登出 200', r.status === 200);

// 25. 演示账号登录
r = await post('/api/auth/login', { username: 'demo_seller', password: 'demo123456' });
ok('演示卖家登录成功', r.status === 200 && !!r.body?.user?.isDemo);

// 26. 我的发布
const ckDemo = cookie(r);
r = await get('/api/products/my/list', { Cookie: ckDemo });
ok('我的发布 >=20', (r.body?.items || []).length >= 20);

// 27. 无效商品ID
r = await get('/api/products/abc');
ok('无效ID 400', r.status === 400);

// 28. 不存在商品
r = await get('/api/products/999999');
ok('不存在 404', r.status === 404);

// 输出
const passed = results.filter(x => x.pass).length;
const failed = results.filter(x => !x.pass);
console.log(`\n冒烟测试：${passed}/${results.length} 通过`);
if (failed.length) {
  console.log('失败项：');
  for (const f of failed) console.log(`  ✗ ${f.name} ${f.extra}`);
} else {
  console.log('全部通过');
}

server.close();
process.exit(failed.length ? 1 : 0);