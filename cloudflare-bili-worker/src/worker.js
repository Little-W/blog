import { ALLOWED_MV_PAGES } from './catalog.js';

const BILI_API = 'https://api.bilibili.com';
const BILI_PASSPORT = 'https://passport.bilibili.com';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const SESSION_KEY = 'session';
const PLAYBACK_TTL_SECONDS = 90 * 60;
const BV_RE = /^BV[0-9A-Za-z]{10}$/;
const QUALITY_NAMES = new Map([
  [6, '240P'], [16, '360P'], [32, '480P'], [64, '720P'], [74, '720P60'],
  [80, '1080P'], [112, '1080P+'], [116, '1080P60'], [120, '4K'], [125, 'HDR'],
  [126, '杜比视界'], [127, '8K']
]);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function isBvid(value) {
  return typeof value === 'string' && BV_RE.test(value);
}

export function compactQualityName(format, video, quality) {
  const display = String(format?.display_desc || '').trim();
  const superscript = String(format?.superscript || '').replace(/帧/g, '').trim();
  if (display) return `${display}${superscript}`;
  if (Number(quality) === 127) return '8K';
  if (Number(quality) === 126) return '杜比视界';
  if (Number(quality) === 125) return 'HDR';
  if (Number(quality) === 120) return '4K';
  if (Number(quality) === 116) return '1080P60';
  if (Number(quality) === 112) return '1080P+';
  const height = Number(video?.height) || 0;
  if (height >= 4320) return '8K';
  if (height >= 2160) return '4K';
  if (height >= 1440) return '2K';
  return format?.new_description || QUALITY_NAMES.get(Number(quality)) || `${quality}P`;
}

function base64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function encryptionKey(secret) {
  if (!secret || secret.length < 24) throw new Error('BILI_SESSION_ENCRYPTION_KEY 未配置或长度不足。');
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptJSON(value, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), textEncoder.encode(JSON.stringify(value)));
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}

async function decryptJSON(value, secret) {
  const [iv, encrypted] = String(value || '').split('.');
  if (!iv || !encrypted) throw new Error('加密状态格式无效。');
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await encryptionKey(secret), fromBase64(encrypted));
  return JSON.parse(textDecoder.decode(plain));
}

async function loadState(env, key) {
  const encrypted = await env.BILI_STATE.get(key);
  if (!encrypted) return null;
  try {
    return await decryptJSON(encrypted, env.BILI_SESSION_ENCRYPTION_KEY);
  } catch {
    await env.BILI_STATE.delete(key);
    return null;
  }
}

async function saveState(env, key, value, expirationTtl) {
  const encrypted = await encryptJSON(value, env.BILI_SESSION_ENCRYPTION_KEY);
  await env.BILI_STATE.put(key, encrypted, { expirationTtl });
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers
    }
  });
}

function error(message, code, status, headers) {
  return json({ success: false, code, message }, status, headers);
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const ownOrigin = new URL(request.url).origin;
  return origin === ownOrigin || (env.ALLOWED_SITE_ORIGIN && origin === env.ALLOWED_SITE_ORIGIN);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const headers = {
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type, Range',
    'access-control-expose-headers': 'Content-Range, Accept-Ranges, Content-Length, Content-Type',
    'access-control-max-age': '600',
    vary: 'Origin'
  };
  if (origin && allowedOrigin(request, env)) headers['access-control-allow-origin'] = origin;
  return headers;
}

function requestHeaders(session) {
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
  if (session?.cookies?.length) headers.set('cookie', session.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '));
  return headers;
}

async function biliJSON(url, session) {
  const response = await fetch(url, { headers: requestHeaders(session) });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`B 站接口返回无效响应（HTTP ${response.status}）。`);
  }
  if (!response.ok || body.code !== 0) throw new Error(body.message || `B 站接口请求失败（HTTP ${response.status}）。`);
  return body.data;
}

async function getSession(env) {
  const session = await loadState(env, SESSION_KEY);
  return Array.isArray(session?.cookies) && session.cookies.some((cookie) => cookie?.name === 'SESSDATA' && cookie.value) ? session : null;
}

async function sessionIsValid(env) {
  const session = await getSession(env);
  if (!session) return false;
  try {
    const nav = await biliJSON(`${BILI_API}/x/web-interface/nav`, session);
    return Boolean(nav?.isLogin);
  } catch {
    return false;
  }
}

