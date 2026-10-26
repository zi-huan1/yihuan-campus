import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createServer } from 'node:http';

// 隔离数据库，测试不访问或删除演示站点的商品和用户。
const scratch = process.env.TEST_ARTIFACT_DIR || tmpdir();
mkdirSync(scratch, { recursive: true });
const directory = mkdtempSync(join(scratch, 'yihuan-test-'));
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = join(directory, 'data');
process.env.UPLOADS_DIR = join(directory, 'uploads');
process.env.LOGS_DIR = join(directory, 'logs');
const { default: config } = await import('../server/src/config.js');
const { default: app } = await import('../server/src/index.js');
const { default: db } = await import('../server/src/db.js');
const { executeTool } = await import('../server/src/ai/tools.js');
config.aiBaseUrl = ''; config.aiApiKey = ''; config.aiModel = '';
const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
after(async () => { await new Promise(r => server.close(r)); db.close(); });

function client() {
  let cookie = '';
  return async (path, method = 'GET', body, headers = {}) => {
    const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body && !(body instanceof Buffer) ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body instanceof Buffer ? body : body ? JSON.stringify(body) : undefined });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await response.json();
    return { status: response.status, data, headers: response.headers };
  };
}
const alice = client(), bob = client(), anonymous = client();
let productId, conversationId;
const listing = { title: '自动检查用教材', description: '测试数据，不是真实学生商品。', priceYuan: '19.99', category: '教材', condition: '九成新', location: '校内公共区域' };

