import express from 'express';
import cookieParser from 'cookie-parser';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { config } from './auth.js';
import { getUserBySession, sameOrigin } from './auth.js';
import { logger } from './logger.js';
import { getMode } from './ai/agent.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import uploadRoutes from './routes/upload.js';
import aiRoutes from './routes/ai.js';
import { deleteUpload } from './routes/upload.js';

const app = express();
app.disable('x-powered-by');

app.use(cookieParser(config.sessionSecret));

// 预加载登录用户（不强制登录），供商品详情等判断是否展示联系信息
app.use((req, res, next) => {
  req.sessionId = req.cookies?.sid || null;
  req.user = getUserBySession(req.sessionId);
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOrigin(req)) return res.status(403).json({ error: '同源校验失败' });
  next();
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, mode: getMode(), aiConfigured: config.isAiConfigured(), time: Date.now() });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ai', aiRoutes);

// 上传图片静态访问
app.use('/uploads', express.static(config.uploadsDir, { maxAge: '7d', fallthrough: true }));

// 生产模式托管前端构建产物
const distDir = resolve(config.projectRoot, 'client/dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: '1d' }));
  app.get(/^(?!\/api|\/uploads).*/, (req, res) => {
    res.sendFile(resolve(distDir, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.type('text/plain; charset=utf-8').send(
      '易换校园后端已启动。前端尚未构建（client/dist 不存在）。开发模式请启动 Vite 开发服务器；生产模式请先在 client 目录执行 npm run build。'
    );
  });
}

// 统一错误处理
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));
app.use((err, req, res, next) => {
  logger.error('未捕获错误', { msg: err.message, path: req.path });
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '服务器内部错误' });
});

// 删除商品时清理图片（路由内已返回 deletedImage，这里仅占位说明）
export { deleteUpload };

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    logger.info('易换校园后端已启动', {
      port: config.port,
      mode: getMode(),
      aiConfigured: config.isAiConfigured()
    });
    console.log(`易换校园后端已启动：http://localhost:${config.port}`);
    console.log(`AI 模式：${getMode()}${getMode() === 'offline' ? '（离线演示模式：未接入真实大模型）' : ''}`);
  });
}

export default app;
