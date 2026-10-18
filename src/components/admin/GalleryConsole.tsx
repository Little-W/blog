import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Icon} from '@iconify/react';

import {consoleApi, consoleUpload} from './consoleApi';
import styles from '@site/src/pages/admin/styles.module.css';

type GalleryItem = {
  id: string;
  pixivId: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  pixivUrl: string;
  image: string;
  thumbnail: string;
  pendingId?: string;
};
type GalleryAlbum = {id: string; title: string; description: string; tags: string[]; updatedAt?: string; items: GalleryItem[]};
type GalleryPayload = {version: number; updatedAt: string | null; albums: GalleryAlbum[]};
type PendingAsset = {original: File; thumbnail: File; previewUrl: string};

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpg', 'jpeg', 'png', 'webp']);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

function splitTags(value: string): string[] {
  return [...new Set(value.split(/[,，;；\n]+/).map((tag) => tag.trim()).filter(Boolean))];
}

function imageProxy(path: string, version: string): string {
  return `/api/gallery/image?path=${encodeURIComponent(path)}&v=${encodeURIComponent(version || '1')}`;
}

function GalleryAdminImage({path, alt, className, version, eager = false}: {path: string; alt: string; className: string; version: string; eager?: boolean}) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const cacheVersion = encodeURIComponent(version || '1');
  const candidates = [
    imageProxy(path, version),
    `https://huggingface.co/datasets/Yusen/2d_pic/resolve/main/${encodedPath}?v=${cacheVersion}`,
    `https://hf-mirror.com/datasets/Yusen/2d_pic/resolve/main/${encodedPath}?v=${cacheVersion}`,
  ];
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [requestStarted, setRequestStarted] = useState(eager);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const source = candidates[attempt] || candidates[candidates.length - 1];

  useEffect(() => {
    setAttempt(0);
    setLoaded(false);
    setRequestStarted(eager);
  }, [path, version, eager]);

  useEffect(() => {
    const image = imageRef.current;
    if (!image || eager) {
      setRequestStarted(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setRequestStarted(true);
        observer.disconnect();
      }
    }, {rootMargin: '180px'});
    observer.observe(image);
    return () => observer.disconnect();
  }, [eager, path, source]);

  useEffect(() => {
    if (loaded || !requestStarted) return undefined;
    const timeout = window.setTimeout(() => {
      if (attempt < candidates.length - 1) setAttempt((current) => current + 1);
    }, 9000);
    return () => window.clearTimeout(timeout);
  }, [attempt, candidates.length, loaded, requestStarted]);

  return <img ref={imageRef} className={className} src={source} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); if (attempt < candidates.length - 1) setAttempt((current) => current + 1); }} />;
}

