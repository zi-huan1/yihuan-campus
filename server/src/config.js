import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));

function loadEnv() {
  const envPath = resolve(projectRoot, '.env');
  const env = {};
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
  return env;
}

const fileEnv = loadEnv();
function get(key, def = '') {
  if (process.env[key] !== undefined && process.env[key] !== '') return process.env[key];
  if (fileEnv[key] !== undefined && fileEnv[key] !== '') return fileEnv[key];
  return def;
}
function getInt(key, def) {
  const v = get(key, String(def));
  const n = Number(v);
  return Number.isInteger(n) ? n : def;
}

const config = {
  port: getInt('PORT', 3000),
  sessionSecret: get('SESSION_SECRET', 'dev-insecure-secret-change-me'),
  uploadMaxBytes: getInt('UPLOAD_MAX_BYTES', 3 * 1024 * 1024),
  aiBaseUrl: get('AI_BASE_URL', '').replace(/\/+$/, ''),
  aiApiKey: get('AI_API_KEY', ''),
  aiModel: get('AI_MODEL', ''),
  aiTimeoutMs: getInt('AI_TIMEOUT_MS', 30000),
  aiMaxRounds: getInt('AI_MAX_ROUNDS', 5),
  aiMaxMessageChars: getInt('AI_MAX_MESSAGE_CHARS', 2000),
  aiMaxHistory: getInt('AI_MAX_HISTORY', 20),
  aiRateLimitPerMin: getInt('AI_RATE_LIMIT_PER_MIN', 20),
  projectRoot,
  dataDir: resolve(projectRoot, get('DATA_DIR', 'server/data')),
  uploadsDir: resolve(projectRoot, get('UPLOADS_DIR', 'server/uploads')),
  logsDir: resolve(projectRoot, get('LOGS_DIR', 'server/logs')),
  isAiConfigured() {
    return Boolean(this.aiBaseUrl && this.aiApiKey && this.aiModel);
  }
};

export default config;
