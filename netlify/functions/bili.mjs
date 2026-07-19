import { getStore } from '@netlify/blobs';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { ALLOWED_MV_PAGES } from './catalog.mjs';

const BILI_API = 'https://api.bilibili.com';
const BILI_PASSPORT = 'https://passport.bilibili.com';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const SESSION_KEY = 'session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BV_RE = /^BV[0-9A-Za-z]{10}$/;
const QUALITY_NAMES = new Map([[6, '240P'], [16, '360P'], [32, '480P'], [64, '720P'], [74, '720P60'], [80, '1080P'], [112, '1080P+'], [116, '1080P60'], [120, '4K'], [125, 'HDR'], [126, '杜比视界'], [127, '8K']]);
// 这些是 B 站公开的标准画质编号。每一个 DASH 档位都会先尝试 BiliAnalysis
// 使用的 html5/durl 单段 MP4；只有接口实际返回同一档位时才采用该快速直链。
const BILIANALYSIS_PROGRESSIVE_QUALITIES = new Set(QUALITY_NAMES.keys());
const VIEW_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const PERSISTED_VIEW_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_CACHED_VIEWS = 256;
const videoViewCache = new Map();
const WARM_SESSION_TTL_MS = 3 * 60 * 1000;
const WARM_AUTH_TTL_MS = 3 * 60 * 1000;
// 实测大陆直连时，playurl 偶尔会把客户端分配到跨境的 cosov 节点；该节点会
// 以远低于视频码率的速度传输。ALIB 是同一份已签名 UPOS 资源的国内镜像，保留
// 原始 URL 作为前端自动回退源。
const FAST_UPOS_MIRROR = 'upos-sz-mirroralib.bilivideo.com';
let warmSession = null;
let warmAuthentication = null;

export const config = {
  path: [
    '/api/health',
    '/api/resolve',
    '/api/fast',
    '/api/manifest/*',
    '/api/admin/status',
    '/api/admin/login/qr',
    '/api/admin/login/qr/status',
    '/api/admin/session/import',
    '/api/admin/logout',
  ],
  preferStatic: false,
};

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
}

function failure(message, code, status, headers) {
  return json({ success: false, code, message }, status, headers);
}

function configuredOrigin(request) {
  return process.env.BILI_ALLOWED_ORIGIN || new URL(request.url).origin;
}

function originAllowed(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin || origin === configuredOrigin(request);
}

