import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DATA_FILE = resolve(ROOT, 'static/data/mv_bilibili.0.jsonl');
const LEGACY_FILE = resolve(ROOT, 'static/data/mv_out.0.jsonl');
const MID = '13148307';
const SEASON_ID = '1547037';
const PAGE_SIZE = 100;
const API = 'https://api.bilibili.com/x/polymer/web-space/seasons_archives_list';

function parseJsonLines(text) {
  return text.split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line));
}

function normalizeGroup(title) {
  const value = String(title || '');
  if (/Leo\/need|Leo need/i.test(value)) return 'Leo/need';
  if (/MORE\s*MORE\s*JUMP/i.test(value)) return 'MORE MORE JUMP！';
  if (/Vivid\s*BAD\s*SQUAD/i.test(value)) return 'Vivid BAD SQUAD';
  if (/ワンダーランズ[×xX]ショウタイム|Wonderlands\s*[×xX]\s*Showtime/i.test(value)) return 'ワンダーランズ×ショウタイム';
  if (/25時、ナイトコードで。|25ji|Nightcord/i.test(value)) return '25時、ナイトコードで。';
  if (/VIRTUAL\s*SINGER/i.test(value)) return 'VIRTUAL SINGER';
  return 'スペシャル';
}

function normalizeType(title) {
  const value = String(title || '');
  if (/动画MV|動畫MV/i.test(value)) return '动画MV';
  if (/3DMV/i.test(value)) return '3DMV';
  if (/2DMV/i.test(value)) return '2DMV';
  return 'MV';
}

function cleanTitle(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  const outsideBrackets = raw.split(/【[^】]*】/g).map((part) => part.trim()).filter(Boolean);
  let title = outsideBrackets.join(' ').trim() || raw;
  const quotedTitles = [...title.matchAll(/[『「]([^』」]+)[』」]/g)];
  if (quotedTitles.length) title = quotedTitles.at(-1)[1];
  title = title.replace(/^[《〈]([^》〉]+)[》〉]$/, '$1').trim();
  const translatedTitle = title.match(/^(.+?)[（(]([\u3400-\u9fff\s、，。！!？?·]+)[）)]$/);
  if (translatedTitle) title = translatedTitle[1];
  return title.replace(/^[：:、\-\s]+|[：:、\-\s]+$/g, '').trim() || raw;
}

async function loadPage(page) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    mid: MID,
    season_id: SEASON_ID,
    page_num: String(page),
    page_size: String(PAGE_SIZE),
  }).toString();
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      referer: `https://space.bilibili.com/${MID}/lists/${SEASON_ID}?type=season`,
    },
  });
  const body = await response.json();
  if (!response.ok || body.code !== 0 || !Array.isArray(body?.data?.archives)) {
    throw new Error(body.message || `B 站合集请求失败（HTTP ${response.status}）`);
  }
  return body.data;
}

async function main() {
  const [sourceText, legacyText] = await Promise.all([
    readFile(DATA_FILE, 'utf8'),
    readFile(LEGACY_FILE, 'utf8'),
  ]);
  const currentSources = parseJsonLines(sourceText);
  const legacyVideos = parseJsonLines(legacyText);
  const legacyById = new Map(legacyVideos.map((item) => [Number(item.mv_id), item]));
  const currentByBvid = new Map(currentSources.map((source) => {
    const legacy = legacyById.get(Number(source.mv_id));
    return [source.bilibili_bvid, { source, legacy }];
  }));

  const firstPage = await loadPage(1);
  const total = Number(firstPage?.page?.total) || firstPage.archives.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const archives = [...firstPage.archives];
  for (let page = 2; page <= pages; page += 1) {
    const data = await loadPage(page);
    archives.push(...data.archives);
  }

  const unique = [];
  const seen = new Set();
  for (const archive of archives) {
    if (!archive?.bvid || seen.has(archive.bvid)) continue;
    seen.add(archive.bvid);
    unique.push(archive);
  }

  const records = unique.map((archive, mv_id) => {
    const known = currentByBvid.get(archive.bvid);
    const original = known?.source || {};
    const legacy = known?.legacy || {};
    const rawTitle = archive.title || legacy.title || '';
    const title = cleanTitle(rawTitle);
    return {
      mv_id,
      title,
      author: '',
      bilibili_bvid: archive.bvid,
      bilibili_page: 1,
      bilibili_mid: Number(MID),
      bilibili_season_id: Number(SEASON_ID),
      bilibili_cover: String(archive.pic || original.bilibili_cover || '').replace(/^http:/, 'https:'),
      duration: Number(archive.duration) || 0,
      project_tag: original.project_tag || 'プロセカ',
      group: original.group || normalizeGroup(rawTitle),
      mv_type: original.mv_type || normalizeType(rawTitle),
    };
  });

  const output = [
    '#filetype:JSON-streaming {"type":"Class","class":"mv_bilibili"}',
    ...records.map((record) => JSON.stringify(record)),
    '',
  ].join('\n');
  await writeFile(DATA_FILE, output, 'utf8');
  console.log(`Imported ${records.length} unique videos from season ${SEASON_ID}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
