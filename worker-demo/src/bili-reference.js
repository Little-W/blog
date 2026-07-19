const BVID_PATTERN = /^BV[A-Za-z0-9]{10}$/i;
const AVID_PATTERN = /^av([1-9]\d{0,19})$/i;
const VIDEO_PATH_PATTERN = /^\/video\/(BV[A-Za-z0-9]{10}|av[1-9]\d{0,19})(?:\/|$)/i;
const ALLOWED_HOSTS = new Set([
  "bilibili.com",
  "www.bilibili.com",
  "m.bilibili.com"
]);

function normalizePage(value) {
  const page = Number.parseInt(String(value || "1"), 10);
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000) {
    throw new TypeError("分 P 必须是 1 到 1000 之间的整数");
  }
  return page;
}

function parseVideoId(value) {
  const id = value.trim();
  if (BVID_PATTERN.test(id)) {
    return { type: "bvid", id: `BV${id.slice(2)}` };
  }
  const avMatch = AVID_PATTERN.exec(id);
  if (avMatch) {
    return { type: "aid", id: avMatch[1] };
  }
  throw new TypeError("请输入有效的 BV 号、av 号或 bilibili.com/video 链接");
}

export function parseBilibiliReference(rawInput, explicitPage) {
  const input = String(rawInput || "").trim();
  if (!input || input.length > 512) {
    throw new TypeError("视频地址不能为空，且长度不能超过 512 个字符");
  }

  let parsed;
  let pageFromUrl;
  if (/^https?:\/\//i.test(input)) {
    const url = new URL(input);
    if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
      throw new TypeError("只接受 bilibili.com 的完整视频链接");
    }
    const pathMatch = VIDEO_PATH_PATTERN.exec(url.pathname);
    if (!pathMatch) {
      throw new TypeError("链接中没有可识别的 BV 或 av 视频号");
    }
    parsed = parseVideoId(pathMatch[1]);
    pageFromUrl = url.searchParams.get("p");
  } else {
    parsed = parseVideoId(input);
  }

  const page = normalizePage(explicitPage || pageFromUrl || 1);
  const embed = new URL("https://player.bilibili.com/player.html");
  embed.searchParams.set("isOutside", "true");
  embed.searchParams.set(parsed.type, parsed.id);
  embed.searchParams.set("p", String(page));
  embed.searchParams.set("autoplay", "0");
  embed.searchParams.set("danmaku", "0");

  return {
    ...parsed,
    page,
    embedUrl: embed.toString()
  };
}
