import {existsSync, readFileSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {readdir} from 'node:fs/promises';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTIONS_DIR = path.join(ROOT, 'netlify', 'functions');
const DEV_PORT = Number(process.env.DEV_PORT || 8888);
const DOCUSAURUS_PORT = Number(process.env.DOCUSAURUS_PORT || 3000);

// Node 的 fetch 默认不走 HTTP(S)_PROXY，而 NODE_USE_ENV_PROXY 只能在进程启动时生效，故经代理时自动重启一次。
const PROXY_ENV =
  process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (PROXY_ENV && process.env.NODE_USE_ENV_PROXY !== '1') {
  const child = spawn(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: {...process.env, NODE_USE_ENV_PROXY: '1'},
  });
  child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
  await new Promise(() => {});
}

function loadEnvFile() {
  for (const filename of ['.env.local', '.env']) {
    const file = path.join(ROOT, filename);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (/^\s*(#|$)/.test(line)) continue;
      const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  }
}

loadEnvFile();

// 本地模拟：强制本地内容目录、开发登录与站点来源，保证在没有 Netlify 上下文时可用。
process.env.CONTEXT ||= 'dev';
process.env.CONSOLE_DEV_ADMIN ||= '1';
process.env.GITHUB_OAUTH_PUBLIC_ORIGIN ||= `http://localhost:${DEV_PORT}`;
process.env.LOCAL_CONTENT_DIR ||= path.join(ROOT, '.local-blobs');

function patternMatches(pattern, pathname) {
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return pathname === pattern.slice(0, -2) || pathname.startsWith(prefix);
  }
  return pathname === pattern;
}

async function loadFunctions() {
  const files = (await readdir(FUNCTIONS_DIR)).filter((name) => name.endsWith('.mjs'));
  const routes = [];
  for (const file of files) {
    const name = file.replace(/\.mjs$/, '');
    const module = await import(pathToFileURL(path.join(FUNCTIONS_DIR, file)).href);
    const handler = module.default;
    if (typeof handler !== 'function') continue;
    const patterns = module.config?.path
      ? (Array.isArray(module.config.path) ? module.config.path : [module.config.path])
      : [];
    routes.push({name, handler, patterns});
  }
  return routes;
}

function matchFunction(routes, pathname) {
  const direct = /^\/\.netlify\/functions\/([^/]+)/.exec(pathname);
  if (direct) {
    const found = routes.find((route) => route.name === direct[1]);
    if (found) return found;
  }
  return routes.find((route) => route.patterns.some((pattern) => patternMatches(pattern, pathname))) || null;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function waitFor(target, timeoutMs = 120000) {
  const started = Date.now();
  return new Promise((resolve) => {
    const attempt = () => {
      const request = http.get(target, (response) => {
        response.resume();
        resolve(true);
      });
      request.on('error', () => {
        if (Date.now() - started > timeoutMs) resolve(false);
        else setTimeout(attempt, 500);
      });
    };
    attempt();
  });
}

async function main() {
  const routes = await loadFunctions();

  const docusaurus = spawn('npx', ['docusaurus', 'start', '--host', '127.0.0.1', '--port', String(DOCUSAURUS_PORT)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  docusaurus.on('exit', (code) => {
    console.error(`Docusaurus 已退出（退出码 ${code}）。`);
    process.exit(code ?? 0);
  });

  await waitFor(`http://127.0.0.1:${DOCUSAURUS_PORT}/`);

  const server = http.createServer(async (req, res) => {
    const pathname = new URL(req.url, `http://localhost:${DEV_PORT}`).pathname;
    const fn = pathname.startsWith('/api/') || pathname.startsWith('/.netlify/functions/')
      ? matchFunction(routes, pathname)
      : null;

    if (fn) {
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
          else if (value != null) headers.set(key, value);
        }
        const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
        const request = new Request(`http://localhost:${DEV_PORT}${req.url}`, {
          method: req.method,
          headers,
          body,
        });
        const response = await fn.handler(request);
        res.statusCode = response.status;
        const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'set-cookie') return;
          try {
            res.setHeader(key, value);
          } catch {}
        });
        if (cookies.length) res.setHeader('set-cookie', cookies);
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch (error) {
        console.error(`[dev-server] ${fn.name} 处理失败：`, error);
        res.statusCode = 500;
        res.end(JSON.stringify({success: false, message: String(error?.message || error)}));
      }
      return;
    }

    const proxy = http.request({
      host: '127.0.0.1',
      port: DOCUSAURUS_PORT,
      path: req.url,
      method: req.method,
      headers: {...req.headers, host: `localhost:${DOCUSAURUS_PORT}`},
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxy.on('error', () => {
      res.statusCode = 502;
      res.end('Docusaurus 开发服务器暂时不可用。');
    });
    req.pipe(proxy);
  });

  server.on('upgrade', (req, socket, head) => {
    const proxy = http.request({
      host: '127.0.0.1',
      port: DOCUSAURUS_PORT,
      path: req.url,
      method: 'GET',
      headers: {...req.headers, host: `localhost:${DOCUSAURUS_PORT}`},
    });
    proxy.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      const headerLines = Object.entries(proxyRes.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\r\n');
      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headerLines}\r\n\r\n`);
      if (proxyHead?.length) proxySocket.unshift(proxyHead);
      if (head?.length) socket.unshift(head);
      proxySocket.pipe(socket).pipe(proxySocket);
    });
    proxy.on('error', () => socket.destroy());
    proxy.end();
  });

  server.listen(DEV_PORT, () => {
    console.log('');
    console.log(`本地模拟已就绪：http://localhost:${DEV_PORT}/`);
    console.log(`后台入口：http://localhost:${DEV_PORT}/admin （已启用开发登录，无需 GitHub OAuth）`);
    console.log(`文章页：http://localhost:${DEV_PORT}/notes`);
    console.log(`内容目录：${process.env.LOCAL_CONTENT_DIR}`);
    console.log('');
  });
}

await main();
