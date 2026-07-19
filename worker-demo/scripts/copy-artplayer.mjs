import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "node_modules/artplayer/dist/artplayer.js");
const target = resolve(root, "public/vendor/artplayer.js");
await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
console.log(`Vendored ArtPlayer: ${target}`);