function makeId(): string {
  return `upload-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

async function createThumbnail(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 768 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建缩略图画布。');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('缩略图生成失败。')), 'image/webp', 0.82);
    });
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, {type: 'image/webp'});
  } finally {
    bitmap.close();
  }
}

function fileExtension(file: File): string {
  const extension = file.name.split('.').pop()?.toLocaleLowerCase() || '';
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error(`${file.name} 不是支持的图片格式。`);
  return extension === 'jpeg' ? 'jpg' : extension;
}

export default function GalleryConsole(): JSX.Element {
  const [manifest, setManifest] = useState<GalleryPayload | null>(null);
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [assets, setAssets] = useState<Record<string, PendingAsset>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const objectUrls = useRef(new Set<string>());

  const clearAssets = () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
    setAssets({});
  };

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  const loadManifest = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await consoleApi<GalleryPayload>('/api/console/gallery');
      setManifest(data);
      setSelectedAlbumId((current) => data.albums.some((album) => album.id === current) ? current : data.albums[0]?.id || '');
      setSelectedItemId((current) => data.albums.some((album) => album.items.some((item) => item.id === current)) ? current : data.albums[0]?.items[0]?.id || '');
      clearAssets();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '图集清单读取失败。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadManifest(); }, []);

  const album = manifest?.albums.find((entry) => entry.id === selectedAlbumId) || null;
  const imageVersion = manifest?.updatedAt || String(manifest?.version || 1);
  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!album) return [];
    return album.items.filter((item) => !query || `${item.title} ${item.author} ${item.tags.join(' ')}`.toLocaleLowerCase().includes(query));
  }, [album, search]);
  const item = album?.items.find((entry) => entry.id === selectedItemId) || null;
  const itemAssetKey = item?.pendingId || '';
  const totalPendingBytes = Object.values(assets).reduce((sum, asset) => sum + asset.original.size + asset.thumbnail.size, 0);

  const updateAlbum = (patch: Partial<GalleryAlbum>) => {
    if (!manifest || !album) return;
    setManifest({...manifest, albums: manifest.albums.map((entry) => entry.id === album.id ? {...entry, ...patch} : entry)});
  };

  const updateItem = (patch: Partial<GalleryItem>) => {
    if (!manifest || !album || !item) return;
    setManifest({...manifest, albums: manifest.albums.map((entry) => entry.id === album.id
      ? {...entry, items: entry.items.map((current) => current.id === item.id ? {...current, ...patch} : current)}
      : entry)});
  };

  const addFiles = async (files: FileList | File[]) => {
    if (!manifest || !album || !files.length) return;
    setError('');
    setNotice('');
    const created: GalleryItem[] = [];
    const addedAssets: Record<string, PendingAsset> = {};
    try {
      for (const file of Array.from(files)) {
        if (!IMAGE_EXTENSIONS.has(file.name.split('.').pop()?.toLocaleLowerCase() || '')) continue;
        if (file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error(`${file.name} 超过单张 20 MiB 限制。`);
        const id = makeId();
        const thumbnail = await createThumbnail(file);
        addedAssets[id] = {original: file, thumbnail, previewUrl: ''};
        created.push({
          id,
          pixivId: '',
          title: file.name.replace(/\.[^.]+$/, ''),
          author: '',
          description: '',
          tags: ['其他'],
          pixivUrl: '',
          image: '',
          thumbnail: '',
          pendingId: id,
        });
      }
      if (!created.length) return;
      const projected = totalPendingBytes + Object.values(addedAssets).reduce((sum, asset) => sum + asset.original.size + asset.thumbnail.size, 0);
      if (projected > 24 * 1024 * 1024) throw new Error('单次待上传图片总量不能超过 24 MiB，请分批保存。');
      Object.values(addedAssets).forEach((asset) => {
        asset.previewUrl = URL.createObjectURL(asset.thumbnail);
        objectUrls.current.add(asset.previewUrl);
      });
      setAssets((current) => ({...current, ...addedAssets}));
      setManifest({...manifest, albums: manifest.albums.map((entry) => entry.id === album.id ? {...entry, items: [...entry.items, ...created]} : entry)});
      setSelectedItemId(created[0].id);
      setNotice(`已加入 ${created.length} 张图片。请填写作品信息后保存。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '图片无法读取。');
    }
  };

  const replaceImage = async (file?: File) => {
    if (!file || !item) return;
    try {
      if (file.size < 1 || file.size > MAX_FILE_BYTES) throw new Error('单张图片不能超过 20 MiB。');
      fileExtension(file);
      const thumbnail = await createThumbnail(file);
      const pendingId = makeId();
      const previousPending = itemAssetKey;
      const projected = totalPendingBytes - (assets[previousPending]?.original.size || 0) - (assets[previousPending]?.thumbnail.size || 0) + file.size + thumbnail.size;
      if (projected > 24 * 1024 * 1024) throw new Error('单次待上传图片总量不能超过 24 MiB，请分批保存。');
      setAssets((current) => {
        const next = {...current};
        if (previousPending) {
          const previous = next[previousPending];
          if (previous?.previewUrl) {
            URL.revokeObjectURL(previous.previewUrl);
            objectUrls.current.delete(previous.previewUrl);
          }
          delete next[previousPending];
        }
        const previewUrl = URL.createObjectURL(thumbnail);
        objectUrls.current.add(previewUrl);
        next[pendingId] = {original: file, thumbnail, previewUrl};
        return next;
      });
      updateItem({pendingId});
      setNotice(`已选择替换图片：${file.name}`);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '替换图片失败。');
    }
  };

  const removeItem = () => {
    if (!manifest || !album || !item) return;
    if (!window.confirm(`确定从图集中删除「${item.title}」及其图片文件吗？`)) return;
    const pendingId = item.pendingId || '';
    setAssets((current) => {
      if (!pendingId) return current;
      const next = {...current};
      const pending = next[pendingId];
      if (pending?.previewUrl) {
        URL.revokeObjectURL(pending.previewUrl);
        objectUrls.current.delete(pending.previewUrl);
      }
      delete next[pendingId];
      return next;
    });
    const nextItems = album.items.filter((entry) => entry.id !== item.id);
    setManifest({...manifest, albums: manifest.albums.map((entry) => entry.id === album.id ? {...entry, items: nextItems} : entry)});
    setSelectedItemId(nextItems[0]?.id || '');
    setNotice('作品已标记为删除，保存后会从 Hugging Face 图集中移除。');
  };

  const save = async () => {
    if (!manifest || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData();
      const submission: GalleryPayload = {
        ...manifest,
        albums: manifest.albums.map((entry) => ({
          ...entry,
          items: entry.items.map((current) => {
            const {pendingId, ...clean} = current;
            return pendingId ? {...clean, image: `pending:${pendingId}`, thumbnail: `pending:${pendingId}`} : clean;
          }),
        })),
      };
      form.append('manifest', JSON.stringify(submission));
      for (const [id, asset] of Object.entries(assets)) {
        form.append('originals', asset.original, `${id}.${fileExtension(asset.original)}`);
        form.append('thumbnails', asset.thumbnail, `${id}.webp`);
      }
      const result = await consoleUpload<{revision: string; gitCommitSha: string; count: number}>('/api/console/gallery', form);
      await loadManifest();
      setNotice(`已保存 ${result.count} 张作品并同步 GitHub 与 Hugging Face${result.gitCommitSha ? `（GitHub ${result.gitCommitSha.slice(0, 8)}）` : ''}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '图集保存失败。');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.centerState}><Icon icon="lucide:loader-circle" />正在读取 Hugging Face 图集…</div>;

  return (
    <section className={styles.galleryConsole} aria-label="图集编辑器">
      <header className={styles.galleryConsoleHeader}>
        <div>
          <span className={styles.eyebrow}>IMAGE GALLERY</span>
          <h2>图集编辑</h2>
          <p>{album ? `${album.items.length} 张作品 · 后端动态读取并同步 GitHub/HF；写入需配置 GITHUB_REPO_TOKEN 与 HF_PIC_TOKEN` : '暂无可编辑图集'}</p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => { if (window.confirm('重新读取会放弃所有未保存的修改，继续吗？')) void loadManifest(); }} disabled={saving}><Icon icon="lucide:refresh-cw" />重新读取</button>
          <button type="button" className={styles.primaryButton} onClick={() => void save()} disabled={!manifest || saving}><Icon icon={saving ? 'lucide:loader-circle' : 'lucide:cloud-upload'} />{saving ? '正在提交…' : '保存并同步'}</button>
        </div>
      </header>
      {error ? <div className={styles.errorBanner} role="alert"><Icon icon="lucide:circle-alert" />{error}</div> : null}
      {notice ? <div className={styles.noticeBanner} role="status"><Icon icon="lucide:circle-check" />{notice}</div> : null}
      {!album ? <div className={styles.emptyState}>图集清单为空。</div> : (
        <div className={styles.galleryEditorGrid}>
          <aside className={styles.galleryWorkSidebar}>
            <div className={styles.galleryListTools}>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索作品" aria-label="搜索图集作品" />
              <label className={styles.secondaryButton}>
                <Icon icon="lucide:image-plus" />添加图片
                <input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" multiple onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ''; }} />
              </label>
            </div>
            <div className={styles.galleryWorkList}>
              {visibleItems.map((entry) => (
                <button type="button" className={entry.id === selectedItemId ? styles.galleryWorkActive : styles.galleryWorkButton} key={entry.id} onClick={() => setSelectedItemId(entry.id)}>
                  {entry.pendingId
                    ? <img className={styles.galleryThumbnailImage} src={assets[entry.pendingId]?.previewUrl} alt="" />
                    : <GalleryAdminImage path={entry.thumbnail} alt="" className={styles.galleryThumbnailImage} version={imageVersion} />}
                  <span><strong>{entry.title}</strong><small>{entry.author || '未填写作者'} · {entry.tags.slice(0, 2).join('、') || '无标签'}</small></span>
                </button>
              ))}
              {!visibleItems.length ? <p className={styles.emptyState}>没有匹配的作品。</p> : null}
            </div>
          </aside>
          <div className={styles.galleryDetailEditor}>
            <section className={styles.galleryAlbumFields}>
              <h3>图集信息</h3>
              <label>图集名称<input value={album.title} onChange={(event) => updateAlbum({title: event.target.value})} /></label>
              <label>图集说明<textarea value={album.description} rows={2} onChange={(event) => updateAlbum({description: event.target.value})} /></label>
              <label>图集标签<input value={album.tags.join(', ')} placeholder="用逗号分隔" onChange={(event) => updateAlbum({tags: splitTags(event.target.value)})} /></label>
            </section>
            {item ? (
              <section className={styles.galleryItemFields}>
                <div className={styles.galleryItemHeading}>
                  <div><h3>作品信息</h3><small>{item.pixivId ? `Pixiv ID ${item.pixivId}` : '本地图集作品'}</small></div>
                  <button type="button" className={styles.dangerButton} onClick={removeItem}><Icon icon="lucide:trash-2" />删除作品</button>
                </div>
                <div className={styles.galleryItemPreview}>
                  {item.pendingId
                    ? <img className={styles.galleryDetailImage} src={assets[item.pendingId]?.previewUrl} alt={item.title} />
                    : <GalleryAdminImage path={item.thumbnail} alt={item.title} className={styles.galleryDetailImage} version={imageVersion} eager />}
                  <label className={styles.secondaryButton}><Icon icon="lucide:replace" />替换原图<input type="file" accept="image/avif,image/gif,image/jpeg,image/png,image/webp" onChange={(event) => { void replaceImage(event.target.files?.[0]); event.target.value = ''; }} /></label>
                </div>
                <label>标题<input value={item.title} onChange={(event) => updateItem({title: event.target.value})} /></label>
                <label>作者<input value={item.author} onChange={(event) => updateItem({author: event.target.value})} /></label>
                <label>作品说明<textarea value={item.description} rows={5} onChange={(event) => updateItem({description: event.target.value})} /></label>
                <label>标签<input value={item.tags.join(', ')} placeholder="用逗号分隔" onChange={(event) => updateItem({tags: splitTags(event.target.value)})} /></label>
              </section>
            ) : <div className={styles.emptyState}>请选择一张作品进行编辑，或添加图片。</div>}
          </div>
        </div>
      )}
      {Object.keys(assets).length ? <p className={styles.galleryUploadSummary}>待上传 {Object.keys(assets).length} 张原图与 WebP 缩略图 · {(totalPendingBytes / (1024 * 1024)).toFixed(1)} MiB</p> : null}
    </section>
  );
}