function parseSetCookie(raw) {
  const [pair] = String(raw || '').split(';');
  const separator = pair.indexOf('=');
  if (separator <= 0) return null;
  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();
  return name && value ? { name, value } : null;
}

function responseCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map(parseSetCookie).filter(Boolean);
}

async function isAdmin(request, env) {
  const authorization = request.headers.get('authorization') || '';
  const expected = `Bearer ${env.PARSER_ADMIN_TOKEN || ''}`;
  if (!env.PARSER_ADMIN_TOKEN || authorization.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < authorization.length; index += 1) difference |= authorization.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function mediaURL(media) {
  return media?.baseUrl || media?.base_url || '';
}

function segmentBase(media) {
  const segment = media?.segment_base || media?.segmentBase;
  return segment?.initialization && (segment.index_range || segment.indexRange) ? {
    initialization: segment.initialization,
    indexRange: segment.index_range || segment.indexRange
  } : null;
}

function codecScore(media) {
  const codecs = String(media?.codecs || '').toLowerCase();
  if (codecs.startsWith('avc1')) return 0;
  if (codecs.startsWith('av01')) return 1;
  if (codecs.startsWith('hev1') || codecs.startsWith('hvc1')) return 2;
  return 3;
}

function selectVideo(videos, quality) {
  return videos
    .filter((video) => Number(video?.id) === Number(quality) && mediaURL(video) && segmentBase(video))
    .sort((left, right) => codecScore(left) - codecScore(right) || Number(right.bandwidth || 0) - Number(left.bandwidth || 0))[0] || null;
}

function selectAudio(audios) {
  return audios
    .filter((audio) => mediaURL(audio) && segmentBase(audio) && /^mp4a/i.test(String(audio?.codecs || '')))
    .sort((left, right) => Number(right.bandwidth || 0) - Number(left.bandwidth || 0))[0] || null;
}

function compactMedia(media) {
  return {
    url: mediaURL(media),
    codecs: media.codecs,
    bandwidth: Number(media.bandwidth) || 1,
    width: Number(media.width) || 0,
    height: Number(media.height) || 0,
    frameRate: media.frameRate || media.frame_rate || '',
    segmentBase: segmentBase(media)
  };
}

function escapeXML(value) {
  return String(value ?? '').replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[character]));
}

