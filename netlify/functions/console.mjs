import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import {
  ARTICLE_PREFIX,
  MUSIC_PREFIX,
  MUSIC_REVISION_KEY,
  contentBackend,
  contentMetadata,
  deleteContent,
  readContent,
  writeContent,
} from '../lib/content-store.mjs';
import {
  articleKey,
  articleSummary,
  ensureArticleIndex,
  normalizeArticlePath,
  removeArticleEntry,
  sortArticles,
  upsertArticleEntry,
  writeArticleIndex,
} from '../lib/articles.mjs';
import {readZipEntries} from '../lib/zip.mjs';

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
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_UPLOAD_FILES = 400;
const DEFAULT_PUBLIC_ORIGIN = 'https://blog.yusen.best';

const DATASETS = Object.freeze({
  music_hq: {
    label: 'HQ 音乐',
    path: 'static/data/music_hq.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"music_hq"}',
    idField: 'mid',
  },
  music_sq: {
    label: 'SQ / Hi-Res 音乐',
    path: 'static/data/music_sq.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"music_sq"}',
    idField: 'mid',
  },
  music_tag: {
    label: '歌单标签',
    path: 'static/data/music_tag.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"music_tag"}',
    idField: 'tag_id',
  },
  mv: {
    label: 'MV 主表',
    path: 'static/data/mv.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"mv"}',
    idField: 'mv_id',
  },
  mv_bilibili: {
    label: 'MV B 站资料',
    path: 'static/data/mv_bilibili.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"mv_bilibili"}',
    idField: 'mv_id',
  },
  mv_class: {
    label: 'MV 分类',
    path: 'static/data/mv_class.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"mv_class"}',
    idField: 'list',
  },
  mv_out: {
    label: 'MV 扩展资料',
    path: 'static/data/mv_out.0.jsonl',
    header: '#filetype:JSON-streaming {"type":"Class","class":"mv_out"}',
    idField: 'mv_id',
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

function devAdminSession() {
  // 仅用于本地模拟：显式设置 CONSOLE_DEV_ADMIN=1 且在非 Netlify 生产环境下生效。
  if (process.env.CONSOLE_DEV_ADMIN !== '1') return null;
  if (process.env.CONTEXT === 'production' || process.env.NETLIFY === 'true') return null;
  const owner = process.env.GITHUB_REPO_OWNER || 'local';
  const repo = process.env.GITHUB_REPO_NAME || 'local';
  return {
    userId: 0,
    login: process.env.CONSOLE_DEV_LOGIN || 'local-dev',
    avatarUrl: '',
    repository: `${owner}/${repo}`,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

async function sessionFromRequest(request, verifyOwner = false) {
  const encoded = parseCookies(request)[SESSION_COOKIE];
  const session = decodeSigned(encoded);
  if (!session || !Number.isInteger(session.userId) || session.expiresAt <= Date.now()) {
    return devAdminSession();
  }
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

// Shared server-side gate for personal Pixiv actions; verifies the signed session and repo owner.
export async function requireAdminSession(request) {
  return requireSession(request, true);
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

function normalizeMusicTagRecords(records) {
  const tagIds = new Set();
  const tagOrders = new Set();
  return records.map((record, index) => {
    const tagId = Number(record.tag_id);
    const tagOrder = Number(record.tag_order);
    const tagName = typeof record.tag_name === 'string' ? record.tag_name.trim() : '';
    if (!Number.isInteger(tagId) || tagId < 0) {
      throw requestError(`歌单标签第 ${index + 1} 条的 tag_id 无效。`);
    }
    if (tagIds.has(tagId)) throw requestError(`歌单标签编号 ${tagId} 重复。`);
    if (!Number.isInteger(tagOrder) || tagOrder < 1) {
      throw requestError(`歌单标签「${tagName || tagId}」的显示顺序必须是大于 0 的整数。`);
    }
    if (tagOrders.has(tagOrder)) throw requestError(`歌单标签显示顺序 ${tagOrder} 重复。`);
    if (!tagName) throw requestError(`歌单标签 ${tagId} 缺少 tag_name。`);
    tagIds.add(tagId);
    tagOrders.add(tagOrder);
    const seenMids = new Set();
    const musicOrder = (Array.isArray(record.music_order) ? record.music_order : []).map(Number).filter((mid) => {
      if (!Number.isInteger(mid) || mid < 0 || seenMids.has(mid)) return false;
      seenMids.add(mid);
      return true;
    });
    return {...record, tag_id: tagId, tag_order: tagOrder, tag_name: tagName, music_order: musicOrder};
  });
}

export function reconcileMusicTagOrders(tagRecords, musicRecords) {
  const members = new Map();
  for (const record of musicRecords) {
    const mid = Number(record.mid);
    if (!Number.isInteger(mid) || mid < 0) continue;
    for (const rawTagId of Array.isArray(record.list) ? record.list : []) {
      const tagId = Number(rawTagId);
      if (!Number.isInteger(tagId) || tagId < 0) continue;
      if (!members.has(tagId)) members.set(tagId, []);
      members.get(tagId).push(mid);
    }
  }
  return normalizeMusicTagRecords(tagRecords).map((tag) => {
    const validMids = [...new Set(members.get(Number(tag.tag_id)) || [])].sort((left, right) => left - right);
    const valid = new Set(validMids);
    const order = (Array.isArray(tag.music_order) ? tag.music_order : []).filter((mid) => valid.has(Number(mid))).map(Number);
    const used = new Set(order);
    for (const mid of validMids) if (!used.has(mid)) order.push(mid);
    return {...tag, music_order: order};
  });
}

export function sortMusicRecords(records, sort = 'id', musicOrder = []) {
  const source = Array.isArray(records) ? records.slice() : [];
  if (sort === 'list_order') {
    const positions = new Map(
      (Array.isArray(musicOrder) ? musicOrder : []).map((mid, index) => [Number(mid), index]),
    );
    return source.sort((left, right) => {
      const leftPosition = positions.has(Number(left.mid)) ? positions.get(Number(left.mid)) : Number.MAX_SAFE_INTEGER;
      const rightPosition = positions.has(Number(right.mid)) ? positions.get(Number(right.mid)) : Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition || Number(left.mid) - Number(right.mid);
    });
  }
  return source.sort((left, right) => Number(left.mid) - Number(right.mid));
}

function validateMusicTagReferences(tagRecords, ...musicRecordSets) {
  const validTagIds = new Set(normalizeMusicTagRecords(tagRecords).map((tag) => Number(tag.tag_id)));
  const references = new Map();
  for (const records of musicRecordSets) {
    for (const record of records) {
      const mid = Number(record.mid);
      for (const rawTagId of Array.isArray(record.list) ? record.list : []) {
        const tagId = Number(rawTagId);
        // 0、1 是播放器内部使用的“播放队列/全部”编号，不属于公开标签表。
        if (!Number.isInteger(tagId) || tagId < 2 || validTagIds.has(tagId)) continue;
        if (!references.has(tagId)) references.set(tagId, []);
        if (references.get(tagId).length < 5) references.get(tagId).push(mid);
      }
    }
  }
  if (references.size) {
    const details = [...references.entries()]
      .map(([tagId, mids]) => `${tagId}（MID ${mids.join('、')}）`)
      .join('；');
    throw requestError(`仍有曲目引用不存在的歌单标签：${details}。`);
  }
}

function serializeJsonl(dataset, records) {
  validateRecords(records);
  const content = `${dataset.header}\n${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
  if (Buffer.byteLength(content) > MAX_DATA_BYTES) throw requestError('序列化后的数据文件超过 4 MiB。', 413, 'DATASET_TOO_LARGE');
  return content;
}

function allowedContentPath(value) {
  return normalizeArticlePath(value);
}

function datasetBlobKey(dataset) {
  return `${MUSIC_PREFIX}${dataset.path.split('/').pop()}`;
}

async function wantSnapshot() {
  // GitHub 仅作为镜像/备份；本地或未配置令牌时允许读取与写入落到 Blob。
  try {
    return await repoSnapshot();
  } catch {
    return null;
  }
}

async function readDatasetText(dataset) {
  const stored = await readContent(datasetBlobKey(dataset)).catch(() => null);
  if (typeof stored === 'string') return stored;
  const snapshot = await wantSnapshot();
  if (snapshot) {
    try {
      return (await readBlob(snapshot, dataset.path)).content;
    } catch {
      return null;
    }
  }
  return null;
}

async function bumpMusicRevision() {
  const revision = new Date().toISOString();
  await writeContent(
    MUSIC_REVISION_KEY,
    JSON.stringify({revision, updatedAt: revision}),
    {metadata: {revision, updatedAt: revision}},
  );
  return revision;
}

async function writeDatasets(entries) {
  for (const entry of entries) {
    await writeContent(datasetBlobKey(entry.dataset), entry.content);
  }
  return bumpMusicRevision();
}

async function mirrorToGitHub(files, message) {
  // 数据已写入 Blob 后，再把结果镜像回 GitHub 仓库留档。镜像失败不阻断编辑。
  try {
    const snapshot = await repoSnapshot();
    const result = await commitFiles({files, baseHeadSha: snapshot.headSha, message});
    return {ok: true, commitSha: result.commitSha, commitUrl: result.commitUrl};
  } catch (error) {
    return {ok: false, message: error instanceof Error ? error.message : String(error)};
  }
}

const SEED_MARKER = `${ARTICLE_PREFIX}_seeded.json`;
let seedPromise = null;

async function seedContentFromRepository() {
  // 首次部署时把仓库中的文章与数据表一次性导入 Blob，之后读取即以 Blob 为准。
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    if (await readContent(SEED_MARKER).catch(() => null)) return false;
    const snapshot = await wantSnapshot();
    if (!snapshot) return false;
    const paths = snapshot.entries
      .filter((item) => item.type === 'blob')
      .map((item) => item.path)
      .filter((path) => allowedContentPath(path));
    const articles = [];
    for (const path of paths) {
      try {
        const file = await readBlob(snapshot, path);
        const updatedAt = new Date().toISOString();
        await writeContent(articleKey(path), file.content, {metadata: {updatedAt}});
        articles.push(articleSummary(path, file.content, updatedAt));
      } catch {
        // 单个文件读取失败不影响其余内容导入。
      }
    }
    if (articles.length) await writeArticleIndex(sortArticles(articles));
    for (const dataset of Object.values(DATASETS)) {
      const key = datasetBlobKey(dataset);
      if (await readContent(key).catch(() => null)) continue;
      try {
        await writeContent(key, (await readBlob(snapshot, dataset.path)).content);
      } catch {
        // 数据表不存在时跳过。
      }
    }
    await bumpMusicRevision();
    await writeContent(SEED_MARKER, JSON.stringify({seededAt: new Date().toISOString()}));
    return true;
  })().finally(() => {
    seedPromise = null;
  });
  return seedPromise;
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
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    throw requestError('请求内容不是有效 JSON。');
  }
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    throw requestError('请求内容必须是 JSON 对象。');
  }
  return body;
}

async function commitFiles({files, baseHeadSha, message}) {
  if (!baseHeadSha || !/^[0-9a-f]{40}$/i.test(baseHeadSha)) throw requestError('缺少有效的基准提交编号。');
  if (!Array.isArray(files) || !files.length) throw requestError('没有需要写入的文件。');
  const paths = new Set();
  files.forEach(({path, content}) => {
    if (typeof path !== 'string' || !path || paths.has(path)) throw requestError('文件路径无效或重复。');
    if (content !== null && typeof content !== 'string') throw requestError(`文件 ${path} 的内容无效。`);
    paths.add(path);
  });
  const snapshot = await repoSnapshot();
  if (snapshot.headSha !== baseHeadSha) {
    const error = new Error('远程仓库已被更新，请重新加载后再保存。');
    error.status = 409;
    error.code = 'REPOSITORY_CHANGED';
    throw error;
  }
  const blobs = await Promise.all(files.map(async ({path, content}) => {
    if (content === null) return {path, mode: '100644', type: 'blob', sha: null};
    const blob = await githubRequest(`${snapshot.root}/git/blobs`, {
      method: 'POST',
      body: {content, encoding: 'utf-8'},
    });
    return {path, mode: '100644', type: 'blob', sha: blob.sha};
  }));
  const tree = await githubRequest(`${snapshot.root}/git/trees`, {
    method: 'POST',
    body: {
      base_tree: snapshot.commit.tree.sha,
      tree: blobs,
    },
  });
  const commit = await githubRequest(`${snapshot.root}/git/commits`, {
    method: 'POST',
    body: {
      message: String(message || `控制台：更新 ${files[0].path}`).slice(0, 240),
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
  await seedContentFromRepository().catch(() => {});
  let articles = [];
  const index = await ensureArticleIndex().catch(() => null);
  if (index) articles = index.articles;
  let files;
  if (articles.length) {
    files = articles.map((article) => article.path);
  } else {
    const snapshot = await wantSnapshot();
    files = snapshot
      ? snapshot.entries
        .filter((item) => item.type === 'blob')
        .map((item) => item.path)
        .filter((path) => allowedContentPath(path))
        .sort((left, right) => left.localeCompare(right, 'zh-CN'))
      : [];
    articles = files.map((path) => articleSummary(path, ''));
  }
  const sections = [...new Set(files.map((path) => path.split('/').slice(0, -1).join('/')).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
  const snapshot = await wantSnapshot();
  return json({
    success: true,
    data: {
      files,
      sections,
      articles,
      backend: contentBackend(),
      headSha: snapshot ? snapshot.headSha : null,
    },
  });
}

async function getFile(url) {
  const path = allowedContentPath(url.searchParams.get('path'));
  if (!path) return fail('只允许编辑 docs 或 blog 中的 Markdown 文件。', 'INVALID_CONTENT_PATH');
  const stored = await readContent(articleKey(path)).catch(() => null);
  if (typeof stored === 'string') {
    const meta = await contentMetadata(articleKey(path));
    const snapshot = await wantSnapshot();
    return json({
      success: true,
      data: {
        path,
        content: stored,
        summary: articleSummary(path, stored, meta?.metadata?.updatedAt || null),
        blobSha: meta?.etag || null,
        backend: contentBackend(),
        headSha: snapshot ? snapshot.headSha : null,
      },
    });
  }
  const snapshot = await wantSnapshot();
  if (!snapshot) return fail('文章不存在。', 'FILE_NOT_FOUND', 404);
  const file = await readBlob(snapshot, path);
  return json({success: true, data: {path, content: file.content, blobSha: file.blobSha, backend: contentBackend(), headSha: snapshot.headSha}});
}

async function saveFile(request) {
  const body = await readBody(request);
  const path = allowedContentPath(body.path);
  if (!path) return fail('只允许编辑 docs 或 blog 中的 Markdown 文件。', 'INVALID_CONTENT_PATH');
  if (typeof body.content !== 'string' || Buffer.byteLength(body.content) > MAX_SOURCE_BYTES) {
    return fail('Markdown 正文必须是不超过 3 MiB 的字符串。', 'INVALID_CONTENT');
  }
  const previousPath = body.previousPath ? allowedContentPath(body.previousPath) : null;
  if (body.previousPath && !previousPath) return fail('原文件路径无效。', 'INVALID_CONTENT_PATH');

  const updatedAt = new Date().toISOString();
  await writeContent(articleKey(path), body.content, {metadata: {updatedAt}});
  await upsertArticleEntry(articleSummary(path, body.content, updatedAt));
  if (previousPath && previousPath !== path) {
    await deleteContent(articleKey(previousPath)).catch(() => {});
    await removeArticleEntry(previousPath).catch(() => {});
  }

  const files = [{path, content: body.content}];
  if (previousPath && previousPath !== path) files.push({path: previousPath, content: null});
  const gitSync = await mirrorToGitHub(files, body.message || `文章：通过控制台更新 ${path}`);
  return json({success: true, data: {path, savedTo: contentBackend(), updatedAt, gitSync}}, 201);
}

async function deleteFile(request) {
  const body = await readBody(request);
  const path = allowedContentPath(body.path);
  if (!path) return fail('只允许删除 docs 或 blog 中的 Markdown 文件。', 'INVALID_CONTENT_PATH');
  await deleteContent(articleKey(path));
  await removeArticleEntry(path).catch(() => {});
  const gitSync = await mirrorToGitHub([{path, content: null}], body.message || `文章：通过控制台删除 ${path}`);
  return json({success: true, data: {path, deletedFrom: contentBackend(), gitSync}}, 201);
}

function sanitizeUploadName(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment && segment !== '.' && segment !== '..')
    .join('/');
}

function isMarkdownName(name) {
  return /\.(?:md|mdx)$/i.test(name);
}

function uploadArticlePath(target, relative) {
  const cleanRelative = sanitizeUploadName(relative);
  if (!cleanRelative) return null;
  return normalizeArticlePath(`${target}/${cleanRelative}`);
}

async function mergeArticleIndex(summaries) {
  const index = await ensureArticleIndex().catch(() => null);
  const byPath = new Map((index?.articles || []).map((article) => [article.path, article]));
  for (const summary of summaries) byPath.set(summary.path, summary);
  return writeArticleIndex(sortArticles([...byPath.values()]));
}

async function uploadArticles(request) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_UPLOAD_BYTES) {
    return fail(`上传内容超过 ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MiB。`, 'UPLOAD_TOO_LARGE', 413);
  }
  let form;
  try {
    form = await request.formData();
  } catch {
    return fail('上传内容格式无效。', 'INVALID_UPLOAD');
  }
  const target = sanitizeUploadName(form.get('target'));
  if (!/^(?:docs|blog)(?:\/|$)/.test(target)) {
    return fail('目标分区需要位于 docs/ 或 blog/ 下。', 'INVALID_TARGET');
  }

  const pending = new Map();
  for (const entry of form.getAll('files')) {
    if (typeof entry === 'string') continue;
    const relative = sanitizeUploadName(entry.name);
    if (!isMarkdownName(relative)) continue;
    const path = uploadArticlePath(target, relative);
    if (!path || pending.has(path)) continue;
    pending.set(path, {path, content: await entry.text()});
  }

  const archive = form.get('archive');
  if (archive && typeof archive !== 'string') {
    if (archive.size > MAX_UPLOAD_BYTES) return fail('压缩包超过 5 MiB。', 'UPLOAD_TOO_LARGE', 413);
    let entries;
    try {
      entries = readZipEntries(Buffer.from(await archive.arrayBuffer()));
    } catch (error) {
      return fail(error instanceof Error ? error.message : '压缩包解析失败。', 'INVALID_ARCHIVE');
    }
    for (const entry of entries) {
      const name = sanitizeUploadName(entry.name);
      if (!name || name.startsWith('__MACOSX/') || name.split('/').some((segment) => segment.startsWith('.'))) continue;
      if (!isMarkdownName(name)) continue;
      const path = uploadArticlePath(target, name);
      if (!path || pending.has(path)) continue;
      pending.set(path, {path, content: entry.data.toString('utf8')});
    }
  }

  if (!pending.size) return fail('没有找到可导入的 Markdown 文件。', 'NO_MARKDOWN');
  if (pending.size > MAX_UPLOAD_FILES) return fail(`一次最多导入 ${MAX_UPLOAD_FILES} 个文件。`, 'TOO_MANY_FILES');

  const existing = new Set(((await ensureArticleIndex().catch(() => null))?.articles || []).map((article) => article.path));
  const created = [];
  const updated = [];
  const skipped = [];
  const summaries = [];
  const gitFiles = [];
  const updatedAt = new Date().toISOString();
  let totalBytes = 0;
  for (const item of pending.values()) {
    const size = Buffer.byteLength(item.content);
    if (size > MAX_SOURCE_BYTES || totalBytes + size > MAX_UPLOAD_BYTES) {
      skipped.push(item.path);
      continue;
    }
    totalBytes += size;
    await writeContent(articleKey(item.path), item.content, {metadata: {updatedAt}});
    summaries.push(articleSummary(item.path, item.content, updatedAt));
    gitFiles.push({path: item.path, content: item.content});
    (existing.has(item.path) ? updated : created).push(item.path);
  }
  if (summaries.length) await mergeArticleIndex(summaries);
  const gitSync = gitFiles.length
    ? await mirrorToGitHub(gitFiles, `文章：批量导入 ${gitFiles.length} 个文件`)
    : {ok: false, message: '没有写入任何文件。'};
  return json({success: true, data: {created, updated, skipped, backend: contentBackend(), gitSync}}, 201);
}

async function getDataset(url) {
  const name = url.searchParams.get('name');
  const dataset = DATASETS[name];
  if (!dataset) return fail('未知的数据表。', 'INVALID_DATASET');
  const storedText = await readDatasetText(dataset);
  if (typeof storedText !== 'string') return fail('数据表尚未初始化。', 'DATASET_NOT_READY', 503);
  const parsed = parseJsonl(storedText, dataset.header);
  const blobMeta = await contentMetadata(datasetBlobKey(dataset)).catch(() => null);
  const page = Math.max(0, Number.parseInt(url.searchParams.get('page') || '0', 10) || 0);
  const pageSize = Math.max(1, Math.min(200, Number.parseInt(url.searchParams.get('pageSize') || '36', 10) || 36));
  const query = String(url.searchParams.get('query') || '').trim().toLocaleLowerCase().slice(0, 200);
  const tagValue = url.searchParams.get('tagId');
  const tagId = tagValue === null || tagValue === '' || tagValue === 'all' ? null : Number(tagValue);
  const musicDataset = name === 'music_hq' || name === 'music_sq';
  let records = parsed.records;
  if (musicDataset && tagId !== null) {
    if (!Number.isInteger(tagId) || tagId < 0) return fail('歌单标签无效。', 'INVALID_TAG');
    records = records.filter((record) => Array.isArray(record.list) && record.list.map(Number).includes(tagId));
  }
  if (query) records = records.filter((record) => JSON.stringify(record).toLocaleLowerCase().includes(query));

  const sort = String(url.searchParams.get('sort') || 'id');
  if (musicDataset && tagId !== null && sort === 'list_order') {
    const tagText = await readDatasetText(DATASETS.music_tag);
    const tagRecords = tagText ? parseJsonl(tagText, DATASETS.music_tag.header).records : [];
    const tag = tagRecords.find((record) => Number(record.tag_id) === tagId);
    records = sortMusicRecords(records, 'list_order', tag?.music_order);
  } else if (musicDataset) {
    // “全部”及明确选择 MID 排序时始终以 mid 作为最高级顺序，不受各歌单
    // 独立顺序影响。
    records = sortMusicRecords(records, 'id');
  } else if (name === 'music_tag') {
    records = records.slice().sort((left, right) => Number(left.tag_order) - Number(right.tag_order) || Number(left.tag_id) - Number(right.tag_id));
  } else {
    records = records.slice().sort((left, right) => {
      const leftId = Number(left[dataset.idField]);
      const rightId = Number(right[dataset.idField]);
      if (Number.isFinite(leftId) && Number.isFinite(rightId)) return leftId - rightId;
      return String(left[dataset.idField] || '').localeCompare(String(right[dataset.idField] || ''), 'zh-CN', {numeric: true});
    });
  }
  const order = String(url.searchParams.get('order') || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  if (order === 'desc') records = records.slice().reverse();
  const count = records.length;
  const offset = page * pageSize;
  return json({
    success: true,
    data: {
      name,
      label: dataset.label,
      path: dataset.path,
      records: records.slice(offset, offset + pageSize),
      count,
      totalCount: parsed.records.length,
      page,
      pageSize,
      headSha: null,
      blobSha: blobMeta?.etag || null,
      backend: contentBackend(),
    },
  });
}

function datasetRecordKey(dataset, record) {
  const value = record?.[dataset.idField];
  const id = Number(value);
  if (!Number.isInteger(id) || id < 0) throw requestError(`记录缺少有效的 ${dataset.idField}。`);
  return String(id);
}

function normalizeDatasetRecordIds(dataset, records) {
  const seen = new Set();
  return records.map((record) => {
    const key = datasetRecordKey(dataset, record);
    if (seen.has(key)) throw requestError(`${dataset.idField} ${key} 重复。`);
    seen.add(key);
    return {...record, [dataset.idField]: Number(key)};
  });
}

async function saveDataset(request) {
  const body = await readBody(request);
  const dataset = DATASETS[body.name];
  if (!dataset) return fail('未知的数据表。', 'INVALID_DATASET');
  if (!['append', 'replace', 'patch'].includes(body.operation)) return fail('数据操作类型无效。', 'INVALID_OPERATION');
  validateRecords(body.records);
  let records = body.records;
  const companion = musicCompanionDataset(dataset);
  const syncMusicLists = Boolean(body.syncMusicLists) && Boolean(companion);
  const editingMusicTags = dataset === DATASETS.music_tag;
  if (body.operation === 'append' || body.operation === 'patch') {
    const currentText = await readDatasetText(dataset);
    const current = parseJsonl(typeof currentText === 'string' ? currentText : `${dataset.header}\n`, dataset.header);
    if (body.operation === 'append') {
      records = [...current.records, ...body.records];
    } else {
      const deleteIds = new Set((Array.isArray(body.deleteIds) ? body.deleteIds : [])
        .map((value) => datasetRecordKey(dataset, {[dataset.idField]: value})));
      const upserts = new Map(body.records.map((record) => [datasetRecordKey(dataset, record), record]));
      records = current.records
        .filter((record) => !deleteIds.has(datasetRecordKey(dataset, record)))
        .map((record) => upserts.get(datasetRecordKey(dataset, record)) || record);
      const existing = new Set(records.map((record) => datasetRecordKey(dataset, record)));
      for (const [key, record] of upserts) if (!existing.has(key)) records.push(record);
    }
  }
  records = normalizeDatasetRecordIds(dataset, records);
  if (editingMusicTags) {
    const [hqText, sqText] = await Promise.all([
      readDatasetText(DATASETS.music_hq),
      readDatasetText(DATASETS.music_sq),
    ]);
    if (typeof hqText !== 'string' || typeof sqText !== 'string') return fail('音乐数据表尚未初始化。', 'DATASET_NOT_READY', 503);
    const hqRecords = parseJsonl(hqText, DATASETS.music_hq.header).records;
    const sqRecords = parseJsonl(sqText, DATASETS.music_sq.header).records;
    validateMusicTagReferences(records, hqRecords, sqRecords);
    records = reconcileMusicTagOrders(records, hqRecords);
  }
  const content = serializeJsonl(dataset, records);
  if (syncMusicLists) {
    const [companionText, tagText] = await Promise.all([
      readDatasetText(companion),
      readDatasetText(DATASETS.music_tag),
    ]);
    if (typeof companionText !== 'string' || typeof tagText !== 'string') return fail('音乐数据表尚未初始化。', 'DATASET_NOT_READY', 503);
    const companionRecords = parseJsonl(companionText, companion.header).records;
    const synced = synchronizeMusicLists(records, companionRecords, dataset.label, companion.label);
    const tagRecords = reconcileMusicTagOrders(
      parseJsonl(tagText, DATASETS.music_tag.header).records,
      records,
    );
    validateMusicTagReferences(tagRecords, records, synced.records);
    const companionContent = serializeJsonl(companion, synced.records);
    const tagContent = serializeJsonl(DATASETS.music_tag, tagRecords);
    const revision = await writeDatasets([
      {dataset, content},
      {dataset: companion, content: companionContent},
      {dataset: DATASETS.music_tag, content: tagContent},
    ]);
    const gitSync = await mirrorToGitHub(
      [
        {path: dataset.path, content},
        {path: companion.path, content: companionContent},
        {path: DATASETS.music_tag.path, content: tagContent},
      ],
      body.message || `音乐：更新 ${dataset.label} 并同步 ${companion.label} 歌单与顺序`,
    );
    return json({
      success: true,
      data: {revision, count: records.length, syncedCount: synced.changedCount, unmatchedCount: synced.unmatchedCount, gitSync},
    }, 201);
  }
  const revision = await writeDatasets([{dataset, content}]);
  const gitSync = await mirrorToGitHub(
    [{path: dataset.path, content}],
    body.message || `数据：通过控制台${body.operation === 'append' ? '新增' : '更新'} ${dataset.label}`,
  );
  return json({success: true, data: {revision, count: records.length, gitSync}}, 201);
}

function musicCompanionDataset(dataset) {
  if (dataset === DATASETS.music_hq) return DATASETS.music_sq;
  if (dataset === DATASETS.music_sq) return DATASETS.music_hq;
  return null;
}

function normalizedMusicList(record, label) {
  const mid = Number(record?.mid);
  if (!Number.isInteger(mid) || mid < 0) throw requestError(`${label} 存在无效曲目编号。`);
  if (!Array.isArray(record.list)) throw requestError(`${label} 的曲目 ${mid} 未提供 list 数组。`);
  const seen = new Set();
  const list = [];
  record.list.forEach((value) => {
    const tagId = Number(value);
    if (!Number.isInteger(tagId) || tagId < 0) throw requestError(`${label} 的曲目 ${mid} 包含无效标签编号。`);
    if (!seen.has(tagId)) {
      seen.add(tagId);
      list.push(tagId);
    }
  });
  return {mid, list};
}

function synchronizeMusicLists(sourceRecords, targetRecords, sourceLabel, targetLabel) {
  const sourceLists = new Map();
  sourceRecords.forEach((record) => {
    const {mid, list} = normalizedMusicList(record, sourceLabel);
    if (sourceLists.has(mid)) throw requestError(`${sourceLabel} 中的曲目编号 ${mid} 重复。`);
    sourceLists.set(mid, list);
  });
  const targetIds = new Set();
  let changedCount = 0;
  const records = targetRecords.map((record) => {
    const {mid, list} = normalizedMusicList(record, targetLabel);
    if (targetIds.has(mid)) throw requestError(`${targetLabel} 中的曲目编号 ${mid} 重复。`);
    targetIds.add(mid);
    const next = sourceLists.get(mid);
    if (!next || JSON.stringify(list) === JSON.stringify(next)) return record;
    changedCount += 1;
    return {...record, list: next.slice()};
  });
  let unmatchedCount = 0;
  sourceLists.forEach((_, mid) => {
    if (!targetIds.has(mid)) unmatchedCount += 1;
  });
  return {records, changedCount, unmatchedCount};
}

function normalizeMusicTagIds(value, tagRecords) {
  if (!Array.isArray(value)) throw requestError('tagIds 必须是数组。');
  const available = new Set(tagRecords.map((record) => Number(record.tag_id)));
  const seen = new Set();
  const tagIds = [];
  value.forEach((item) => {
    const tagId = Number(item);
    if (!Number.isInteger(tagId) || !available.has(tagId)) {
      throw requestError(`歌单标签 ${String(item)} 不存在。`);
    }
    if (!seen.has(tagId)) {
      seen.add(tagId);
      tagIds.push(tagId);
    }
  });
  // 1 是资料库内部的基础分类，不在公开歌单标签中展示，也不能由页面移除。
  return [1, ...tagIds];
}

function updateMusicRecordTags(records, mid, tagIds, datasetName) {
  let found = 0;
  let title = '';
  let author = '';
  const updated = records.map((record) => {
    if (Number(record.mid) !== mid) return record;
    found += 1;
    title = String(record.title || '未命名曲目');
    author = String(record.author || '');
    return {...record, list: tagIds};
  });
  if (found !== 1) {
    throw requestError(`${datasetName} 中未找到唯一的曲目编号 ${mid}。`, 404, 'MUSIC_NOT_FOUND');
  }
  return {records: updated, title, author};
}

async function saveMusicTags(request) {
  const body = await readBody(request);
  const mid = Number(body.mid);
  if (!Number.isInteger(mid) || mid < 0) return fail('曲目编号无效。', 'INVALID_MUSIC_ID');

  const [tagText, hqText, sqText] = await Promise.all([
    readDatasetText(DATASETS.music_tag),
    readDatasetText(DATASETS.music_hq),
    readDatasetText(DATASETS.music_sq),
  ]);
  if (typeof tagText !== 'string' || typeof hqText !== 'string' || typeof sqText !== 'string') {
    return fail('音乐数据表尚未初始化。', 'DATASET_NOT_READY', 503);
  }
  const tagRecords = parseJsonl(tagText, DATASETS.music_tag.header).records;
  const tagIds = normalizeMusicTagIds(body.tagIds, tagRecords);
  const hq = updateMusicRecordTags(
    parseJsonl(hqText, DATASETS.music_hq.header).records,
    mid,
    tagIds,
    DATASETS.music_hq.label,
  );
  const sq = updateMusicRecordTags(
    parseJsonl(sqText, DATASETS.music_sq.header).records,
    mid,
    tagIds,
    DATASETS.music_sq.label,
  );
  const orderedTags = reconcileMusicTagOrders(tagRecords, hq.records);
  const displayName = [hq.author || sq.author, hq.title || sq.title].filter(Boolean).join(' - ');
  const hqContent = serializeJsonl(DATASETS.music_hq, hq.records);
  const sqContent = serializeJsonl(DATASETS.music_sq, sq.records);
  const tagContent = serializeJsonl(DATASETS.music_tag, orderedTags);
  const revision = await writeDatasets([
    {dataset: DATASETS.music_hq, content: hqContent},
    {dataset: DATASETS.music_sq, content: sqContent},
    {dataset: DATASETS.music_tag, content: tagContent},
  ]);
  const gitSync = await mirrorToGitHub(
    [
      {path: DATASETS.music_hq.path, content: hqContent},
      {path: DATASETS.music_sq.path, content: sqContent},
      {path: DATASETS.music_tag.path, content: tagContent},
    ],
    `音乐：更新 ${displayName || `曲目 ${mid}`} 的歌单标签`,
  );
  return json({success: true, data: {revision, mid, tagIds, gitSync}}, 201);
}

async function musicOrderSnapshot(tagId) {
  if (!Number.isInteger(tagId) || tagId < 2) return fail('只能调整公开歌单的曲目顺序。', 'INVALID_TAG');
  const [tagText, hqText, sqText] = await Promise.all([
    readDatasetText(DATASETS.music_tag),
    readDatasetText(DATASETS.music_hq),
    readDatasetText(DATASETS.music_sq),
  ]);
  if (typeof tagText !== 'string' || typeof hqText !== 'string' || typeof sqText !== 'string') {
    return fail('音乐数据表尚未初始化。', 'DATASET_NOT_READY', 503);
  }
  const tags = normalizeMusicTagRecords(parseJsonl(tagText, DATASETS.music_tag.header).records);
  const tag = tags.find((record) => Number(record.tag_id) === tagId);
  if (!tag) return fail('歌单不存在。', 'PLAYLIST_NOT_FOUND', 404);
  const hqRecords = parseJsonl(hqText, DATASETS.music_hq.header).records;
  const sqRecords = parseJsonl(sqText, DATASETS.music_sq.header).records;
  const membersFor = (records) => records
    .filter((record) => Array.isArray(record.list) && record.list.map(Number).includes(tagId))
    .map((record) => Number(record.mid)).sort((left, right) => left - right);
  const hqMembers = membersFor(hqRecords);
  const sqMembers = membersFor(sqRecords);
  if (hqMembers.length !== sqMembers.length || hqMembers.some((mid, index) => mid !== sqMembers[index])) {
    return fail('HQ 与 SQ 的歌单成员不同，请先同步两张音乐表。', 'MUSIC_LIST_MISMATCH', 409);
  }
  const reconciledTag = reconcileMusicTagOrders(tags, hqRecords)
    .find((record) => Number(record.tag_id) === tagId);
  return {tags, tag: reconciledTag || tag, members: hqMembers};
}

async function getMusicOrder(url) {
  const result = await musicOrderSnapshot(Number(url.searchParams.get('tagId')));
  if (result instanceof Response) return result;
  return json({
    success: true,
    data: {
      tagId: Number(result.tag.tag_id),
      tagName: String(result.tag.tag_name || ''),
      mids: result.tag.music_order,
      headSha: null,
    },
  }, 200, 'no-store');
}

async function saveMusicOrder(request) {
  const body = await readBody(request);
  const tagId = Number(body.tagId);
  if (!Array.isArray(body.mids)) return fail('mids 必须是数组。', 'INVALID_MUSIC_ORDER');
  const seen = new Set();
  const mids = body.mids.map(Number).filter((mid) => {
    if (!Number.isInteger(mid) || mid < 0 || seen.has(mid)) return false;
    seen.add(mid);
    return true;
  });
  if (mids.length !== body.mids.length) return fail('曲目顺序中包含无效或重复的 mid。', 'INVALID_MUSIC_ORDER');

  const current = await musicOrderSnapshot(tagId);
  if (current instanceof Response) return current;
  const {tags, tag, members} = current;
  const memberSet = new Set(members);
  if (mids.length !== members.length || mids.some((mid) => !memberSet.has(mid))) {
    return fail('提交的顺序必须完整包含该歌单的全部曲目。', 'INCOMPLETE_MUSIC_ORDER');
  }
  const nextTags = tags.map((record) => Number(record.tag_id) === tagId ? {...record, music_order: mids} : record);
  const tagContent = serializeJsonl(DATASETS.music_tag, nextTags);
  const revision = await writeDatasets([{dataset: DATASETS.music_tag, content: tagContent}]);
  const gitSync = await mirrorToGitHub(
    [{path: DATASETS.music_tag.path, content: tagContent}],
    `音乐：调整歌单「${String(tag.tag_name || tagId)}」的曲目顺序`,
  );
  return json({success: true, data: {revision, tagId, mids, gitSync}}, 201);
}

function datasetList() {
  return Object.entries(DATASETS).map(([name, dataset]) => ({
    name,
    label: dataset.label,
    path: dataset.path,
  }));
}

async function exportContent(url) {
  const type = url.searchParams.get('type');
  if (type === 'dataset') {
    const dataset = DATASETS[url.searchParams.get('name')];
    if (!dataset) return fail('未知的数据表。', 'INVALID_DATASET');
    const text = await readDatasetText(dataset);
    if (typeof text !== 'string') return fail('数据表尚未初始化。', 'DATASET_NOT_READY', 503);
    const filename = dataset.path.split('/').pop();
    return new Response(text, {
      status: 200,
      headers: responseHeaders({
        'content-type': 'application/x-ndjson; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      }),
    });
  }
  if (type === 'article') {
    const path = allowedContentPath(url.searchParams.get('path'));
    if (!path) return fail('文章路径无效。', 'INVALID_CONTENT_PATH');
    const text = await readContent(articleKey(path));
    if (typeof text !== 'string') return fail('文章不存在。', 'NOT_FOUND', 404);
    const filename = path.split('/').pop();
    return new Response(text, {
      status: 200,
      headers: responseHeaders({
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      }),
    });
  }
  return fail('导出类型无效。', 'INVALID_EXPORT_TYPE');
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
    if (url.pathname === '/api/console/music-tags' && request.method === 'POST') return await saveMusicTags(request);
    if (url.pathname === '/api/console/music-order' && request.method === 'GET') return await getMusicOrder(url);
    if (url.pathname === '/api/console/music-order' && request.method === 'POST') return await saveMusicOrder(request);
    if (url.pathname === '/api/console/files' && request.method === 'GET') return await listFiles();
    if (url.pathname === '/api/console/file' && request.method === 'GET') return await getFile(url);
    if (url.pathname === '/api/console/file' && request.method === 'POST') return await saveFile(request);
    if (url.pathname === '/api/console/file' && request.method === 'DELETE') return await deleteFile(request);
    if (url.pathname === '/api/console/upload' && request.method === 'POST') return await uploadArticles(request);
    if (url.pathname === '/api/console/download' && request.method === 'GET') return await exportContent(url);
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
