// 双击启动入口：批处理只包含 ASCII，中文提示由 Node.js 输出。
const { spawnSync, spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { resolve, dirname, join } = require('node:path');
const net = require('node:net');
const root = resolve(__dirname, '..');
process.chdir(root);

function fail(message) { console.error(`\n启动未完成：${message}`); process.exitCode = 1; }
function command(args) {
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (!existsSync(npmCli)) throw new Error('找不到 Node.js 附带的 npm。请使用 Node.js 官方安装包修复安装。');
  const result = spawnSync(process.execPath, [npmCli, ...args], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} 未成功，请查看上方报错。`);
}
function portInUse(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', e => e.code === 'EADDRINUSE' ? resolve(true) : reject(e));
    probe.listen(port, () => probe.close(() => resolve(false)));
  });
}
async function main() {
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 22) throw new Error('请将 Node.js 升级到 22 或更新版本（推荐 24+）。');
  const config = (await import('../server/src/config.js')).default;
  const url = `http://localhost:${config.port}`;
  if (await portInUse(config.port)) {
    let ownServer = false;
    try {
      const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2500) });
      const body = await response.json();
      const homepage = await fetch(url, { signal: AbortSignal.timeout(2500) }).then(r => r.text());
      ownServer = body.ok === true && ['offline', 'online'].includes(body.mode) && homepage.includes('易换校园');
    } catch {}
    if (ownServer) { console.log(`\n易换校园已经运行，无需重复启动。\n浏览器打开：${url}`); return; }
    throw new Error(`端口 ${config.port} 已被其他程序占用。请检查占用程序或在 .env 中设置其他 PORT。`);
  }
  const dependencies = ['node_modules/concurrently/package.json', 'server/node_modules/express/package.json', 'server/node_modules/cookie-parser/package.json', 'client/node_modules/vite/package.json', 'client/node_modules/react/package.json', 'client/node_modules/react-dom/package.json', 'client/node_modules/@vitejs/plugin-react/package.json'];
  if (dependencies.some(path => !existsSync(join(root, path)))) {
    console.log('首次运行正在安装依赖，需要网络，请稍候……');
    command(['install']);
    command(['--prefix', 'server', 'install']);
    command(['--prefix', 'client', 'install']);
  }
  if (!existsSync(join(root, 'client/dist/index.html'))) {
    console.log('\n正在构建中文页面……');
    command(['run', 'build']);
  }
  console.log(`\n浏览器打开：${url}\n使用期间请保留这个窗口，停止服务按 Ctrl+C。\n尚未配置模型 API 时，助手为离线演示模式。\n`);
  const nodeFlags = process.env.NODE_FLAGS ? process.env.NODE_FLAGS.split(/\s+/).filter(Boolean) : [];
  const server = spawn(process.execPath, [...nodeFlags, join(root, 'server/src/index.js')], { cwd: root, stdio: 'inherit', windowsHide: true });
  server.once('error', error => fail(error.message));
  server.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 0 : 1); });
  process.on('SIGINT', () => server.kill('SIGINT'));
  (async () => {
    for (let i = 0; i < 40; i++) {
      try { if ((await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) { spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref(); return; } } catch {}
      await new Promise(s => setTimeout(s, 500));
    }
  })();
}
main().catch(error => fail(error.message));
