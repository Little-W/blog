import {mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

import {getStore} from '@netlify/blobs';

// 站点内容（文章与音乐数据表）统一存放于 Netlify Blobs。
// 本地开发缺少 Blob 上下文时自动回退到文件目录，便于离线模拟读写。
export const CONTENT_STORE_NAME = 'site-content';
export const ARTICLE_PREFIX = 'content/';
export const ASSET_PREFIX = 'assets/';
export const MUSIC_PREFIX = 'music/';
export const ARTICLE_INDEX_KEY = `${ARTICLE_PREFIX}_index.json`;
export const MUSIC_REVISION_KEY = `${MUSIC_PREFIX}_revision.json`;

const LOCAL_DIR_FALLBACK = '.local-blobs';

function localDir() {
  return process.env.LOCAL_CONTENT_DIR || path.join(process.cwd(), LOCAL_DIR_FALLBACK);
}

function sanitizeKey(key) {
  const parts = String(key || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.');
  if (!parts.length || parts.some((part) => part === '..')) throw new Error(`非法的存储键：${key}`);
  return parts.join('/');
}

class LocalFsStore {
  constructor(dir) {
    this.dir = dir;
  }

  file(key) {
    return path.join(this.dir, sanitizeKey(key));
  }

  async get(key, {type = 'text'} = {}) {
    try {
      const value = await readFile(this.file(key));
      if (type === 'arrayBuffer') return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
      if (type === 'json') return JSON.parse(value.toString('utf8'));
      return value.toString('utf8');
    } catch {
      return null;
    }
  }

  async set(key, value) {
    const file = this.file(key);
    await mkdir(path.dirname(file), {recursive: true});
    await writeFile(file, value instanceof ArrayBuffer ? Buffer.from(value) : value);
    return this.getMetadata(key);
  }

  async delete(key) {
    await rm(this.file(key), {force: true});
  }

  async getMetadata(key) {
    try {
      const info = await stat(this.file(key));
      return {etag: `${info.size}-${Math.floor(info.mtimeMs)}`, metadata: {}};
    } catch {
      return null;
    }
  }

  async list(prefix = '') {
    const keys = [];
    const walk = async (dir, relative) => {
      let entries;
      try {
        entries = await readdir(dir, {withFileTypes: true});
      } catch {
        return;
      }
      for (const entry of entries) {
        const next = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), next);
        else if (next.startsWith(prefix)) keys.push(next);
      }
    };
    await walk(this.dir, '');
    return keys;
  }
}

let resolved = null;

function backend() {
  if (resolved) return resolved;
  try {
    resolved = {kind: 'blobs', store: getStore({name: CONTENT_STORE_NAME})};
  } catch {
    resolved = {kind: 'local', store: new LocalFsStore(localDir())};
  }
  return resolved;
}

export function contentBackend() {
  return backend().kind;
}

function isMissing(error) {
  if (!error) return false;
  if (error.status === 404) return true;
  return /not found|404/i.test(String(error.message || ''));
}

export async function readContent(key, {type = 'text'} = {}) {
  const {kind, store} = backend();
  try {
    if (kind === 'blobs') return await store.get(key, {type, consistency: 'strong'});
    const raw = await store.get(key, {type});
    if (raw == null) return null;
    return raw;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export async function writeContent(key, value, {metadata} = {}) {
  const {kind, store} = backend();
  const normalized = value instanceof Uint8Array
    ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
    : value;
  if (kind === 'blobs') {
    const result = await store.set(key, normalized, metadata ? {metadata} : undefined);
    return result?.etag || null;
  }
  const result = await store.set(key, normalized);
  return result?.etag || null;
}

export async function deleteContent(key) {
  const {kind, store} = backend();
  if (kind === 'blobs') {
    await store.delete(key);
    return;
  }
  await store.delete(key);
}

export async function listContent(prefix = '') {
  const {kind, store} = backend();
  if (kind === 'blobs') {
    const {blobs} = await store.list({prefix});
    return blobs.map((blob) => blob.key);
  }
  return store.list(prefix);
}

export async function contentMetadata(key) {
  const {kind, store} = backend();
  try {
    if (kind === 'blobs') {
      const result = await store.getMetadata(key, {consistency: 'strong'});
      return result ? {etag: result.etag || null, metadata: result.metadata || {}} : null;
    }
    return await store.getMetadata(key);
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

export function revisionFromEtags(etags) {
  const values = (etags || []).filter(Boolean).map(String).sort();
  return values.length ? `blob-${values.join('-')}`.slice(0, 160) : null;
}
