#!/usr/bin/env node
// Pixiv RefreshToken 导出脚本（本地手动登录）
//
// 流程（Pixiv 官方 App 公开使用的 OAuth PKCE）：
//   1. 本脚本生成 code_verifier / code_challenge，并打印登录网址；
//   2. 你在浏览器里手动登录 Pixiv 账号；
//   3. 登录成功后页面会跳转到 pixiv://account/login?code=xxx（打不开属正常），
//      把地址栏里的整段链接或其中的 code 复制回本脚本；
//   4. 脚本用 code 换取 access_token / refresh_token，并写入 .pixiv-token.json。
//
// 说明：仅用于导出你本人账号的令牌，请遵守 Pixiv 服务条款，勿分享 refresh_token。
// 若网络无法直连 Pixiv，可先设置代理：export HTTPS_PROXY=http://127.0.0.1:端口
//
// 用法：
//   node scripts/pixiv-login.mjs               # 交互式，自动打开浏览器
//   node scripts/pixiv-login.mjs --print-only  # 只打印登录网址
//   node scripts/pixiv-login.mjs --code=xxxxx  # 直接传入回调 code

import {createHash, randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_FILE = path.join(ROOT, '.pixiv-token.json');

// Pixiv 官方 App 内置客户端凭据（公开常量），可用环境变量覆盖。
const CLIENT_ID = process.env.PIXIV_CLIENT_ID || 'MOBrBDS8blbauoSck0ZfDbtuzpyT';
const CLIENT_SECRET = process.env.PIXIV_CLIENT_SECRET || 'lsACyCD94FhDUtGTXi3QzcFE2uU1hqtDaKeqrdwj';

const BASE_URL = 'https://app-api.pixiv.net';
const OAUTH_URL = 'https://oauth.secure.pixiv.net';
const REDIRECT_URI = `${BASE_URL}/web/v1/users/auth/pixiv/callback`;
const APP_HEADERS = {
  'App-OS': 'android',
  'App-OS-Version': '15',
  'App-Version': '6.180.0',
  'Accept-Language': 'zh-CN',
  'User-Agent': 'PixivAndroidApp/6.180.0 (Android 15; Pixel 9)',
};

function base64url(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createPkce() {
  const codeVerifier = base64url(randomBytes(64));
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());
  return {codeVerifier, codeChallenge};
}

function buildLoginUrl(codeChallenge) {
  const params = new URLSearchParams({
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    client: 'pixiv-android',
  });
  return `${BASE_URL}/web/v1/login?${params.toString()}`;
}

// 用 curl 发请求：部分环境下 Node fetch/undici 会被 Pixiv 拒绝，curl 更稳。
function curlPost(url, form) {
  return new Promise((resolve, reject) => {
    const args = [
      '-sS', '--max-time', '30',
      '-X', 'POST', url,
      '-H', 'Content-Type: application/x-www-form-urlencoded',
    ];
    for (const [key, value] of Object.entries(APP_HEADERS)) args.push('-H', `${key}: ${value}`);
    args.push('--data', new URLSearchParams(form).toString());

    const proc = spawn('curl', args);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `curl 退出码 ${code}`));
    });
  });
}

async function exchangeCode(code, codeVerifier) {
  const raw = await curlPost(`${OAUTH_URL}/auth/token`, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    code_verifier: codeVerifier,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    include_policy: 'true',
  });
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`Pixiv 返回了非 JSON 响应：${raw.slice(0, 300)}`);
  }
  const auth = payload.response;
  if (!auth || !auth.refresh_token) {
    throw new Error(`换取 token 失败：${payload.error || payload.message || raw.slice(0, 300)}`);
  }
  return auth;
}

function extractCode(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  const matched = /[?&]code=([^&\s]+)/.exec(text);
  if (matched) return decodeURIComponent(matched[1]);
  // 直接粘贴的 code 形如 "xxxxx-xxxxxxxxxxxx"
  if (/^[A-Za-z0-9._~-]+$/.test(text)) return text;
  return null;
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
  try {
    const proc = spawn(cmd, [url], {stdio: 'ignore', detached: true, shell: platform === 'win32'});
    proc.on('error', () => {});
    proc.unref();
  } catch {
    // 打不开就算了，用户可以手动复制网址
  }
}

function ask(query) {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  return new Promise((resolve) => rl.question(query, (answer) => { rl.close(); resolve(answer); }));
}

function parseArgs(argv) {
  const out = {printOnly: false, code: ''};
  for (const arg of argv) {
    if (arg === '--print-only') out.printOnly = true;
    else if (arg.startsWith('--code=')) out.code = arg.slice('--code='.length);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const {codeVerifier, codeChallenge} = createPkce();
  const loginUrl = buildLoginUrl(codeChallenge);

  console.log('\n=== Pixiv 登录（OAuth PKCE）===\n');
  console.log('登录网址：\n', loginUrl, '\n');

  if (args.printOnly) {
    console.log('（--print-only：未进行换取，code_verifier 已丢弃，请重新运行完成登录）\n');
    return;
  }

  console.log('正在尝试打开浏览器……如未打开请手动复制上面的网址。');
  openBrowser(loginUrl);
  console.log('登录成功后页面会跳转到 pixiv://account/login?code=... （打不开属正常），');
  console.log('请复制地址栏整段链接或其中的 code。\n');

  let code = args.code ? extractCode(args.code) : null;
  while (!code) {
    const answer = await ask('粘贴回调链接或 code：');
    code = extractCode(answer);
    if (!code) console.log('未能识别 code，请重试。');
  }

  console.log('\n正在用 code 换取 token……');
  const auth = await exchangeCode(code, codeVerifier);

  const record = {
    clientId: CLIENT_ID,
    refreshToken: auth.refresh_token,
    accessToken: auth.access_token,
    expiresIn: auth.expires_in,
    user: auth.user ? {id: auth.user.id, name: auth.user.name, account: auth.user.account} : null,
    obtainedAt: new Date().toISOString(),
  };
  writeFileSync(TOKEN_FILE, `${JSON.stringify(record, null, 2)}\n`, {mode: 0o600});

  console.log('\n✅ 登录成功！');
  if (record.user) console.log(`账号：${record.user.name}（id ${record.user.id}）`);
  console.log(`令牌已写入：${path.relative(ROOT, TOKEN_FILE)}（已加入 .gitignore，请勿提交/分享）\n`);
  console.log('下一步：把 refresh_token 配到 Netlify 环境变量，即可启用 P站美图榜：');
  console.log('  PIXIV_REFRESH_TOKEN =', auth.refresh_token.slice(0, 12) + '…（完整值见上述文件）');
  console.log('  PIXIV_CLIENT_ID     = （可选，默认使用官方 App 常量，可留空）\n');
}

main().catch((error) => {
  console.error('\n❌ 登录失败：', error instanceof Error ? error.message : String(error));
  console.error('提示：Pixiv 可能需要可直连的网络（或设置 HTTPS_PROXY 后再试）。\n');
  process.exit(1);
});
