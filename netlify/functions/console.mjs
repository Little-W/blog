import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2026-03-10';
const SESSION_COOKIE = 'blog_admin_session';
const OAUTH_COOKIE = 'blog_admin_oauth';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const OAUTH_TTL_MS = 10 * 60 * 1000;
const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
const MAX_SOURCE_BYTES = 3 * 1024 * 1024;
const MAX_DATA_BYTES = 4 * 1024 * 1024;
const MAX_RECORDS = 20_000;
const DEFAULT_PUBLIC_ORIGIN = 'https://blog.yusen.best';

const DATASETS = Object.freeze({
  music_hq: {
    label: 'HQ 音乐',
    path: 'static/data/music_hq.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"music_hq"}',
  },
  music_sq: {
    label: 'SQ / Hi-Res 音乐',
    path: 'static/data/music_sq.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"music_sq"}',
  },
  music_tag: {
    label: '歌单标签',
    path: 'static/data/music_tag.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"music_tag"}',
  },
  mv: {
    label: 'MV 主表',
    path: 'static/data/mv.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"mv"}',
  },
  mv_bilibili: {
    label: 'MV B 站资料',
    path: 'static/data/mv_bilibili.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"mv_bilibili"}',
  },
  mv_class: {
    label: 'MV 分类',
    path: 'static/data/mv_class.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"mv_class"}',
  },
  mv_out: {
    label: 'MV 扩展资料',
    path: 'static/data/mv_out.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"mv_out"}',
  },
});

export const config = {
  path: '/api/console/*',
  preferStatic: false,
};

function responseHeaders(extra = {}) {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    ...extra,
  };
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders({
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    }),
  });
}

function fail(message, code, status = 400, details) {
  return json({success: false, code, message, ...(details ? {details} : {})}, status);
}

function requestError(message, status = 400, code = 'INVALID_REQUEST') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function redirect(location, headers = {}) {
  return new Response(null, {
    status: 302,
    headers: responseHeaders({location, ...headers}),
  });
}

function requiredEnvironment(name, minimumLength = 1) {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new Error(`Netlify 未设置 ${name}。`);
  }
  return value;
}

function repositoryConfig() {
  return {
    owner: process.env.GITHUB_REPO_OWNER?.trim() || 'Little-W',
    repo: process.env.GITHUB_REPO_NAME?.trim() || 'blog',
    branch: process.env.GITHUB_REPO_BRANCH?.trim() || 'main',
  };
}

function sessionSecret() {
  return requiredEnvironment('GITHUB_SESSION_SECRET', 32);
}

function encodeSigned(value) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeSigned(value) {
  const [payload, signature] = String(value || '').split('.');
  if (!payload || !signature) return null;
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        if (separator < 0) return [part, ''];
        return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
      }),
  );
}

function publicOrigin(request) {
  // Netlify may invoke a Function through an internal address. OAuth callback
  // URLs and browser-origin checks must use the externally visible site URL.
  const candidate = process.env.GITHUB_OAUTH_PUBLIC_ORIGIN?.trim() || DEFAULT_PUBLIC_ORIGIN;
  try {
    const origin = new URL(candidate);
    if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('invalid protocol');
    return origin.origin;
  } catch {
    // Keep local development usable when the optional override is malformed.
    return new URL(request.url).origin;
  }
}

function cookie(request, name, value, maxAge) {
  const secure = new URL(publicOrigin(request)).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearCookie(request, name) {
  return cookie(request, name, '', 0);
}

function safeReturnTo(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  if (value.length > 500 || /[\r\n]/.test(value)) return '/';
  return value;
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === publicOrigin(request);
}

function githubHeaders(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'user-agent': 'blog-owner-console',
    'x-github-api-version': GITHUB_API_VERSION,
  };
}

async function githubRequest(path, {token, method = 'GET', body} = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      ...githubHeaders(token || requiredEnvironment('GITHUB_REPO_TOKEN', 20)),
      ...(body ? {'content-type': 'application/json; charset=utf-8'} : {}),
    },
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const error = new Error(payload?.message || `GitHub API 返回 ${response.status}。`);
    error.status = response.status;
    error.github = payload;
    throw error;
  }
  return payload;
}