test('公开列表包含20件明确标记的演示商品，无密码和联系资料', async () => {
  const result = await anonymous('/api/products'); assert.equal(result.status, 200); assert.equal(result.data.items.length, 20);
  assert.ok(result.data.items.every(p => p.isDemo && !p.sellerContactNote && !p.password_hash));
});
test('未登录写入被拒绝；两个普通账号能独立注册，cookie 为 HttpOnly', async () => {
  assert.equal((await anonymous('/api/products', 'POST', listing)).status, 401);
  const a = await alice('/api/auth/register', 'POST', { username: 'test_alice', password: 'test-password', displayName: '测试甲' });
  assert.equal(a.status, 200); assert.match(a.headers.get('set-cookie'), /HttpOnly/i);
  assert.equal((await bob('/api/auth/register', 'POST', { username: 'test_bob', password: 'test-password' })).status, 200);
});
test('价格按分保存，发布后能检索，非法金额和跨域写入被拒绝', async () => {
  for (const invalid of ['-1', '0', '0.009', '9999999999999', 'NaN']) assert.equal((await alice('/api/products', 'POST', { ...listing, priceYuan: invalid })).status, 400);
  assert.equal((await alice('/api/products', 'POST', listing, { Origin: 'https://invalid.example' })).status, 403);
  const posted = await alice('/api/products', 'POST', listing); assert.equal(posted.status, 200); productId = posted.data.id;
  const found = await anonymous('/api/products?q=' + encodeURIComponent('自动检查用教材'));
  assert.equal(found.data.items.length, 1); assert.equal(found.data.items[0].priceYuan, '19.99'); assert.equal(found.data.items[0].id, productId);
});
test('越权编辑、下架、删除被拒绝，收藏可增可删', async () => {
  assert.equal((await bob(`/api/products/${productId}`, 'PUT', { priceYuan: 1 })).status, 403);
  assert.equal((await bob(`/api/products/${productId}/offsale`, 'POST', {})).status, 403);
  assert.equal((await bob(`/api/products/${productId}`, 'DELETE')).status, 403);
  assert.equal((await bob(`/api/products/favorites/${productId}`, 'POST', {})).status, 200);
  assert.equal((await bob('/api/products/favorites/list')).data.items.length, 1);
  await bob(`/api/products/favorites/${productId}`, 'DELETE');
  assert.equal((await bob('/api/products/favorites/list')).data.items.length, 0);
});
test('上传校验真实文件头，并能保存有效PNG', async () => {
  assert.equal((await alice('/api/upload/image', 'POST', Buffer.from('<script>invalid</script>'), { 'Content-Type': 'application/octet-stream' })).status, 400);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
  const result = await alice('/api/upload/image', 'POST', png, { 'Content-Type': 'application/octet-stream' });
  assert.equal(result.status, 200); assert.match(result.data.file, /^[a-f0-9]{32}\.png$/);
});
test('离线模式如实标记，查高数教材返回真实商品，追问能继承预算', async () => {
  const first = await alice('/api/ai/chat', 'POST', { message: '帮我找30元以内的高数教材' });
  assert.equal(first.status, 200); assert.equal(first.data.mode, 'offline'); assert.match(first.data.reply, /离线演示/);
  assert.ok(first.data.productCards.some(p => p.title.includes('高等数学'))); conversationId = first.data.conversationId;
  const second = await alice('/api/ai/chat', 'POST', { message: '再便宜点', conversationId });
  assert.equal(second.status, 200); assert.equal(second.data.toolCalls[0].args.maxPrice, 24);
  assert.ok(second.data.productCards.every(p => Number(p.priceYuan) <= 24 && p.title.includes('高等数学')));
});
test('对话归属受保护，新对话不继承旧筛选，风险提示匹配外部链接', async () => {
  assert.equal((await bob('/api/ai/chat', 'POST', { message: '查看上一条', conversationId })).status, 403);
  const separate = await alice('/api/ai/chat', 'POST', { message: '帮我找数码' });
  assert.notEqual(separate.data.conversationId, conversationId); assert.ok(separate.data.productCards.every(p => p.category === '数码'));
  const risk = await alice('/api/ai/chat', 'POST', { message: '卖家让我点击链接先付款，安全吗？' });
  assert.equal(risk.data.toolCalls[0].name, 'check_trade_risk'); assert.match(risk.data.reply, /链接/);
});
test('下架商品既不在列表中，也不被助手推荐；工具严格拒绝非法参数', async () => {
  await alice(`/api/products/${productId}/offsale`, 'POST', {});
  assert.equal((await anonymous('/api/products?q=' + encodeURIComponent('自动检查用教材'))).data.items.length, 0);
  const ctx = { verifiedProducts: new Map(), lastSearchFilters: null };
  assert.ok(executeTool('search_products', { maxPrice: '乱填' }, ctx).error);
  assert.ok(executeTool('search_products', { maxPrice: -1 }, ctx).error);
  assert.ok(executeTool('get_product', { productId: 0 }, ctx).error);
  assert.ok(executeTool('unknown', {}, ctx).error);
  assert.equal(executeTool('get_product', { productId }, ctx).products.length, 0);
});
test('mock模型验证实际HTTP tools循环、tool_call_id、错误参数反馈与多轮上下文（不是真实模型联调）', async () => {
  const calls = [];
  const mock = createServer(async (req, res) => {
    let text = ''; for await (const chunk of req) text += chunk;
    const input = JSON.parse(text); calls.push(input);
    assert.equal(req.url, '/v1/chat/completions'); assert.equal(req.headers.authorization, 'Bearer test-key-only');
    const tool = input.messages.findLast(m => m.role === 'tool');
    let message;
    if (!tool) message = { role: 'assistant', content: null, tool_calls: [{ id: 'invalid-1', type: 'function', function: { name: 'search_products', arguments: JSON.stringify({ maxPrice: -5 }) } }] };
    else if (tool.tool_call_id === 'invalid-1') {
      assert.match(tool.content, /error/);
      message = { role: 'assistant', content: null, tool_calls: [{ id: 'valid-2', type: 'function', function: { name: 'search_products', arguments: JSON.stringify({ category: '教材', maxPrice: 15 }) } }] };
    } else {
      assert.equal(tool.tool_call_id, 'valid-2'); assert.match(tool.content, /在售商品/);
      message = { role: 'assistant', content: '已根据数据库找到预算内教材。' };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message }] }));
  });
  mock.listen(0, '127.0.0.1'); await once(mock, 'listening');
  config.aiBaseUrl = `http://127.0.0.1:${mock.address().port}/v1`; config.aiApiKey = 'test-key-only'; config.aiModel = 'mock-model';
  try {
    const result = await alice('/api/ai/chat', 'POST', { message: '帮我查询教材' });
    assert.equal(result.status, 200); assert.equal(result.data.mode, 'online'); assert.equal(calls.length, 3);
    assert.equal(result.data.toolCalls[0].ok, false); assert.equal(result.data.toolCalls[1].ok, true);
    assert.ok(result.data.productCards.length > 0); assert.ok(result.data.productCards.every(p => Number(p.priceYuan) <= 15));
    assert.ok(calls[0].tools.some(t => t.function.name === 'search_products'));
  } finally { await new Promise(r => mock.close(r)); config.aiBaseUrl = ''; config.aiApiKey = ''; config.aiModel = ''; }
});
test('模型接口失败明确报错，不冒充成功、不静默转为离线结果', async () => {
  const mock = createServer((req, res) => { res.writeHead(401); res.end('invalid credentials'); }); mock.listen(0, '127.0.0.1'); await once(mock, 'listening');
  config.aiBaseUrl = `http://127.0.0.1:${mock.address().port}`; config.aiApiKey = 'test-key-only'; config.aiModel = 'mock';
  try { const result = await alice('/api/ai/chat', 'POST', { message: '找教材' }); assert.equal(result.status, 502); assert.match(result.data.error, /真实模型调用失败/); assert.equal(result.data.productCards, undefined); }
  finally { await new Promise(r => mock.close(r)); config.aiBaseUrl = ''; config.aiApiKey = ''; config.aiModel = ''; }
});
