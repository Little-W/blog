#!/usr/bin/env node
// 一键导出 Pixiv refresh_token：用 CDP 驱动 Chrome，自动捕获 302 Location 里的 code 并换取 token。
// 无需扩展、无第三方依赖、无需手动复制 code。首次运行在弹出的窗口里登录一次，之后会复用该 profile。

import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CLIENT_ID = process.env.PIXIV_CLIENT_ID || 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
const CLIENT_SECRET = process.env.PIXIV_CLIENT_SECRET || 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';
const BASE_URL = 'https://app-api.pixiv.net';
const OAUTH_URL = 'https://oauth.secure.pixiv.net/auth/token';
const REDIRECT_URI = `${BASE_URL}/web/v1/users/auth/pixiv/callback`;
const CALLBACK_PATH = '/web/v1/users/auth/pixiv/callback';
const TOKEN_FILE = path.join(ROOT, '.pixiv-token.json');
const APP_HEADERS = {
  'App-OS': 'android',
  'App-OS-Version': '15',
  'App-Version': '6.180.0',
  'Accept-Language': 'zh-CN',
  'User-Agent': 'PixivAndroidApp/6.180.0 (Android 15; Pixel 9)',
};

function parseArgs(argv) {
  const args = { port: '9333', keepOpen: false, urlOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--port') args.port = argv[++i];
    else if (token === '--profile') args.profile = argv[++i];
    else if (token === '--chrome') args.chrome = argv[++i];
    else if (token === '--keep-open') args.keepOpen = true;
    else if (token === '--url-only') args.urlOnly = true;
    else if (token === '--help' || token === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
用法：node scripts/pixiv-token.mjs [选项]

  --port <n>       CDP 调试端口（默认 9333）
  --profile <dir>  Chrome 用户数据目录（默认 <项目>/.pixiv-chrome-profile，可持久登录）
  --chrome <path>  指定 Chrome 可执行文件
  --keep-open      完成后不关闭本脚本启动的 Chrome
  --url-only       只打印登录网址（不启动浏览器）
  -h, --help       显示帮助
`);
}

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createPkce() {
  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function buildLoginUrl(challenge) {
  const params = new URLSearchParams({
    code_challenge: challenge,
    code_challenge_method: 'S256',
    client: 'pixiv-android',
  });
  return `${BASE_URL}/web/v1/login?${params.toString()}`;
}

function which(bin) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const dir of dirs) {
    const candidate = path.join(dir, bin);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function findChrome(explicit) {
  const candidates = [
    explicit,
    process.env.CHROME_PATH,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.includes('/')) {
      if (existsSync(candidate)) return candidate;
    } else {
      const found = which(candidate);
      if (found) return found;
    }
  }
  throw new Error('未找到 Chrome，请用 --chrome <路径> 指定');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function waitForCdp(port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await getJson(`http://127.0.0.1:${port}/json/version`);
    } catch (error) {
      await sleep(250);
    }
  }
  throw new Error('连接 Chrome 调试端口超时');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (message.method) {
        const handlers = this.handlers.get(message.method) || [];
        handlers.forEach((handler) => handler(message.params));
      }
    });
  }

  send(method, params = {}) {
    const id = (this.id += 1);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(handler);
  }

  close() {
    try {
      this.ws.close();
    } catch (error) {
      /* ignore */
    }
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('连接调试 WebSocket 失败')), { once: true });
  });
  return new Cdp(ws);
}

function extractCode(url) {
  const matched = /[?&]code=([^&\s]+)/.exec(url || '');
  return matched ? decodeURIComponent(matched[1]) : null;
}

function exchange(code, verifier) {
  const data = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    include_policy: 'true',
  }).toString();
  const headerArgs = [];
  for (const [key, value] of Object.entries(APP_HEADERS)) headerArgs.push('-H', `${key}: ${value}`);
  const output = execFileSync(
    'curl',
    [
      '-sS', '--max-time', '30', '-X', 'POST', OAUTH_URL,
      '-H', 'Content-Type: application/x-www-form-urlencoded',
      ...headerArgs,
      '--data', data,
    ],
    { encoding: 'utf8' },
  );
  let json;
  try {
    json = JSON.parse(output);
  } catch (error) {
    throw new Error(`换取失败：响应非 JSON：${output.slice(0, 200)}`);
  }
  if (!json.response || !json.response.refresh_token) {
    const reason = (json.errors && json.errors.system && json.errors.system.message) || json.error || '未知错误';
    throw new Error(`换取失败：${reason}`);
  }
  return json.response;
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((resolve, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  const { verifier, challenge } = createPkce();
  const loginUrl = buildLoginUrl(challenge);

  if (args.urlOnly) {
    console.log('\n登录网址：\n', loginUrl, '\n');
    console.log('（--url-only 不启动浏览器；code_verifier 未保存，需用本脚本完整流程兑换）\n');
    return 0;
  }

  const chrome = findChrome(args.chrome);
  const profile = path.resolve(args.profile || path.join(ROOT, '.pixiv-chrome-profile'));
  await mkdir(profile, { recursive: true });

  console.log(`\n启动 Chrome（profile: ${profile}）…`);
  const child = spawn(
    chrome,
    [
      `--remote-debugging-port=${args.port}`,
      `--remote-allow-origins=*`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let cdp;
  try {
    await waitForCdp(args.port);
    const targets = await getJson(`http://127.0.0.1:${args.port}/json/list`);
    const page = targets.find((target) => target.type === 'page') || targets[0];
    if (!page || !page.webSocketDebuggerUrl) throw new Error('未找到可用的浏览器标签页');

    cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');

    let resolveCode;
    let rejectCode;
    const codePromise = new Promise((resolve, reject) => {
      resolveCode = resolve;
      rejectCode = reject;
    });
    cdp.on('Network.requestWillBeSent', (params) => {
      const url = params && params.request && params.request.url;
      if (!url) return;
      if (url.startsWith('pixiv://account/login') || url.includes(CALLBACK_PATH)) {
        const code = extractCode(url);
        if (code) resolveCode(code);
      }
    });

    console.log('已打开浏览器。请在窗口里完成 Pixiv 登录（若此前登录过会自动继续）…\n');
    await cdp.send('Page.navigate', { url: loginUrl });

    const code = await withTimeout(codePromise, 5 * 60 * 1000, '等待登录超时（5 分钟）');

    console.log('已捕获授权 code，正在换取 token …');
    const auth = exchange(code, verifier);

    const user = auth.user || {};
    const record = {
      clientId: CLIENT_ID,
      refreshToken: auth.refresh_token,
      accessToken: auth.access_token,
      expiresIn: auth.expires_in,
      user: user.id ? { id: user.id, name: user.name, account: user.account } : null,
      obtainedAt: new Date().toISOString(),
    };
    await writeFile(TOKEN_FILE, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });

    console.log('\n✅ 登录成功！');
    if (record.user && record.user.name) console.log(`账号：${record.user.name}（id ${record.user.id}）`);
    console.log(`\nrefresh_token:\n${record.refreshToken}\n`);
    console.log(`令牌已写入：${path.relative(ROOT, TOKEN_FILE)}（已加入 .gitignore）`);
    console.log('下一步：把 refresh_token 配到 Netlify 环境变量 PIXIV_REFRESH_TOKEN。\n');
    return 0;
  } finally {
    if (cdp) cdp.close();
    if (!args.keepOpen) {
      try {
        child.kill();
      } catch (error) {
        /* ignore */
      }
    }
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`\n❌ ${error.message}\n`);
    process.exit(1);
  });
