const DATASET_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_IDS = 5000;
const MAX_QUERY_LENGTH = 120;
const MAX_REQUEST_BYTES = 96 * 1024;
const DEFAULT_SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGE_SIZE = 200;
const datasetCache = new Map();

function dataRevision() {
  return String(
    process.env.COMMIT_REF ||
    process.env.DEPLOY_ID ||
    process.env.BUILD_ID ||
    'local',
  ).slice(0, 160);
}

export const config = {
  path: '/api/music/*',
  preferStatic: false,
};

function json(payload, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
    },
  });
}

function fail(message, code, status = 400) {
  return json({success: false, code, message}, status, 'no-store');
}

function parseJsonl(text) {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => JSON.parse(line));
}

async function loadDataset(request, name) {
  const cached = datasetCache.get(name);
  if (cached && cached.expiresAt > Date.now()) return cached.records;
  const source = new URL(`/data/${name}.0.jsonl`, request.url);
  source.searchParams.set('revision', dataRevision());
  const response = await fetch(source, {
    headers: {accept: 'application/x-ndjson,text/plain;q=0.9'},
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`读取 ${name} 失败：${response.status}`);
  const records = parseJsonl(await response.text());
  datasetCache.set(name, {records, expiresAt: Date.now() + DATASET_CACHE_TTL_MS});
  return records;
}

function normalizeQuality(value) {
  return value === 'sq' || value === '1' ? 'music_sq' : 'music_hq';
}

function compactTrack(record) {
  return {
    mid: Number(record.mid),
    title: String(record.title || ''),
    author: String(record.author || ''),
    list: Array.isArray(record.list) ? record.list.map(Number).filter(Number.isInteger) : [],
    url: String(record.url || ''),
    pic: String(record.pic || record.cover || ''),
    lrc: String(record.lrc || ''),
  };
}

function normalizedIds(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const ids = [];
  for (const raw of value) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 0 || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length > MAX_IDS) throw new Error(`单次最多请求 ${MAX_IDS} 首曲目。`);
  }
  return ids;
}

export function playlistOrder(tag, records) {
  const members = records.filter((record) => Array.isArray(record.list) && record.list.map(Number).includes(Number(tag.tag_id)));
  const byId = new Map(members.map((record) => [Number(record.mid), record]));
  const ordered = [];
  const seen = new Set();
  for (const mid of normalizedIds(tag.music_order)) {
    if (!byId.has(mid) || seen.has(mid)) continue;
    ordered.push(byId.get(mid));
    seen.add(mid);
  }
  members
    .filter((record) => !seen.has(Number(record.mid)))
    .sort((left, right) => Number(left.mid) - Number(right.mid))
    .forEach((record) => ordered.push(record));
  return ordered;
}

export function sortTracks(records, sort) {
  if (sort === 'name') {
    const collator = new Intl.Collator('zh-Hans-CN', {numeric: true, sensitivity: 'base'});
    return records.slice().sort((left, right) =>
      collator.compare(String(left.title || ''), String(right.title || '')) || Number(left.mid) - Number(right.mid));
  }
  if (sort === 'id') return records.slice().sort((left, right) => Number(left.mid) - Number(right.mid));
  return records;
}

async function getTags(request) {
  const tags = await loadDataset(request, 'music_tag');
  return json({
    success: true,
    data: {
      tags: tags
        .map((tag) => ({
          tag_id: Number(tag.tag_id),
          tag_order: Number(tag.tag_order),
          tag_name: String(tag.tag_name || ''),
          count: Array.isArray(tag.music_order) ? tag.music_order.length : null,
        }))
        .sort((left, right) => left.tag_order - right.tag_order || left.tag_id - right.tag_id),
      revision: dataRevision(),
    },
  });
}

function getRevision() {
  return json({
    success: true,
    data: {revision: dataRevision()},
  });
}