function cors(request) {
  const origin = request.headers.get('origin');
  const headers = { 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Authorization, Content-Type', 'access-control-max-age': '600', vary: 'Origin' };
  if (origin && originAllowed(request)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function encryptionKey() {
  const secret = process.env.BILI_SESSION_ENCRYPTION_KEY;
  if (!secret || secret.length < 24) throw new Error('Netlify 未设置 BILI_SESSION_ENCRYPTION_KEY。');
  return createHash('sha256').update(secret).digest();
}

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(value) {
  const [iv, tag, encrypted] = String(value || '').split('.');
  if (!iv || !tag || !encrypted) throw new Error('加密状态格式无效。');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8'));
}

function stateStore() {
  return getStore('bili-parser-state');
}

async function loadState(key) {
  const store = stateStore();
  const raw = await store.get(key, { type: 'text', consistency: 'strong' });
  if (!raw) return null;
  try {
    const value = decrypt(raw);
    if (value?.expiresAt && value.expiresAt <= Date.now()) {
      await store.delete(key);
      return null;
    }
    return value;
  } catch {
    await store.delete(key);
    return null;
  }
}

async function saveState(key, value, ttl) {
  await stateStore().set(key, encrypt({ ...value, expiresAt: Date.now() + ttl }));
}

function netlifyClientIP(request) {
  // 只信任 Netlify 注入的连接 IP，不能读取客户端可伪造的 X-Forwarded-For。
  // bili-parse 通过 X-Real-IP 让 B 站按观看者的网络选择 upos 节点；这里把
  // 同一做法限定为真实的站点访问 IP，避免 Cloud 函数所在地区给国内用户选到远端 CDN。
  const address = String(request.headers.get('x-nf-client-connection-ip') || '').split(',', 1)[0].trim();
  return address.length <= 45 && /^[0-9a-f:.]+$/i.test(address) ? address : '';
}

function requestHeaders(session, clientIP = '') {
  const headers = new Headers({
    'user-agent': USER_AGENT,
    accept: 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    origin: 'https://www.bilibili.com',
    referer: 'https://www.bilibili.com/',
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="124", "Google Chrome";v="124"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site'
  });
  if (clientIP) headers.set('x-real-ip', clientIP);
  if (session?.cookies?.length) headers.set('cookie', session.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '));
  return headers;
}

async function biliJSON(url, session, clientIP = '') {
  const response = await fetch(url, { headers: requestHeaders(session, clientIP), redirect: 'follow' });
  let body;
  try { body = await response.json(); } catch { throw new Error(`B 站接口返回无效响应（HTTP ${response.status}）。`); }
  if (!response.ok || body.code !== 0) throw new Error(body.message || `B 站接口请求失败（HTTP ${response.status}）。`);
  return body.data;
}

function pruneVideoViewCache() {
  const now = Date.now();
  for (const [bvid, entry] of videoViewCache) {
    if (entry.expiresAt <= now) videoViewCache.delete(bvid);
  }
  while (videoViewCache.size > MAX_CACHED_VIEWS) videoViewCache.delete(videoViewCache.keys().next().value);
}

function compactVideoView(view) {
  const pages = Array.isArray(view?.pages) ? view.pages.map((page) => ({ cid: Number(page?.cid) || 0 })) : [];
  const ownerName = String(view?.owner?.name || '').trim();
  const ownerMid = Number(view?.owner?.mid || 0);
  return {
    pages,
    title: String(view?.title || ''),
    owner: ownerName ? { name: ownerName, mid: Number.isSafeInteger(ownerMid) && ownerMid > 0 ? ownerMid : null } : null
  };
}

function cachedVideoView(value) {
  return Array.isArray(value?.pages) && value.pages.length > 0 && value.pages.every((page) => Number.isSafeInteger(Number(page?.cid)) && Number(page.cid) > 0);
}

async function videoView(bvid, login) {
  const cached = videoViewCache.get(bvid);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  const entry = { expiresAt: Date.now() + VIEW_CACHE_TTL_MS, promise: null };
  entry.promise = (async () => {
    // 对应 bili-parse 的 Redis CID 缓存。CID/作者资料不携带登录态，因而能安全地
    // 跨 Netlify 冷启动复用；每位用户仍会以自己的 IP 请求 playurl 选择 CDN。
    try {
      const stored = await loadState(`video-view:${bvid}`);
      if (cachedVideoView(stored?.view)) return stored.view;
    } catch {}
    const viewURL = new URL(`${BILI_API}/x/web-interface/view`);
    viewURL.searchParams.set('bvid', bvid);
    const view = compactVideoView(await biliJSON(viewURL, login));
    try { await saveState(`video-view:${bvid}`, { view }, PERSISTED_VIEW_CACHE_TTL_MS); } catch {}
    return view;
  })().catch((error) => {
    videoViewCache.delete(bvid);
    throw error;
  });
  videoViewCache.set(bvid, entry);
  pruneVideoViewCache();
  return entry.promise;
}

function sessionIdentity(value) {
  if (!value) return '';
  if (value.savedAt) return String(value.savedAt);
  return String(value.cookies?.find((cookie) => cookie.name === 'SESSDATA')?.value || '');
}

function cacheSession(value) {
  warmSession = { value, expiresAt: Date.now() + WARM_SESSION_TTL_MS };
  warmAuthentication = null;
}

function clearSessionCache() {
  warmSession = null;
  warmAuthentication = null;
}

async function session() {
  if (warmSession?.expiresAt > Date.now()) return warmSession.value;
  const value = await loadState(SESSION_KEY);
  const login = Array.isArray(value?.cookies) && value.cookies.some((cookie) => cookie.name === 'SESSDATA' && cookie.value) ? value : null;
  cacheSession(login);
  return login;
}

async function sessionIsValid(value) {
  const login = value || await session();
  if (!login) return false;
  const identity = sessionIdentity(login);
  if (warmAuthentication?.identity === identity && warmAuthentication.expiresAt > Date.now()) return warmAuthentication.authenticated;
  let authenticated = false;
  try { authenticated = Boolean((await biliJSON(`${BILI_API}/x/web-interface/nav`, login))?.isLogin); } catch {}
  warmAuthentication = { identity, authenticated, expiresAt: Date.now() + WARM_AUTH_TTL_MS };
  return authenticated;
}

function isAdmin(request) {
  const secret = process.env.BILI_PARSER_ADMIN_TOKEN || '';
  const authorization = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (!secret || authorization.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

function sourceURL(media) { return media?.baseUrl || media?.base_url || ''; }

function acceleratedUPOSURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !/(^|\.)(bilivideo|acgvideo)\.com$/i.test(url.hostname)) return value;
    url.hostname = FAST_UPOS_MIRROR;
    return url.toString();
  } catch {
    return value;
  }
}

function sourceURLs(media) {
  const primary = sourceURL(media);
  const backups = Array.isArray(media?.backupUrl) ? media.backupUrl : Array.isArray(media?.backup_url) ? media.backup_url : [];
  const direct = [primary, ...backups].map((value) => String(value || '').trim()).filter((value) => /^https:\/\//i.test(value));
  return [...new Set([...direct.map(acceleratedUPOSURL), ...direct])];
}

function segmentBase(media) {
  const segment = media?.segment_base || media?.segmentBase;
  const indexRange = segment?.index_range || segment?.indexRange;
  return segment?.initialization && indexRange ? { initialization: segment.initialization, indexRange } : null;
}

function codecScore(media) {
  const codec = String(media?.codecs || '').toLowerCase();
  if (codec.startsWith('avc1')) return 0;
  if (codec.startsWith('av01')) return 1;
  if (codec.startsWith('hev1') || codec.startsWith('hvc1')) return 2;
  return 3;
}

function chooseVideo(videos, quality) {
  return videos.filter((video) => Number(video?.id) === quality && sourceURL(video) && segmentBase(video)).sort((a, b) => codecScore(a) - codecScore(b) || Number(b.bandwidth || 0) - Number(a.bandwidth || 0))[0] || null;
}

function chooseAudio(audios) {
  return audios.filter((audio) => sourceURL(audio) && segmentBase(audio) && /^mp4a/i.test(String(audio?.codecs || ''))).sort((a, b) => Number(b.bandwidth || 0) - Number(a.bandwidth || 0))[0] || null;
}

function compactMedia(media) {
  const urls = sourceURLs(media);
  return { url: urls[0] || '', backupUrls: urls.slice(1), codecs: media.codecs, bandwidth: Number(media.bandwidth) || 1, width: Number(media.width) || 0, height: Number(media.height) || 0, frameRate: media.frameRate || media.frame_rate || '', segmentBase: segmentBase(media) };
}

function qualityName(format, video, quality) {
  const display = String(format?.display_desc || '').trim();
  const superscript = String(format?.superscript || '').replace(/帧/g, '').trim();
  if (display) return `${display}${superscript}`;
  const height = Number(video?.height) || 0;
  if (height >= 4320) return '8K';
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  return QUALITY_NAMES.get(quality) || format?.new_description || `${quality}P`;
}

function xml(value) {
  return String(value ?? '').replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]));
}

function manifest(playback, quality) {
  const video = playback.tracks[String(quality)];
  const audio = playback.audio;
  if (!video || !audio) throw new Error('请求的画质不存在。');
  const duration = Math.max(1, Number(playback.duration) || 1);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT1.5S" mediaPresentationDuration="PT${duration}S"><Period duration="PT${duration}S"><AdaptationSet mimeType="video/mp4" contentType="video" segmentAlignment="true" startWithSAP="1"><Representation id="video-${quality}" bandwidth="${video.bandwidth}" codecs="${xml(video.codecs)}" width="${video.width}" height="${video.height}" frameRate="${xml(video.frameRate)}"><BaseURL>${xml(video.url)}</BaseURL><SegmentBase indexRange="${xml(video.segmentBase.indexRange)}"><Initialization range="${xml(video.segmentBase.initialization)}"/></SegmentBase></Representation></AdaptationSet><AdaptationSet mimeType="audio/mp4" contentType="audio" segmentAlignment="true" startWithSAP="1"><Representation id="audio" bandwidth="${audio.bandwidth}" codecs="${xml(audio.codecs)}"><BaseURL>${xml(audio.url)}</BaseURL><SegmentBase indexRange="${xml(audio.segmentBase.indexRange)}"><Initialization range="${xml(audio.segmentBase.initialization)}"/></SegmentBase></Representation></AdaptationSet></Period></MPD>`;
}

function importedCookies(cookies) {
  if (!Array.isArray(cookies) || cookies.length === 0 || cookies.length > 64) return null;
  const values = cookies.map((cookie) => ({ name: String(cookie?.name || '').trim(), value: String(cookie?.value || '').trim() })).filter((cookie) => cookie.name && cookie.value && cookie.name.length <= 128 && cookie.value.length <= 8192);
  return values.length === cookies.length && values.some((cookie) => cookie.name === 'SESSDATA') ? values : null;
}

async function resolve(request, url) {
  const bvid = url.searchParams.get('bvid') || '';
  const page = Number(url.searchParams.get('p') || '1');
  if (!BV_RE.test(bvid) || !Number.isInteger(page) || ALLOWED_MV_PAGES.get(bvid) !== page) return failure('只允许解析音乐页已收录的 BVID 与分 P。', 'VIDEO_NOT_ALLOWED', 400, cors(request));
  const login = await session();
  if (!login) return failure('解析服务尚未由站点管理员登录 B 站。', 'SERVICE_NOT_LOGGED_IN', 503, cors(request));
  // video-view 命中后可立即得到 CID。此时再把登录校验与 playurl 并行发出，
  // 避免原先“先 nav、后 playurl”的两段串行等待。
  const view = await videoView(bvid, login);
  const pageInfo = view?.pages?.[page - 1];
  if (!pageInfo?.cid) return failure('该视频没有指定的分 P。', 'PAGE_NOT_FOUND', 404, cors(request));
  const playURL = new URL(`${BILI_API}/x/player/playurl`);
  // 不固定 qn，让已登录帐号的权限决定最高画质并返回全部实际 DASH 轨道；固定
  // qn=127 在部分大会员会话中反而会被降为 1080P。仍保留 html5 平台，因为它
  // 生成的媒体 URL 可在浏览器 no-referrer 策略下直接播放；platform=pc 的 URL
  // 需要 B 站 Referer，网页直连会得到 403。
  playURL.search = new URLSearchParams({ bvid, cid: String(pageInfo.cid), fnval: '4048', fnver: '0', fourk: '1', high_quality: '1', platform: 'html5' }).toString();
  // Bili-parse 会把访问者 IP 带给 B 站，以便返回距离观看者更近的 upos CDN。
  // 在 Netlify 上若省略该头，B 站会按函数机房而非用户网络挑选下载节点。
  // 前端进入恢复流程时会带 refresh。该标记也必须穿透至 B 站 API，避免某些
  // 边缘节点按相同查询缓存住已经失效的 playurl 响应。
  if (url.searchParams.has('refresh')) playURL.searchParams.set('_', String(Date.now()));
  const [loggedIn, data] = await Promise.all([sessionIsValid(login), biliJSON(playURL, login, netlifyClientIP(request))]);
  if (!loggedIn) return failure('解析服务尚未由站点管理员登录 B 站。', 'SERVICE_NOT_LOGGED_IN', 503, cors(request));
  const audio = chooseAudio(data?.dash?.audio || []);
  if (!audio) return failure('B 站没有返回可播放的 DASH 音频轨道。', 'NO_AUDIO_TRACK', 502, cors(request));
  const formats = new Map((data.support_formats || []).map((format) => [Number(format.quality), format]));
  const qualities = [...new Set((data?.dash?.video || []).map((video) => Number(video?.id)).filter((quality) => Number.isInteger(quality) && quality > 0))].sort((a, b) => b - a);
  const tracks = {};
  const sources = [];
  for (const quality of qualities) {
    const video = chooseVideo(data.dash.video, quality);
    if (!video) continue;
    tracks[String(quality)] = compactMedia(video);
    sources.push({ code: `dash-${quality}`, qn: quality, label: qualityName(formats.get(quality), video, quality), resolution: `${Number(video.width) || 0}×${Number(video.height) || 0}`, type: 'application/dash+xml', fastProgressive: BILIANALYSIS_PROGRESSIVE_QUALITIES.has(quality) });
  }
  if (!sources.length) return failure('B 站没有返回可播放的 DASH 视频轨道。', 'NO_VIDEO_TRACK', 502, cors(request));
  sources.sort((a, b) => b.qn - a.qn);
  // 将短时 DASH 清单直接回传给页面。前端会转成 Blob URL，省去一次 Blob
  // 写入和紧随其后的 manifest 请求，点击 MV 后可以更快开始缓冲。
  const playback = { duration: data.dash.duration, audio: compactMedia(audio), tracks };
  for (const source of sources) {
    source.manifest = manifest(playback, source.qn);
    source.candidates = { video: tracks[String(source.qn)].backupUrls, audio: playback.audio.backupUrls };
  }
  const ownerName = String(view?.owner?.name || '').trim();
  const ownerMid = Number(view?.owner?.mid || 0);
  const owner = ownerName ? { name: ownerName, mid: Number.isSafeInteger(ownerMid) && ownerMid > 0 ? ownerMid : null } : null;
  return json(
    { success: true, data: { bvid, page, cid: pageInfo.cid, title: view.title || '', owner, sources, highestQuality: sources[0].qn, has1080p: sources.some((source) => source.qn >= 80) } },
    200,
    // DASH 签名会随着用户网络、登录会话与 CDN 状态而变化。视频信息已由函数
    // 内部缓存；这里绝不能让浏览器缓存 /resolve，否则恢复播放会反复拿到刚刚
    // 失效的链接，只有强制刷新页面才能偶尔恢复。
    { ...cors(request), 'cache-control': 'no-store' }
  );
}

// 与 BiliAnalysis 的本地快速解析一致：先请求 html5 playurl 的 durl MP4。
// 对所有标准画质均会尝试，但只接受实际返回画质相同的单段 MP4；CID 已由同一
// 受限 MV 的 /resolve 返回，避免再做一次 pagelist/view 查询。接口不支持、降档
// 或分段时明确失败，前端随即回退到同画质的已登录 DASH。
async function fastProgressive(request, url) {
  const bvid = url.searchParams.get('bvid') || '';
  const page = Number(url.searchParams.get('p') || '1');
  const cid = Number(url.searchParams.get('cid') || '0');
  const quality = Number(url.searchParams.get('qn') || '0');
  if (!BV_RE.test(bvid) || !Number.isInteger(page) || ALLOWED_MV_PAGES.get(bvid) !== page || !Number.isSafeInteger(cid) || cid <= 0 || !BILIANALYSIS_PROGRESSIVE_QUALITIES.has(quality)) {
    return failure('快速解析参数无效或该视频未收录。', 'FAST_SOURCE_NOT_ALLOWED', 400, cors(request));
  }
  const login = await session();
  if (!login) return failure('解析服务尚未由站点管理员登录 B 站。', 'SERVICE_NOT_LOGGED_IN', 503, cors(request));
  const playURL = new URL(`${BILI_API}/x/player/playurl`);
  playURL.search = new URLSearchParams({ bvid, cid: String(cid), qn: String(quality), type: '', otype: 'json', platform: 'html5', high_quality: '1' }).toString();
  const data = await biliJSON(playURL, login, netlifyClientIP(request));
  const segments = Array.isArray(data?.durl) ? data.durl : [];
  const first = segments[0];
  const actualQuality = Number(data?.quality) || quality;
  if (actualQuality !== quality || segments.length !== 1 || !first?.url) return failure('该画质没有精确的单段 MP4 直链，将使用 DASH 播放。', 'FAST_SOURCE_UNAVAILABLE', 422, cors(request));
  return json({ success: true, data: { qn: actualQuality, url: first.url, backupUrls: Array.isArray(first.backup_url) ? first.backup_url : [], type: 'video/mp4' } }, 200, cors(request));
}

async function importSession(request) {
  let payload;
  try { payload = await request.json(); } catch { return failure('导入内容必须是 JSON。', 'INVALID_SESSION_IMPORT', 400); }
  const cookies = importedCookies(payload?.cookies || payload?.session?.cookies);
  if (!cookies) return failure('导入内容不包含有效的 SESSDATA Cookie。', 'INVALID_SESSION_IMPORT', 400);
  const value = { cookies, savedAt: new Date().toISOString() };
  await saveState(SESSION_KEY, value, SESSION_TTL_MS);
  cacheSession(value);
  return json({ success: true, data: { imported: true, authenticated: await sessionIsValid() } });
}

function parseCookies(response) {
  const raw = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
  return raw.map((value) => value.split(';', 1)[0]).map((value) => {
    const divider = value.indexOf('=');
    return divider > 0 ? { name: value.slice(0, divider).trim(), value: value.slice(divider + 1).trim() } : null;
  }).filter(Boolean);
}

async function createQR() {
  const data = await biliJSON(`${BILI_PASSPORT}/x/passport-login/web/qrcode/generate`);
  if (!data?.qrcode_key || !data?.url) return failure('B 站没有返回二维码。', 'QR_UNAVAILABLE', 502);
  return json({ success: true, data: { key: data.qrcode_key, url: data.url, expiresAt: Date.now() + 170000 } });
}

async function pollQR(url) {
  const key = url.searchParams.get('key') || '';
  if (!key || key.length > 128) return failure('二维码 key 无效。', 'INVALID_QR_KEY', 400);
  const pollURL = new URL(`${BILI_PASSPORT}/x/passport-login/web/qrcode/poll`);
  pollURL.searchParams.set('qrcode_key', key);
  const response = await fetch(pollURL, { headers: requestHeaders() });
  const body = await response.json();
  if (!response.ok || body.code !== 0) return failure(body.message || '二维码状态查询失败。', 'QR_POLL_FAILED', 502);
  if (Number(body.data?.code) !== 0) return json({ success: true, data: { state: 'pending', code: body.data?.code, message: body.data?.message || '等待扫码确认' } });
  const cookies = parseCookies(response);
  if (!cookies.some((cookie) => cookie.name === 'SESSDATA')) return failure('登录响应没有包含 SESSDATA。', 'SESSION_MISSING', 502);
  const value = { cookies, savedAt: new Date().toISOString() };
  await saveState(SESSION_KEY, value, SESSION_TTL_MS);
  cacheSession(value);
  return json({ success: true, data: { state: 'success', authenticated: await sessionIsValid() } });
}

export default async (request) => {
  if (!originAllowed(request)) return failure('页面来源未被允许。', 'ORIGIN_NOT_ALLOWED', 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/health' && request.method === 'GET') return json({ success: true, data: { authenticated: await sessionIsValid(), deployment: 'netlify-function' } }, 200, cors(request));
    if (url.pathname === '/api/resolve' && request.method === 'GET') return await resolve(request, url);
    if (url.pathname === '/api/fast' && request.method === 'GET') return await fastProgressive(request, url);
    const manifestMatch = url.pathname.match(/^\/api\/manifest\/([0-9a-f-]{36})\/(\d+)\.mpd$/i);
    if (manifestMatch && request.method === 'GET') {
      const playback = await loadState(`playback:${manifestMatch[1]}`);
      if (!playback?.tracks?.[manifestMatch[2]]) return failure('播放清单已过期，请重新解析。', 'MANIFEST_EXPIRED', 404, cors(request));
      return new Response(manifest(playback, manifestMatch[2]), { headers: { 'content-type': 'application/dash+xml; charset=utf-8', 'cache-control': 'no-store', ...cors(request) } });
    }
    if (!url.pathname.startsWith('/api/admin/')) return failure('接口不存在。', 'NOT_FOUND', 404, cors(request));
    if (!isAdmin(request)) return failure('管理员令牌无效。', 'ADMIN_UNAUTHORIZED', 401, cors(request));
    if (url.pathname === '/api/admin/status' && request.method === 'GET') return json({ success: true, data: { authenticated: await sessionIsValid() } }, 200, cors(request));
    if (url.pathname === '/api/admin/login/qr' && request.method === 'POST') return await createQR();
    if (url.pathname === '/api/admin/login/qr/status' && request.method === 'GET') return await pollQR(url);
    if (url.pathname === '/api/admin/session/import' && request.method === 'POST') return await importSession(request);
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') { await stateStore().delete(SESSION_KEY); clearSessionCache(); return json({ success: true, data: { authenticated: false } }); }
    return failure('接口不存在。', 'NOT_FOUND', 404, cors(request));
  } catch (caught) {
    console.error('[netlify-bili]', caught instanceof Error ? caught.message : String(caught));
    return failure(caught instanceof Error ? caught.message : 'Netlify 解析失败。', 'UPSTREAM_ERROR', 502, cors(request));
  }
};
