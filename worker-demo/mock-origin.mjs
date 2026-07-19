import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = 8791;
const mediaFile = fileURLToPath(new URL("./media/demo.mp4", import.meta.url));
const expectedCookie = "demo_session=local-authorized-test";
const expectedReferer = "https://local-worker-demo.invalid/player/";

function reject(response, status, message) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify({ error: message }));
}

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value || "");
  if (!match) return null;
  let start;
  let end;
  if (match[1] === "" && match[2] !== "") {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Number(match[2]);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
    return null;
  }
  return { start, end: Math.min(end, size - 1) };
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  if (url.pathname !== "/protected/demo.mp4") {
    return reject(response, 404, "not_found");
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("allow", "GET, HEAD");
    return reject(response, 405, "method_not_allowed");
  }
  if (!(request.headers.cookie || "").split(/;\s*/).includes(expectedCookie)) {
    return reject(response, 403, "missing_or_invalid_demo_cookie");
  }
  if (request.headers.referer !== expectedReferer) {
    return reject(response, 403, "missing_or_invalid_demo_referer");
  }

  const { size, mtime } = statSync(mediaFile);
  const headers = {
    "accept-ranges": "bytes",
    "cache-control": "private, no-store",
    "content-type": "video/mp4",
    "last-modified": mtime.toUTCString()
  };
  const requestedRange = request.headers.range;
  const range = requestedRange ? parseRange(requestedRange, size) : null;
  if (requestedRange && !range) {
    response.writeHead(416, { ...headers, "content-range": `bytes */${size}` });
    return response.end();
  }

  const status = range ? 206 : 200;
  const start = range ? range.start : 0;
  const end = range ? range.end : size - 1;
  headers["content-length"] = String(end - start + 1);
  if (range) headers["content-range"] = `bytes ${start}-${end}/${size}`;
  response.writeHead(status, headers);
  if (request.method === "HEAD") return response.end();
  createReadStream(mediaFile, { start, end }).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Controlled mock media origin: http://${host}:${port}`);
  console.log("Direct requests intentionally return 403; the local Worker supplies synthetic headers.");
});