export function dashManifest(playback, quality) {
  const video = playback.tracks[String(quality)];
  const audio = playback.audio;
  if (!video || !audio) throw new Error('请求的画质不存在。');
  const duration = Math.max(1, Number(playback.duration) || 1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT1.5S" mediaPresentationDuration="PT${duration}S">
  <Period duration="PT${duration}S">
    <AdaptationSet mimeType="video/mp4" contentType="video" segmentAlignment="true" startWithSAP="1">
      <Representation id="video-${quality}" bandwidth="${video.bandwidth}" codecs="${escapeXML(video.codecs)}" width="${video.width}" height="${video.height}" frameRate="${escapeXML(video.frameRate)}">
        <BaseURL>${escapeXML(video.url)}</BaseURL>
        <SegmentBase indexRange="${escapeXML(video.segmentBase.indexRange)}"><Initialization range="${escapeXML(video.segmentBase.initialization)}"/></SegmentBase>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4" contentType="audio" segmentAlignment="true" startWithSAP="1">
      <Representation id="audio" bandwidth="${audio.bandwidth}" codecs="${escapeXML(audio.codecs)}">
        <BaseURL>${escapeXML(audio.url)}</BaseURL>
        <SegmentBase indexRange="${escapeXML(audio.segmentBase.indexRange)}"><Initialization range="${escapeXML(audio.segmentBase.initialization)}"/></SegmentBase>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
}

async function resolveVideo(request, env, url) {
  const bvid = url.searchParams.get('bvid') || '';
  const page = Number(url.searchParams.get('p') || '1');
  if (!isBvid(bvid) || !Number.isInteger(page) || page < 1 || page > 100 || !ALLOWED_MV_PAGES.get(bvid)?.has(page)) {
    return error('只允许解析音乐页已收录的 BVID 与分 P。', 'VIDEO_NOT_ALLOWED', 400, corsHeaders(request, env));
  }
  const session = await getSession(env);
  if (!session || !(await sessionIsValid(env))) {
    return error('解析服务尚未由站点管理员登录 B 站。', 'SERVICE_NOT_LOGGED_IN', 503, corsHeaders(request, env));
  }
  const viewURL = new URL(`${BILI_API}/x/web-interface/view`);
  viewURL.searchParams.set('bvid', bvid);
  const view = await biliJSON(viewURL, session);
  const pageInfo = view?.pages?.[page - 1];
  if (!pageInfo?.cid) return error('该视频没有指定的分 P。', 'PAGE_NOT_FOUND', 404, corsHeaders(request, env));
  const playURL = new URL(`${BILI_API}/x/player/playurl`);
  // 对齐 bilidown：由已登录帐号的权限决定可请求的最高档位，而不是固定
  // qn=127。后者在部分大会员会话中会被 B 站降为 1080P，导致 1080P60/2K/4K
  // 轨道没有出现在 DASH 返回值中。
  playURL.search = new URLSearchParams({
    bvid,
    cid: String(pageInfo.cid),
    fnval: '4048',
    fnver: '0',
    fourk: '1'
  }).toString();
  const playInfo = await biliJSON(playURL, session);
  const audio = selectAudio(playInfo?.dash?.audio || []);
  if (!audio) return error('B 站没有返回可播放的 DASH 音频轨道。', 'NO_AUDIO_TRACK', 502, corsHeaders(request, env));
  const formats = new Map((playInfo.support_formats || []).map((format) => [Number(format.quality), format]));
  // 不维护白名单：B 站新增或仅对特定视频提供的 DASH 视频轨道也应进入菜单。
  // 标签优先使用 support_formats 的官方 display_desc/superscript。
  const qualities = [...new Set((playInfo?.dash?.video || []).map((video) => Number(video?.id)).filter((quality) => Number.isInteger(quality) && quality > 0))].sort((left, right) => right - left);
  const tracks = {};
  const sources = [];
  const token = crypto.randomUUID();
  const workerOrigin = new URL(request.url).origin;
  for (const quality of qualities) {
    const video = selectVideo(playInfo.dash.video, quality);
    if (!video) continue;
    tracks[String(quality)] = compactMedia(video);
    sources.push({
      code: `dash-${quality}`,
      qn: quality,
      label: compactQualityName(formats.get(quality), video, quality),
      resolution: `${Number(video.width) || 0}×${Number(video.height) || 0}`,
      url: `${workerOrigin}/api/manifest/${token}/${quality}.mpd`,
      type: 'application/dash+xml'
    });
  }
  if (!sources.length) return error('B 站没有返回可播放的 DASH 视频轨道。', 'NO_VIDEO_TRACK', 502, corsHeaders(request, env));
  sources.sort((left, right) => right.qn - left.qn);
  await saveState(env, `playback:${token}`, {
    createdAt: Date.now(),
    duration: playInfo.dash.duration,
    audio: compactMedia(audio),
    tracks
  }, PLAYBACK_TTL_SECONDS);
  return json({
    success: true,
    data: {
      bvid,
      page,
      cid: pageInfo.cid,
      title: view.title || '',
      sources,
      highestQuality: sources[0].qn,
      has1080p: sources.some((source) => source.qn >= 80)
    }
  }, 200, corsHeaders(request, env));
}

async function serveManifest(request, env, token, quality) {
  const playback = await loadState(env, `playback:${token}`);
  if (!playback?.tracks?.[quality]) return error('播放清单已过期，请重新解析。', 'MANIFEST_EXPIRED', 404, corsHeaders(request, env));
  return new Response(dashManifest(playback, quality), {
    headers: {
      'content-type': 'application/dash+xml; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...corsHeaders(request, env)
    }
  });
}

async function adminLoginQR(request, env) {
  const data = await biliJSON(`${BILI_PASSPORT}/x/passport-login/web/qrcode/generate`);
  if (!data?.qrcode_key || !data?.url) return error('B 站没有返回二维码。', 'QR_UNAVAILABLE', 502);
  return json({ success: true, data: { key: data.qrcode_key, url: data.url, expiresAt: Date.now() + 170000 } });
}

async function adminLoginStatus(url, env) {
  const key = url.searchParams.get('key') || '';
  if (!key || key.length > 128) return error('二维码 key 无效。', 'INVALID_QR_KEY', 400);
  const pollURL = new URL(`${BILI_PASSPORT}/x/passport-login/web/qrcode/poll`);
  pollURL.searchParams.set('qrcode_key', key);
  const response = await fetch(pollURL, { headers: requestHeaders() });
  const body = await response.json();
  if (!response.ok || body.code !== 0) return error(body.message || '二维码状态查询失败。', 'QR_POLL_FAILED', 502);
  if (Number(body.data?.code) !== 0) return json({ success: true, data: { state: 'pending', code: body.data?.code, message: body.data?.message || '等待扫码确认' } });
  const cookies = responseCookies(response);
  if (!cookies.some((cookie) => cookie.name === 'SESSDATA')) return error('登录响应没有包含 SESSDATA。', 'SESSION_MISSING', 502);
  await saveState(env, SESSION_KEY, { version: 1, savedAt: new Date().toISOString(), cookies }, 30 * 24 * 60 * 60);
  return json({ success: true, data: { state: 'success', message: 'B 站会话已加密保存到 Workers KV。' } });
}

function importedCookies(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 64) return null;
  const cookies = value.map((cookie) => ({
    name: String(cookie?.name || '').trim(),
    value: String(cookie?.value || '').trim()
  })).filter((cookie) => cookie.name && cookie.value && cookie.name.length <= 128 && cookie.value.length <= 8192);
  return cookies.length === value.length && cookies.some((cookie) => cookie.name === 'SESSDATA') ? cookies : null;
}

