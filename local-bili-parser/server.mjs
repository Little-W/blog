import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const BILI_API = 'https://api.bilibili.com';
const BILI_PASSPORT = 'https://passport.bilibili.com';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const QUALITY_NAMES = new Map([
  [6, '240P'], [16, '360P'], [32, '480P'], [64, '720P'], [74, '720P60'],
  [80, '1080P'], [112, '1080P+'], [116, '1080P60'], [120, '4K'], [125, 'HDR'],
  [126, '杜比视界'], [127, '8K']
]);
const PLAYABLE_QUALITIES = new Set(QUALITY_NAMES.keys());
const BV_RE = /^BV[0-9A-Za-z]{10}$/;

export function parseOptions(argv) {
  const options = {
    host: '127.0.0.1',
    port: 19180,
    dataDir: process.env.BILI_PLAYER_DATA_DIR || join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'my-website-bili-player'),
    allowedOrigins: (process.env.BILI_PLAYER_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
      .split(',').map((value) => value.trim()).filter(Boolean)
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--host' && next) { options.host = next; index += 1; }
    else if (value === '--port' && next) { options.port = Number(next); index += 1; }
    else if (value === '--data-dir' && next) { options.dataDir = resolve(next); index += 1; }
    else if (value === '--allow-origin' && next) { options.allowedOrigins = next.split(',').map((origin) => origin.trim()).filter(Boolean); index += 1; }
    else if (value === '--help' || value === '-h') options.help = true;
    else throw new Error(`未知参数：${value}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('端口必须为 1–65535。');
  return options;
}

export function isBvid(value) {
  return typeof value === 'string' && BV_RE.test(value);
}

export function qualityName(quality) {
  return QUALITY_NAMES.get(Number(quality)) || `${quality}P`;
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
}

function fail(res, status, message, code = 'REQUEST_FAILED') {
  json(res, status, { success: false, code, message });
}

function parseCookie(raw) {
  const [pair, ...attributes] = raw.split(';');
  const delimiter = pair.indexOf('=');
  if (delimiter <= 0) return null;
  const cookie = { name: pair.slice(0, delimiter).trim(), value: pair.slice(delimiter + 1).trim() };
  for (const attribute of attributes) {
    const [key, ...attributeValue] = attribute.trim().split('=');
    const normalized = key.toLowerCase();
    if (normalized === 'domain') cookie.domain = attributeValue.join('=').trim();
    if (normalized === 'path') cookie.path = attributeValue.join('=').trim();
    if (normalized === 'expires') cookie.expires = attributeValue.join('=').trim();
    if (normalized === 'secure') cookie.secure = true;
    if (normalized === 'httponly') cookie.httpOnly = true;
  }
  return cookie.name && cookie.value ? cookie : null;
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const raw = headers.get('set-cookie');
  return raw ? [raw] : [];
}

function validCookies(cookies) {
  return Array.isArray(cookies) && cookies.every((cookie) =>
    cookie && typeof cookie.name === 'string' && cookie.name && typeof cookie.value === 'string' && cookie.value
  );
}

function cookieHeader(cookies) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

class SessionStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.path = join(dataDir, 'session.json');
  }

  async setup() {
    await mkdir(this.dataDir, { recursive: true, mode: 0o700 });
    await chmod(this.dataDir, 0o700);
  }

  async load() {
    try {
      const session = JSON.parse(await readFile(this.path, 'utf8'));
      return validCookies(session.cookies) ? session : null;
    } catch (error) {
      if (error && error.code === 'ENOENT') return null;
      throw new Error('本地登录信息无法读取；请删除 session.json 后重新登录。');
    }
  }

  async save(cookies) {
    if (!validCookies(cookies)) throw new Error('登录响应没有包含有效 Cookie。');
    await this.setup();
    const temporaryPath = `${this.path}.${randomUUID()}.tmp`;
    const payload = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), cookies }, null, 2);
    await writeFile(temporaryPath, payload, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.path);
    await chmod(this.path, 0o600);
  }

  async clear() {
    await rm(this.path, { force: true });
  }
}

async function biliJSON(url, cookies = []) {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      referer: 'https://www.bilibili.com/',
      ...(cookies.length ? { cookie: cookieHeader(cookies) } : {})
    },
    redirect: 'follow'
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`B 站接口返回了无效响应（HTTP ${response.status}）。`);
  }
  if (!response.ok || body.code !== 0) throw new Error(body.message || `B 站接口请求失败（HTTP ${response.status}）。`);
  return { data: body.data, headers: response.headers };
}

async function getAuthentication(session) {
  if (!session) return { authenticated: false };
  try {
    const { data } = await biliJSON(`${BILI_API}/x/web-interface/nav`, session.cookies);
    return { authenticated: Boolean(data?.isLogin), expiresAt: session.savedAt || null };
  } catch {
    return { authenticated: false };
  }
}

async function requestDashPlayInfo(bvid, cid, cookies) {
  const url = new URL(`${BILI_API}/x/player/playurl`);
  url.search = new URLSearchParams({
    bvid,
    cid: String(cid),
    // 与 bilidown 一致：4048 让官方接口返回完整 DASH 轨道，包含
    // 1080P60、2K、4K 等独立视频轨道，而非最高只到 1080P 的 durl MP4。
    qn: '127',
    fnval: '4048',
    fnver: '0',
    fourk: '1',
    platform: 'html5',
    high_quality: '1'
  }).toString();
  const { data } = await biliJSON(url, cookies);
  return data;
}

function escapeXML(value) {
  return String(value ?? '').replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
  }[character]));
}

function mediaURL(media) {
  return media?.baseUrl || media?.base_url || '';
}

function mediaSegmentBase(media) {
  const segmentBase = media?.segment_base || media?.segmentBase;
  return segmentBase?.initialization && (segmentBase.index_range || segmentBase.indexRange) ? {
    initialization: segmentBase.initialization,
    indexRange: segmentBase.index_range || segmentBase.indexRange
  } : null;
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
  return format?.new_description || qualityName(quality);
}

function videoCodecScore(media) {
  const codecs = String(media?.codecs || '').toLowerCase();
  if (codecs.startsWith('avc1')) return 0;
  if (codecs.startsWith('av01')) return 1;
  if (codecs.startsWith('hev1') || codecs.startsWith('hvc1')) return 2;
  return 3;
}

function selectDashVideo(videos, quality) {
  return videos
    .filter((video) => Number(video?.id) === Number(quality) && mediaURL(video) && mediaSegmentBase(video))
    .sort((left, right) => videoCodecScore(left) - videoCodecScore(right) || Number(right.bandwidth || 0) - Number(left.bandwidth || 0))[0] || null;
}

function selectDashAudio(audios) {
  return audios
    .filter((audio) => mediaURL(audio) && mediaSegmentBase(audio) && /^mp4a/i.test(String(audio?.codecs || '')))
    .sort((left, right) => Number(right.bandwidth || 0) - Number(left.bandwidth || 0))[0] || null;
}

export function dashManifestXML(token, duration, video, audio) {
  const videoSegmentBase = mediaSegmentBase(video);
  const audioSegmentBase = mediaSegmentBase(audio);
  const safeDuration = Math.max(1, Number(duration) || 1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" minBufferTime="PT1.5S" mediaPresentationDuration="PT${safeDuration}S">
  <Period duration="PT${safeDuration}S">
    <AdaptationSet mimeType="video/mp4" contentType="video" segmentAlignment="true" startWithSAP="1">
      <Representation id="video-${token}" bandwidth="${Number(video.bandwidth) || 1}" codecs="${escapeXML(video.codecs)}" width="${Number(video.width) || 0}" height="${Number(video.height) || 0}" frameRate="${escapeXML(video.frameRate || video.frame_rate || '')}">
        <BaseURL>../media/${token}/video</BaseURL>
        <SegmentBase indexRange="${escapeXML(videoSegmentBase.indexRange)}"><Initialization range="${escapeXML(videoSegmentBase.initialization)}"/></SegmentBase>
      </Representation>
    </AdaptationSet>
    <AdaptationSet mimeType="audio/mp4" contentType="audio" segmentAlignment="true" startWithSAP="1">
      <Representation id="audio-${token}" bandwidth="${Number(audio.bandwidth) || 1}" codecs="${escapeXML(audio.codecs)}">
        <BaseURL>../media/${token}/audio</BaseURL>
        <SegmentBase indexRange="${escapeXML(audioSegmentBase.indexRange)}"><Initialization range="${escapeXML(audioSegmentBase.initialization)}"/></SegmentBase>
      </Representation>
    </AdaptationSet>
  </Period>
</MPD>`;
}

function pruneManifests(manifests) {
  const now = Date.now();
  for (const [token, manifest] of manifests) {
    if (manifest.expiresAt <= now) manifests.delete(token);
  }
  while (manifests.size > 80) manifests.delete(manifests.keys().next().value);
}

async function resolveSources(bvid, page, session, apiBaseURL, manifests) {
  const viewURL = new URL(`${BILI_API}/x/web-interface/view`);
  viewURL.searchParams.set('bvid', bvid);
  const { data: view } = await biliJSON(viewURL, session.cookies);
  const pages = Array.isArray(view?.pages) ? view.pages : [];
  const pageInfo = pages[page - 1];
  if (!pageInfo?.cid) throw new Error(`此视频没有第 ${page} 个分 P。`);

  const playInfo = await requestDashPlayInfo(bvid, pageInfo.cid, session.cookies);
  const dash = playInfo?.dash;
  const audio = selectDashAudio(dash?.audio || []);
  if (!audio) throw new Error('该视频没有可播放的 DASH 音频轨道。');
  const formats = new Map((playInfo.support_formats || []).map((format) => [Number(format.quality), format]));
  const qualities = [...new Set((dash?.video || []).map((video) => Number(video?.id)).filter((quality) => PLAYABLE_QUALITIES.has(quality)))].sort((left, right) => right - left);
  const sources = [];

  pruneManifests(manifests);
  for (const quality of qualities) {
    const video = selectDashVideo(dash.video, quality);
    if (!video) continue;
    const token = randomUUID();
    const expiresAt = Date.now() + 90 * 60 * 1000;
    manifests.set(token, {
      expiresAt,
      videoURL: mediaURL(video),
      audioURL: mediaURL(audio),
      mpd: dashManifestXML(token, dash.duration, video, audio)
    });
    sources.push({
      code: `dash-${quality}`,
      qn: quality,
      label: compactQualityName(formats.get(quality), video, quality),
      resolution: `${Number(video.width) || 0}×${Number(video.height) || 0}`,
      url: `${apiBaseURL}/manifest/${token}.mpd`,
      type: 'application/dash+xml'
    });
  }

  if (!sources.length) throw new Error('该视频没有可播放的 DASH 视频轨道。');
  sources.sort((left, right) => right.qn - left.qn);
  return {
    bvid,
    page,
    cid: pageInfo.cid,
    title: view.title || '',
    sources,
    highestQuality: sources[0].qn,
    has1080p: sources.some((source) => source.qn >= 80)
  };
}

function corsAllowed(req, res, allowedOrigins) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) {
    fail(res, 403, '此页面来源未在本地解析服务的 allow-origin 白名单中。', 'ORIGIN_NOT_ALLOWED');
    return false;
  }
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'Origin');
  return true;
}

