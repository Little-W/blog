import { parseBilibiliReference } from "./bili-reference.js";

const MEDIA_PATH = "/media/demo.mp4";
const FORWARDED_REQUEST_HEADERS = ["range", "if-range", "if-none-match", "if-modified-since"];
const PASSTHROUGH_RESPONSE_HEADERS = [
  "accept-ranges",
  "cache-control",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified"
];

function json(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("origin");
  const headers = {
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "Range, If-Range, If-None-Match, If-Modified-Since",
    "access-control-expose-headers": "Accept-Ranges, Content-Length, Content-Range, Content-Type, ETag, Last-Modified, X-Demo-Proxy",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };
  if (origin === env.ALLOWED_SITE_ORIGIN) {
    headers["access-control-allow-origin"] = origin;
  }
  return headers;
}

function requestOriginIsAllowed(request, env) {
  const origin = request.headers.get("origin");
  return !origin || origin === env.ALLOWED_SITE_ORIGIN;
}

async function streamDemoMedia(request, env) {
  if (!requestOriginIsAllowed(request, env)) {
    return json({ error: "origin_not_allowed" }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405, { allow: "GET, HEAD, OPTIONS" });
  }
  if (!env.DEMO_ORIGIN_COOKIE) {
    return json({ error: "missing_server_side_demo_secret" }, 500);
  }

  const upstreamUrl = new URL("/protected/demo.mp4", env.DEMO_ORIGIN);
  const upstreamHeaders = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  // These values are fixed server-side and target only the controlled mock origin.
  upstreamHeaders.set("cookie", env.DEMO_ORIGIN_COOKIE);
  upstreamHeaders.set("referer", env.DEMO_REFERER);
  upstreamHeaders.set("user-agent", "LocalAuthorizedWorkerDemo/1.0");

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      redirect: "manual"
    });
  } catch (error) {
    return json({
      error: "mock_origin_unreachable",
      detail: error instanceof Error ? error.message : String(error)
    }, 502, corsHeaders(request, env));
  }

  const responseHeaders = new Headers(corsHeaders(request, env));
  for (const name of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  responseHeaders.set("x-demo-proxy", "worker-stream");
  responseHeaders.set("x-content-type-options", "nosniff");

  // Returning upstream.body directly preserves streaming and avoids buffering the file.
  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({
        ok: true,
        runtime: "Cloudflare workerd (local)",
        mediaPath: MEDIA_PATH,
        credentialSource: "server-side .dev.vars",
        acceptsBrowserCookie: false,
        upstream: "controlled local mock only"
      }, 200, corsHeaders(request, env));
    }
    if (url.pathname === MEDIA_PATH) {
      return streamDemoMedia(request, env);
    }
    if (url.pathname === "/api/bili/parse") {
      if (!requestOriginIsAllowed(request, env)) {
        return json({ error: "origin_not_allowed" }, 403);
      }
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }
      if (request.method !== "GET") {
        return json({ error: "method_not_allowed" }, 405, { allow: "GET, OPTIONS" });
      }
      try {
        const result = parseBilibiliReference(url.searchParams.get("input"), url.searchParams.get("p"));
        return json({
          ok: true,
          mode: "official_embed_only",
          forwardsCookie: false,
          forwardsReferer: false,
          ...result
        }, 200, corsHeaders(request, env));
      } catch (error) {
        return json({
          ok: false,
          error: "invalid_bilibili_reference",
          message: error instanceof Error ? error.message : String(error)
        }, 400, corsHeaders(request, env));
      }
    }
    return env.ASSETS.fetch(request);
  }
};