async function queryTracks(request) {
  let body;
  try {
    const declaredLength = Number(request.headers.get('content-length') || 0);
    if (declaredLength > MAX_REQUEST_BYTES) return fail('请求内容过大。', 'REQUEST_TOO_LARGE', 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return fail('请求内容过大。', 'REQUEST_TOO_LARGE', 413);
    }
    body = JSON.parse(raw);
  } catch {
    return fail('请求内容不是有效 JSON。', 'INVALID_JSON');
  }
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    return fail('请求内容必须是 JSON 对象。', 'INVALID_REQUEST');
  }
  if (Array.isArray(body.ids) && body.ids.length > MAX_IDS) {
    return fail(`单次最多请求 ${MAX_IDS} 首曲目。`, 'INVALID_TRACK_IDS');
  }
  const datasetName = normalizeQuality(body.quality);
  const [records, tags] = await Promise.all([
    loadDataset(request, datasetName),
    loadDataset(request, 'music_tag'),
  ]);
  let ids;
  try {
    ids = normalizedIds(body.ids);
  } catch (error) {
    return fail(error instanceof Error ? error.message : '曲目编号无效。', 'INVALID_TRACK_IDS');
  }
  const query = String(body.query || '').trim().slice(0, MAX_QUERY_LENGTH).toLocaleLowerCase();
  const sort = ['default', 'name', 'id'].includes(body.sort) ? body.sort : 'default';
  let selected;
  let playlistIds = null;
  let searchMeta = null;

  if (!query && Number.isInteger(Number(body.listId)) && Number(body.listId) >= 1) {
    const listId = Number(body.listId);
    const tag = tags.find((record) => Number(record.tag_id) === listId);
    if (!tag) return fail('歌单不存在。', 'PLAYLIST_NOT_FOUND', 404);
    const playlist = sortTracks(playlistOrder(tag, records), sort);
    playlistIds = playlist.map((record) => Number(record.mid));
    if (ids.length) {
      const selectedIds = new Set(playlistIds);
      const byId = new Map(records.map((record) => [Number(record.mid), record]));
      selected = playlist.concat(ids.filter((id) => !selectedIds.has(id)).map((id) => byId.get(id)).filter(Boolean));
    } else {
      selected = playlist;
    }
  } else if (ids.length) {
    const byId = new Map(records.map((record) => [Number(record.mid), record]));
    selected = ids.map((id) => byId.get(id)).filter(Boolean);
  } else if (query) {
    const matches = records.filter((record) => {
      const text = String(record.z_full_name || `${record.author || ''} - ${record.title || ''}`).toLocaleLowerCase();
      return text.includes(query);
    });
    const page = Math.max(0, Math.min(10000, Number.parseInt(body.page, 10) || 0));
    const pageSize = Math.max(1, Math.min(MAX_SEARCH_PAGE_SIZE,
      Number.parseInt(body.pageSize, 10) || DEFAULT_SEARCH_PAGE_SIZE));
    selected = sortTracks(matches, sort === 'default' ? 'id' : sort)
      .slice(page * pageSize, (page + 1) * pageSize);
    playlistIds = null;
    searchMeta = {page, pageSize, totalMatches: matches.length};
  } else return fail('歌单编号无效。', 'INVALID_PLAYLIST');

  return json({
    success: true,
    data: {
      records: selected.map(compactTrack),
      count: selected.length,
      playlistIds,
      totalLibrary: records.length,
      quality: datasetName === 'music_sq' ? 'sq' : 'hq',
      revision: dataRevision(),
      ...(searchMeta || {}),
    },
  });
}

export default async (request) => {
  const url = new URL(request.url);
  try {
    if (url.pathname === '/api/music/revision' && request.method === 'GET') return getRevision();
    if (url.pathname === '/api/music/tags' && request.method === 'GET') return await getTags(request);
    if (url.pathname === '/api/music/tracks' && request.method === 'POST') return await queryTracks(request);
    return fail('音乐接口不存在。', 'NOT_FOUND', 404);
  } catch (error) {
    console.error('[music-api]', error instanceof Error ? error.message : String(error));
    return fail('音乐资料暂时无法读取。', 'MUSIC_API_ERROR', 500);
  }
};