async function proxyDashMedia(req, res, manifest, mediaType) {
  const upstreamURL = mediaType === 'video' ? manifest.videoURL : manifest.audioURL;
  const upstream = await fetch(upstreamURL, {
    headers: {
      'user-agent': USER_AGENT,
      referer: 'https://www.bilibili.com/',
      ...(req.headers.range ? { range: req.headers.range } : {})
    },
    redirect: 'follow'
  });
  const headers = {};
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const value = upstream.headers.get(name);
    if (value) headers[name] = value;
  }
  headers['cache-control'] = 'private, max-age=300';
  res.writeHead(upstream.status, headers);
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
}

export async function createApp(options) {
  const store = new SessionStore(options.dataDir);
  await store.setup();
  const allowedOrigins = new Set(options.allowedOrigins);
  const qrRequests = new Map();
  const manifests = new Map();

  async function route(req, res) {
    if (!corsAllowed(req, res, allowedOrigins)) return;
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type, range',
        'access-control-max-age': '600'
      });
      res.end();
      return;
    }
    if (!req.url) return fail(res, 400, '请求地址无效。', 'INVALID_URL');
    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    try {
      const manifestMatch = url.pathname.match(/^\/api\/manifest\/([0-9a-f-]{36})\.mpd$/i);
      if (req.method === 'GET' && manifestMatch) {
        const manifest = manifests.get(manifestMatch[1]);
        if (!manifest || manifest.expiresAt <= Date.now()) {
          manifests.delete(manifestMatch[1]);
          return fail(res, 404, '播放清单已过期，请重新解析。', 'MANIFEST_EXPIRED');
        }
        res.writeHead(200, { 'content-type': 'application/dash+xml; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
        return res.end(manifest.mpd);
      }
      const mediaMatch = url.pathname.match(/^\/api\/media\/([0-9a-f-]{36})\/(video|audio)$/i);
      if (req.method === 'GET' && mediaMatch) {
        const manifest = manifests.get(mediaMatch[1]);
        if (!manifest || manifest.expiresAt <= Date.now()) {
          manifests.delete(mediaMatch[1]);
          return fail(res, 404, '播放媒体已过期，请重新解析。', 'MEDIA_EXPIRED');
        }
        return proxyDashMedia(req, res, manifest, mediaMatch[2].toLowerCase());
      }
      if (req.method === 'GET' && url.pathname === '/api/health') {
        const authentication = await getAuthentication(await store.load());
        return json(res, 200, { success: true, data: authentication });
      }
      if (req.method === 'POST' && url.pathname === '/api/login/qr') {
        const { data } = await biliJSON(`${BILI_PASSPORT}/x/passport-login/web/qrcode/generate`);
        if (!data?.qrcode_key || !data?.url) throw new Error('B 站没有返回登录二维码。');
        const image = await QRCode.toDataURL(data.url, { errorCorrectionLevel: 'M', margin: 1, width: 248 });
        const expiresAt = Date.now() + 170000;
        qrRequests.set(data.qrcode_key, { expiresAt });
        return json(res, 200, { success: true, data: { key: data.qrcode_key, image, expiresAt } });
      }
      if (req.method === 'GET' && url.pathname === '/api/login/qr/status') {
        const key = url.searchParams.get('key') || '';
        const pending = qrRequests.get(key);
        if (!pending || pending.expiresAt < Date.now()) {
          qrRequests.delete(key);
          return fail(res, 400, '二维码已过期，请重新生成。', 'QR_EXPIRED');
        }
        const pollURL = new URL(`${BILI_PASSPORT}/x/passport-login/web/qrcode/poll`);
        pollURL.searchParams.set('qrcode_key', key);
        const response = await fetch(pollURL, { headers: { 'user-agent': USER_AGENT, referer: 'https://www.bilibili.com/' } });
        const body = await response.json();
        if (!response.ok || body.code !== 0) throw new Error(body.message || '二维码状态查询失败。');
        const state = Number(body.data?.code);
        if (state !== 0) return json(res, 200, { success: true, data: { state: 'pending', bilibiliCode: state, message: body.data?.message || '等待扫码确认' } });
        const cookies = getSetCookies(response.headers).map(parseCookie).filter(Boolean);
        await store.save(cookies);
        qrRequests.delete(key);
        return json(res, 200, { success: true, data: { state: 'success', message: '登录信息已保存到本机。' } });
      }
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        await store.clear();
        return json(res, 200, { success: true, data: { authenticated: false } });
      }
      if (req.method === 'GET' && url.pathname === '/api/resolve') {
        const bvid = url.searchParams.get('bvid') || '';
        const page = Number(url.searchParams.get('p') || '1');
        if (!isBvid(bvid)) return fail(res, 400, 'BVID 格式无效。', 'INVALID_BVID');
        if (!Number.isInteger(page) || page < 1 || page > 100) return fail(res, 400, '分 P 必须是 1–100 的整数。', 'INVALID_PAGE');
        const session = await store.load();
        const authentication = await getAuthentication(session);
        if (!session || !authentication.authenticated) return fail(res, 401, '请先通过本地服务扫码登录 B 站。', 'NOT_LOGGED_IN');
        const data = await resolveSources(bvid, page, session, `${url.origin}/api`, manifests);
        return json(res, 200, { success: true, data });
      }
      return fail(res, 404, '接口不存在。', 'NOT_FOUND');
    } catch (error) {
      console.error('[local-bili-parser]', error);
      return fail(res, 502, error instanceof Error ? error.message : '本地解析失败。', 'UPSTREAM_ERROR');
    }
  }
  return createServer(route);
}

function usage() {
  return `用法：npm start -- [--host 127.0.0.1] [--port 19180] [--data-dir 路径] [--allow-origin 来源]\n\n默认只监听 127.0.0.1，并仅允许 http://localhost:3000 和 http://127.0.0.1:3000 访问。`;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  const server = await createApp(options);
  server.listen(options.port, options.host, () => {
    const origins = options.allowedOrigins.join(', ') || '（无）';
    console.log(`本地 B 站解析服务已启动：http://${options.host}:${options.port}`);
    console.log(`允许访问的页面来源：${origins}`);
    console.log(`登录信息目录：${options.dataDir}`);
  });
}

const executedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (executedPath && executedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
