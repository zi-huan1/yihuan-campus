import { mkdirSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import config from './config.js';

mkdirSync(config.logsDir, { recursive: true });
const logFile = resolve(config.logsDir, 'server.log');

function fmt(level, msg, extra) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level}] ${msg}`;
  return extra ? `${base} ${JSON.stringify(extra)}` : base;
}

export const logger = {
  info(msg, extra) { const l = fmt('INFO', msg, extra); console.log(l); appendFileSync(logFile, l + '\n'); },
  warn(msg, extra) { const l = fmt('WARN', msg, extra); console.warn(l); appendFileSync(logFile, l + '\n'); },
  error(msg, extra) { const l = fmt('ERROR', msg, extra); console.error(l); appendFileSync(logFile, l + '\n'); }
};