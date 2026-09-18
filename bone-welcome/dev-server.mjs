// 「白骨迎宾道」本地开发服务器 —— 零依赖静态服务
// 用法: npm run dev -- --port 7100 --host 0.0.0.0
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(fileURLToPath(new URL('.', import.meta.url))).replace(/[\\/]+$/, '');
const args = process.argv.slice(2);
function arg(name, dflt) {
  const i = args.findIndex(a => a === `--${name}`);
  if (i >= 0 && args[i + 1]) return args[i + 1];
  const eq = args.find(a => a.startsWith(`--${name}=`));
  return eq ? eq.split('=').slice(1).join('=') : dflt;
}
const port = Number(process.env.PORT || arg('port', 7100));
const host = arg('host', '0.0.0.0');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (p === '/') p = '/index.html';
    const file = normalize(join(root, p));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403);
      return res.end('forbidden');
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(port, host, () => {
  console.log(`白骨迎宾道 dev server → http://localhost:${port}/`);
});
