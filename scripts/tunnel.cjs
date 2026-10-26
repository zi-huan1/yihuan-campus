// 公网穿透启动：本地 server + cloudflared tunnel，输出公网网址。
const { spawn } = require('node:child_process');
const { existsSync, createWriteStream, renameSync, unlinkSync } = require('node:fs');
const { resolve, join } = require('node:path');
const https = require('node:https');
const root = resolve(__dirname, '..');
process.chdir(root);

const TUNNEL_URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd.exe';
const CF_PATH = join(root, 'cloudflared.exe');

function fail(msg) { console.error('\n启动未完成：' + msg); process.exitCode = 1; }

function download(url, dest) {
  return new Promise((resolveP, reject) => {
    const tmp = dest + '.tmp';
    const file = createWriteStream(tmp);
    const get = (u, depth = 0) => {
      if (depth > 8) return reject(new Error('重定向次数过多'));
      https.get(u, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return get(res.headers.location, depth + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('下载失败 HTTP ' + res.statusCode)); }
        res.pipe(file);
        file.on('finish', () => file.close(() => { renameSync(tmp, dest); resolveP(); }));
        file.on('error', reject);
      }).on('error', reject);
    };
    get(url);
  });
}

async function main() {
  const config = (await import('../server/src/config.js')).default;
  const port = config.port;
  const url = `http://localhost:${port}`;

  if (!existsSync(CF_PATH)) {
    console.log('首次运行正在下载 cloudflared（约 20MB，需要网络，请稍候）……');
    try {
      await download(TUNNEL_URL, CF_PATH);
    } catch (e) {
      try { unlinkSync(CF_PATH + '.tmp'); } catch {}
      return fail('cloudflared 下载失败：' + e.message + '\n可手动从 ' + TUNNEL_URL + ' 下载 cloudflared.exe 放到项目根目录后重试。');
    }
    console.log('cloudflared 下载完成。');
  }

  console.log('\n正在启动易换校园后端……');
  const nodeFlags = process.env.NODE_FLAGS ? process.env.NODE_FLAGS.split(/\s+/).filter(Boolean) : [];
  const server = spawn(process.execPath, [...nodeFlags, join(root, 'server/src/index.js')], { cwd: root, stdio: 'inherit', windowsHide: true });
  server.once('error', e => fail(e.message));
  server.once('exit', code => { if (!process.exitCode) process.exitCode = code ?? 1; });

  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(s => setTimeout(s, 500));
  }
  if (!ready) { server.kill(); return fail('本地后端未能在 20 秒内启动，请先确认 启动平台.cmd 能正常打开。'); }
  console.log(`本地后端已就绪：${url}`);

  console.log('\n正在开通公网访问……公网网址会显示在下方方框里，把它发给要访问的人：\n');
  const tunnel = spawn(CF_PATH, ['tunnel', '--url', url], { stdio: 'inherit', windowsHide: false });
  tunnel.once('error', e => { server.kill(); fail(e.message); });
  tunnel.once('exit', () => server.kill());

  const cleanup = () => { try { tunnel.kill(); } catch {}; try { server.kill(); } catch {}; process.exit(); };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
main().catch(e => fail(e.message));