async function adminImportSession(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return error('导入内容必须是 JSON。', 'INVALID_SESSION_IMPORT', 400);
  }
  const cookies = importedCookies(payload?.cookies || payload?.session?.cookies);
  if (!cookies) return error('导入内容不包含有效的 SESSDATA Cookie。', 'INVALID_SESSION_IMPORT', 400);
  await saveState(env, SESSION_KEY, { version: 1, savedAt: new Date().toISOString(), cookies }, 30 * 24 * 60 * 60);
  return json({
    success: true,
    data: {
      imported: true,
      // 只报告 Worker 自身的校验结果，绝不返回任何 Cookie。
      authenticated: await sessionIsValid(env)
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!allowedOrigin(request, env)) return error('页面来源未被允许。', 'ORIGIN_NOT_ALLOWED', 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return json({ success: true, data: { authenticated: await sessionIsValid(env), deployment: 'cloudflare-worker' } }, 200, corsHeaders(request, env));
      }
      if (url.pathname === '/api/resolve' && request.method === 'GET') return await resolveVideo(request, env, url);
      const manifestMatch = url.pathname.match(/^\/api\/manifest\/([0-9a-f-]{36})\/(\d+)\.mpd$/i);
      if (manifestMatch && request.method === 'GET') return await serveManifest(request, env, manifestMatch[1], manifestMatch[2]);
      if (url.pathname === '/admin/status' && request.method === 'GET') {
        if (!(await isAdmin(request, env))) return error('管理员令牌无效。', 'ADMIN_UNAUTHORIZED', 401);
        return json({ success: true, data: { authenticated: await sessionIsValid(env) } });
      }
      if (url.pathname === '/admin/login/qr' && request.method === 'POST') {
        if (!(await isAdmin(request, env))) return error('管理员令牌无效。', 'ADMIN_UNAUTHORIZED', 401);
        return await adminLoginQR(request, env);
      }
      if (url.pathname === '/admin/login/qr/status' && request.method === 'GET') {
        if (!(await isAdmin(request, env))) return error('管理员令牌无效。', 'ADMIN_UNAUTHORIZED', 401);
        return await adminLoginStatus(url, env);
      }
      if (url.pathname === '/admin/session/import' && request.method === 'POST') {
        if (!(await isAdmin(request, env))) return error('管理员令牌无效。', 'ADMIN_UNAUTHORIZED', 401);
        return await adminImportSession(request, env);
      }
      if (url.pathname === '/admin/logout' && request.method === 'POST') {
        if (!(await isAdmin(request, env))) return error('管理员令牌无效。', 'ADMIN_UNAUTHORIZED', 401);
        await env.BILI_STATE.delete(SESSION_KEY);
        return json({ success: true, data: { authenticated: false } });
      }
      return error('资源不存在。', 'NOT_FOUND', 404, corsHeaders(request, env));
    } catch (caught) {
      console.error('[bili-worker]', caught instanceof Error ? caught.message : String(caught));
      return error(caught instanceof Error ? caught.message : 'Worker 解析失败。', 'UPSTREAM_ERROR', 502, corsHeaders(request, env));
    }
  }
};
