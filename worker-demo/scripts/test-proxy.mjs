import assert from "node:assert/strict";

const origin = "http://127.0.0.1:8791/protected/demo.mp4";
const worker = "http://127.0.0.1:8787";

const direct = await fetch(origin, { method: "HEAD" });
assert.equal(direct.status, 403, "mock origin must reject a request without synthetic headers");

const authenticated = await fetch(origin, {
  method: "HEAD",
  headers: {
    cookie: "demo_session=local-authorized-test",
    referer: "https://local-worker-demo.invalid/player/"
  }
});
assert.equal(authenticated.status, 200, "mock origin must accept the controlled synthetic headers");

const health = await fetch(`${worker}/health`);
assert.equal(health.status, 200);
assert.equal((await health.json()).acceptsBrowserCookie, false);

const streamed = await fetch(`${worker}/media/demo.mp4`, {
  headers: {
    origin: worker,
    range: "bytes=0-1023"
  }
});
assert.equal(streamed.status, 206);
assert.equal(streamed.headers.get("access-control-allow-origin"), worker);
assert.equal(streamed.headers.get("x-demo-proxy"), "worker-stream");
assert.match(streamed.headers.get("content-range") || "", /^bytes 0-1023\/\d+$/);
assert.equal((await streamed.arrayBuffer()).byteLength, 1024);

const blockedOrigin = await fetch(`${worker}/media/demo.mp4`, {
  headers: { origin: "https://untrusted.example" }
});
assert.equal(blockedOrigin.status, 403);

const parsedBvid = await fetch(`${worker}/api/bili/parse?input=${encodeURIComponent("https://www.bilibili.com/video/BV183411G7cN?p=2")}`);
assert.equal(parsedBvid.status, 200);
const parsedBvidBody = await parsedBvid.json();
assert.equal(parsedBvidBody.id, "BV183411G7cN");
assert.equal(parsedBvidBody.page, 2);
assert.equal(parsedBvidBody.mode, "official_embed_only");
assert.equal(parsedBvidBody.forwardsCookie, false);
assert.equal(parsedBvidBody.forwardsReferer, false);
assert.equal(new URL(parsedBvidBody.embedUrl).hostname, "player.bilibili.com");
assert.equal(new URL(parsedBvidBody.embedUrl).searchParams.has("high_quality"), false);

const invalidBvid = await fetch(`${worker}/api/bili/parse?input=${encodeURIComponent("https://untrusted.example/video/BV183411G7cN")}`);
assert.equal(invalidBvid.status, 400);

console.log(JSON.stringify({
  passed: true,
  directWithoutHeaders: direct.status,
  directWithSyntheticHeaders: authenticated.status,
  workerRangeStatus: streamed.status,
  contentRange: streamed.headers.get("content-range"),
  streamedBytes: 1024,
  untrustedBrowserOrigin: blockedOrigin.status,
  safeBilibiliReference: {
    status: parsedBvid.status,
    id: parsedBvidBody.id,
    page: parsedBvidBody.page,
    mode: parsedBvidBody.mode,
    forwardsCookie: parsedBvidBody.forwardsCookie,
    forwardsReferer: parsedBvidBody.forwardsReferer
  },
  invalidReference: invalidBvid.status
}, null, 2));