async function repository() {
  const {owner, repo} = repositoryConfig();
  return githubRequest(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
}

async function sessionFromRequest(request, verifyOwner = false) {
  const encoded = parseCookies(request)[SESSION_COOKIE];
  const session = decodeSigned(encoded);
  if (!session || !Number.isInteger(session.userId) || session.expiresAt <= Date.now()) return null;
  if (verifyOwner) {
    const repo = await repository();
    if (Number(repo.owner?.id) !== session.userId) return null;
  }
  return session;
}

async function requireSession(request, verifyOwner = false) {
  const session = await sessionFromRequest(request, verifyOwner);
  if (!session) {
    const error = new Error('请先使用仓库所有者的 GitHub 账号登录。');
    error.status = 401;
    error.code = 'ADMIN_UNAUTHORIZED';
    throw error;
  }
  return session;
}

async function startLogin(request, url) {
  const clientId = requiredEnvironment('GITHUB_OAUTH_CLIENT_ID', 8);
  const nonce = randomBytes(24).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const oauthState = encodeSigned({
    nonce,
    verifier,
    returnTo: safeReturnTo(url.searchParams.get('returnTo') || '/'),
    expiresAt: Date.now() + OAUTH_TTL_MS,
  });
  const callback = new URL('/api/console/callback', publicOrigin(request)).toString();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('state', nonce);
  authorize.searchParams.set('code_challenge', challenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('allow_signup', 'false');
  return redirect(authorize.toString(), {
    'set-cookie': cookie(request, OAUTH_COOKIE, oauthState, Math.floor(OAUTH_TTL_MS / 1000)),
  });
}

async function finishLogin(request, url) {
  const cookies = parseCookies(request);
  const oauthState = decodeSigned(cookies[OAUTH_COOKIE]);
  const clearOauth = clearCookie(request, OAUTH_COOKIE);
  if (
    !oauthState ||
    oauthState.expiresAt <= Date.now() ||
    !url.searchParams.get('state') ||
    url.searchParams.get('state') !== oauthState.nonce
  ) {
    return redirect('/?adminAuth=invalid-state', {'set-cookie': clearOauth});
  }
  const code = url.searchParams.get('code');
  if (!code) return redirect('/?adminAuth=denied', {'set-cookie': clearOauth});

  const callback = new URL('/api/console/callback', publicOrigin(request)).toString();
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json; charset=utf-8',
      'user-agent': 'blog-owner-console',
    },
    body: JSON.stringify({
      client_id: requiredEnvironment('GITHUB_OAUTH_CLIENT_ID', 8),
      client_secret: requiredEnvironment('GITHUB_OAUTH_CLIENT_SECRET', 16),
      code,
      redirect_uri: callback,
      code_verifier: oauthState.verifier,
    }),
  });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenBody.access_token) {
    return redirect('/?adminAuth=token-failed', {'set-cookie': clearOauth});
  }

  const user = await githubRequest('/user', {token: tokenBody.access_token});
  const repo = await repository();
  if (Number(repo.owner?.id) !== Number(user.id)) {
    return redirect('/?adminAuth=not-owner', {'set-cookie': clearOauth});
  }

  const encodedSession = encodeSigned({
    userId: Number(user.id),
    login: String(user.login),
    avatarUrl: String(user.avatar_url || ''),
    repository: repo.full_name,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  const destination = safeReturnTo(oauthState.returnTo);
  const sessionCookie = cookie(request, SESSION_COOKIE, encodedSession, Math.floor(SESSION_TTL_MS / 1000));
  const headers = new Headers(responseHeaders({location: destination}));
  headers.append('set-cookie', clearOauth);
  headers.append('set-cookie', sessionCookie);
  return new Response(null, {status: 302, headers});
}

async function repoSnapshot() {
  const {owner, repo, branch} = repositoryConfig();
  const root = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const ref = await githubRequest(`${root}/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`);
  const headSha = ref.object?.sha;
  const commit = await githubRequest(`${root}/git/commits/${headSha}`);
  const tree = await githubRequest(`${root}/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw new Error('仓库文件列表过大，GitHub 未返回全部内容。');
  return {root, headSha, commit, entries: tree.tree || []};
}

function findBlob(snapshot, path) {
  const entry = snapshot.entries.find((item) => item.type === 'blob' && item.path === path);
  if (!entry) {
    const error = new Error(`仓库中不存在 ${path}。`);
    error.status = 404;
    error.code = 'FILE_NOT_FOUND';
    throw error;
  }
  return entry;
}

async function readBlob(snapshot, path) {
  const entry = findBlob(snapshot, path);
  const blob = await githubRequest(`${snapshot.root}/git/blobs/${entry.sha}`);
  if (blob.encoding !== 'base64') throw new Error(`无法解码 ${path}。`);
  return {
    content: Buffer.from(String(blob.content).replace(/\s/g, ''), 'base64').toString('utf8'),
    blobSha: entry.sha,
  };
}

function parseJsonl(text, fallbackHeader) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let header = fallbackHeader;
  const records = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) {
      if (records.length === 0) header = trimmed;
      continue;
    }
    const record = JSON.parse(trimmed);
    if (!record || Array.isArray(record) || typeof record !== 'object') {
      throw new Error('数据行必须是 JSON 对象。');
    }
    records.push(record);
  }
  return {header, records};
}

function validateRecords(records) {
  if (!Array.isArray(records)) throw requestError('records 必须是数组。');
  if (records.length > MAX_RECORDS) throw requestError(`单个表不得超过 ${MAX_RECORDS} 条记录。`, 413, 'DATASET_TOO_LARGE');
  records.forEach((record, index) => {
    if (!record || Array.isArray(record) || typeof record !== 'object') {
      throw requestError(`第 ${index + 1} 条记录不是 JSON 对象。`);
    }
    if (Object.keys(record).length > 128) throw requestError(`第 ${index + 1} 条记录的字段过多。`);
  });
}

function serializeJsonl(dataset, records) {
  validateRecords(records);
  const content = `${dataset.header}\n${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
  if (Buffer.byteLength(content) > MAX_DATA_BYTES) throw requestError('序列化后的数据文件超过 4 MiB。', 413, 'DATASET_TOO_LARGE');
  return content;
}

function allowedContentPath(value) {
  const path = String(value || '').replace(/^@site\//, '').replace(/\\/g, '/');
  if (path.includes('..') || path.startsWith('/') || /[\0\r\n]/.test(path)) return null;
  if (!/^(?:docs|blog)\/.+\.(?:md|mdx)$/i.test(path)) return null;
  return path;
}

async function readBody(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    const error = new Error('请求内容超过 5 MiB。');
    error.status = 413;
    throw error;
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES) {
    const error = new Error('请求内容超过 5 MiB。');
    error.status = 413;
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw requestError('请求内容不是有效 JSON。');
  }
}

async function commitFile({path, content, baseHeadSha, message}) {
  if (!baseHeadSha || !/^[0-9a-f]{40}$/i.test(baseHeadSha)) throw requestError('缺少有效的基准提交编号。');
  const snapshot = await repoSnapshot();
  if (snapshot.headSha !== baseHeadSha) {
    const error = new Error('远程仓库已被更新，请重新加载后再保存。');
    error.status = 409;
    error.code = 'REPOSITORY_CHANGED';
    throw error;
  }
  const blob = await githubRequest(`${snapshot.root}/git/blobs`, {
    method: 'POST',
    body: {content, encoding: 'utf-8'},
  });
  const tree = await githubRequest(`${snapshot.root}/git/trees`, {
    method: 'POST',
    body: {
      base_tree: snapshot.commit.tree.sha,
      tree: [{path, mode: '100644', type: 'blob', sha: blob.sha}],
    },
  });
  const commit = await githubRequest(`${snapshot.root}/git/commits`, {
    method: 'POST',
    body: {
      message: String(message || `控制台：更新 ${path}`).slice(0, 240),
      tree: tree.sha,
      parents: [snapshot.headSha],
    },
  });
  await githubRequest(
    `${snapshot.root}/git/refs/heads/${repositoryConfig().branch.split('/').map(encodeURIComponent).join('/')}`,
    {method: 'PATCH', body: {sha: commit.sha, force: false}},
  );
  const {owner, repo} = repositoryConfig();
  return {
    commitSha: commit.sha,
    commitUrl: `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commit/${commit.sha}`,
  };
}

async function listFiles() {
  const snapshot = await repoSnapshot();
  const files = snapshot.entries
    .filter((item) => item.type === 'blob')
    .map((item) => item.path)
    .filter((path) => allowedContentPath(path))
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
  return json({success: true, data: {files, headSha: snapshot.headSha}});
}

async function getFile(url) {
  const path = allowedContentPath(url.searchParams.get('path'));
  if (!path) return fail('只允许编辑 docs 或 blog 中的 Markdown 文件。', 'INVALID_CONTENT_PATH');
  const snapshot = await repoSnapshot();
  const file = await readBlob(snapshot, path);
  return json({success: true, data: {path, content: file.content, blobSha: file.blobSha, headSha: snapshot.headSha}});
}

async function saveFile(request) {
  const body = await readBody(request);
  const path = allowedContentPath(body.path);
  if (!path) return fail('只允许编辑 docs 或 blog 中的 Markdown 文件。', 'INVALID_CONTENT_PATH');
  if (typeof body.content !== 'string' || Buffer.byteLength(body.content) > MAX_SOURCE_BYTES) {
    return fail('Markdown 正文必须是不超过 3 MiB 的字符串。', 'INVALID_CONTENT');
  }
  const result = await commitFile({
    path,
    content: body.content,
    baseHeadSha: body.baseHeadSha,
    message: body.message || `文章：通过控制台更新 ${path}`,
  });
  return json({success: true, data: result}, 201);
}

async function getDataset(url) {
  const name = url.searchParams.get('name');
  const dataset = DATASETS[name];
  if (!dataset) return fail('未知的数据表。', 'INVALID_DATASET');
  const snapshot = await repoSnapshot();
  const file = await readBlob(snapshot, dataset.path);
  const parsed = parseJsonl(file.content, dataset.header);
  return json({
    success: true,
    data: {
      name,
      label: dataset.label,
      path: dataset.path,
      records: parsed.records,
      count: parsed.records.length,
      headSha: snapshot.headSha,
      blobSha: file.blobSha,
    },
  });
}

async function saveDataset(request) {
  const body = await readBody(request);
  const dataset = DATASETS[body.name];
  if (!dataset) return fail('未知的数据表。', 'INVALID_DATASET');
  if (!['append', 'replace'].includes(body.operation)) return fail('数据操作类型无效。', 'INVALID_OPERATION');
  validateRecords(body.records);
  let records = body.records;
  if (body.operation === 'append') {
    const snapshot = await repoSnapshot();
    if (snapshot.headSha !== body.baseHeadSha) {
      return fail('远程仓库已被更新，请重新加载后再导入。', 'REPOSITORY_CHANGED', 409);
    }
    const current = parseJsonl((await readBlob(snapshot, dataset.path)).content, dataset.header);
    records = [...current.records, ...body.records];
  }
  const content = serializeJsonl(dataset, records);
  const result = await commitFile({
    path: dataset.path,
    content,
    baseHeadSha: body.baseHeadSha,
    message: body.message || `数据：通过控制台${body.operation === 'append' ? '新增' : '更新'} ${dataset.label}`,
  });
  return json({success: true, data: {...result, count: records.length}}, 201);
}

function datasetList() {
  return Object.entries(DATASETS).map(([name, dataset]) => ({
    name,
    label: dataset.label,
    path: dataset.path,
  }));
}

export default async (request) => {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/console/login' && request.method === 'GET') return await startLogin(request, url);
    if (url.pathname === '/api/console/callback' && request.method === 'GET') return await finishLogin(request, url);
    if (url.pathname === '/api/console/auth' && request.method === 'GET') {
      const session = await sessionFromRequest(request, true);
      return json({
        success: true,
        data: session
          ? {authenticated: true, user: {login: session.login, avatarUrl: session.avatarUrl}, repository: session.repository}
          : {authenticated: false},
      });
    }
    if (url.pathname === '/api/console/logout' && request.method === 'POST') {
      if (!sameOrigin(request)) return fail('请求来源无效。', 'INVALID_ORIGIN', 403);
      return json(
        {success: true, data: {authenticated: false}},
        200,
        {'set-cookie': clearCookie(request, SESSION_COOKIE)},
      );
    }

    await requireSession(request, request.method !== 'GET');
    if (!sameOrigin(request)) return fail('请求来源无效。', 'INVALID_ORIGIN', 403);

    if (url.pathname === '/api/console/datasets' && request.method === 'GET') {
      return json({success: true, data: {datasets: datasetList()}});
    }
    if (url.pathname === '/api/console/dataset' && request.method === 'GET') return await getDataset(url);
    if (url.pathname === '/api/console/dataset' && request.method === 'POST') return await saveDataset(request);
    if (url.pathname === '/api/console/files' && request.method === 'GET') return await listFiles();
    if (url.pathname === '/api/console/file' && request.method === 'GET') return await getFile(url);
    if (url.pathname === '/api/console/file' && request.method === 'POST') return await saveFile(request);
    return fail('控制台接口不存在。', 'NOT_FOUND', 404);
  } catch (caught) {
    console.error('[blog-console]', caught instanceof Error ? caught.message : String(caught));
    const status = Number(caught?.status) || 500;
    return fail(
      status >= 500 ? '控制台服务暂时无法完成请求。' : caught.message,
      caught?.code || (status === 401 ? 'ADMIN_UNAUTHORIZED' : 'CONSOLE_ERROR'),
      status,
      status >= 500 && process.env.CONTEXT !== 'production' ? String(caught?.message || caught) : undefined,
    );
  }
};
