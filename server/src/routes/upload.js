import { Router } from 'express';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import config from '../config.js';
import { requireAuth } from '../auth.js';
import { logger } from '../logger.js';

const router = Router();
mkdirSync(config.uploadsDir, { recursive: true });

const SIGNATURES = {
  jpg: [[0xFF, 0xD8, 0xFF]],
  png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  webp: [[0x52, 0x49, 0x46, 0x46]]
};

export function detectType(buf) {
  for (const [ext, sigs] of Object.entries(SIGNATURES)) {
    for (const sig of sigs) {
      if (buf.length >= sig.length && sig.every((b, i) => buf[i] === b)) {
        if (ext === 'webp') {
          if (buf.length >= 12 && buf.slice(8, 12).toString('ascii') === 'WEBP') return ext;
        } else {
          return ext;
        }
      }
    }
  }
  return null;
}

export function deleteUpload(name) {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(name)) return;
  const safe = resolve(config.uploadsDir, name);
  if (safe.startsWith(config.uploadsDir) && existsSync(safe)) {
    try { unlinkSync(safe); } catch { /* ignore */ }
  }
}

router.post('/image', requireAuth, async (req, res) => {
  const chunks = [];
  let total = 0;
  let aborted = false;
  await new Promise((resolveP) => {
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > config.uploadMaxBytes) {
        aborted = true;
        req.destroy();
        resolveP();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', resolveP);
    req.on('error', resolveP);
  });
  if (aborted) return res.status(413).json({ error: `图片过大，上限 ${Math.floor(config.uploadMaxBytes / 1024 / 1024)}MB` });
  const buf = Buffer.concat(chunks);
  if (buf.length === 0) return res.status(400).json({ error: '未收到图片数据' });
  const ext = detectType(buf);
  if (!ext) return res.status(400).json({ error: '仅支持 jpg/png/webp，已校验真实文件头' });
  const name = randomBytes(16).toString('hex') + '.' + ext;
  const safe = resolve(config.uploadsDir, name);
  if (!safe.startsWith(config.uploadsDir)) return res.status(400).json({ error: '路径非法' });
  writeFileSync(safe, buf);
  logger.info('图片上传', { user: req.user.id, file: name, bytes: buf.length });
  res.json({ file: name });
});

export default router;