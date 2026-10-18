import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import {Icon} from '@iconify/react';

import styles from './styles.module.css';

export type GalleryItem = {
  id: string;
  pixivId: string;
  title: string;
  author: string;
  description: string;
  tags: string[];
  pixivUrl: string;
  image: string;
  fallbackImage: string;
  proxyImage: string;
  thumbnail: string;
  thumbnailFallback: string;
  thumbnailProxy: string;
};

export type GalleryAlbum = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  updatedAt: string | null;
  items: GalleryItem[];
};

type GalleryPayload = {albums: GalleryAlbum[]; updatedAt: string | null};

async function fetchGallery(signal?: AbortSignal): Promise<GalleryPayload> {
  const response = await fetch('/api/gallery', {
    credentials: 'same-origin',
    headers: {accept: 'application/json'},
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success || !Array.isArray(payload.data?.albums)) {
    throw new Error(payload.message || `图集读取失败（${response.status}）`);
  }
  return payload.data as GalleryPayload;
}

function GalleryImage({item, eager = false, contain = false, original = false, imageStyle}: {item: GalleryItem; eager?: boolean; contain?: boolean; original?: boolean; imageStyle?: React.CSSProperties}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [requestStarted, setRequestStarted] = useState(eager || original);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const candidates = original
    ? [item.proxyImage, item.image, item.fallbackImage].filter(Boolean)
    : [item.thumbnailProxy || item.proxyImage, item.thumbnail || item.image, item.thumbnailFallback || item.fallbackImage].filter(Boolean);
  const source = candidates[attempt] || item.image;
  useEffect(() => {
    setAttempt(0);
    setFailed(false);
    setLoaded(false);
    setRequestStarted(eager || original);
  }, [eager, item.fallbackImage, item.image, item.proxyImage, item.thumbnail, item.thumbnailFallback, item.thumbnailProxy, original]);
  useEffect(() => {
    const image = imageRef.current;
    if (!image || eager || original) {
      setRequestStarted(true);
      return undefined;
    }
    if (!('IntersectionObserver' in window)) {
      setRequestStarted(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setRequestStarted(true);
        observer.disconnect();
      }
    }, {rootMargin: '240px'});
    observer.observe(image);
    return () => observer.disconnect();
  }, [eager, original, source]);
  useEffect(() => {
    if (failed || loaded || !requestStarted) return undefined;
    const timeout = window.setTimeout(() => {
      if (attempt < candidates.length - 1) setAttempt(attempt + 1);
      else setFailed(true);
    }, original ? 25000 : 12000);
    return () => window.clearTimeout(timeout);
  }, [attempt, candidates.length, failed, loaded, original, requestStarted]);
  return (
    <span className={styles.imageFrame}>
      <img
        ref={imageRef}
        className={`${styles.image}${contain ? ` ${styles.containImage}` : ''}`}
        src={source}
        alt={item.title}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        style={imageStyle}
        onLoad={() => { setLoaded(true); setFailed(false); }}
        onError={() => {
          setLoaded(false);
          if (attempt < candidates.length - 1) {
            setAttempt(attempt + 1);
          } else {
            setFailed(true);
          }
        }}
      />
      {failed ? <span className={styles.imageFailure}>图片暂时无法加载</span> : null}
    </span>
  );
}

function ArtworkCard({item, eager = false, onPreview}: {item: GalleryItem; eager?: boolean; onPreview: (item: GalleryItem) => void}) {
  return (
    <article className={styles.artworkCard}>
      <div className={styles.imageLink}>
        <button className={styles.imagePreviewButton} type="button" onClick={() => onPreview(item)} aria-label={`预览插画：${item.title}`}>
          <GalleryImage item={item} eager={eager} />
        </button>
        {item.pixivUrl ? <a className={styles.openArtwork} href={item.pixivUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}><Icon icon="lucide:external-link" />Pixiv</a> : null}
      </div>
      <div className={styles.artworkInfo}>
        <h3 title={item.title}>{item.title}</h3>
        <p className={styles.author}>{item.author}</p>
        {item.description ? <p className={styles.description}>{item.description}</p> : null}
        <div className={styles.tags}>
          {item.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}
          {item.tags.length > 4 ? <span className={styles.moreTags}>+{item.tags.length - 4}</span> : null}
        </div>
      </div>
    </article>
  );
}

function AlbumHeading({album}: {album: GalleryAlbum}) {
  return (
    <header className={styles.albumHeading}>
      <div>
        <span className={styles.eyebrow}>IMAGE COLLECTION</span>
        <h2>{album.title}</h2>
        {album.description ? <p>{album.description}</p> : null}
      </div>
    </header>
  );
}

export function GalleryPreview(): JSX.Element {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetchGallery(controller.signal)
      .then((data) => setAlbums(data.albums))
      .catch(() => setAlbums([]))
      .finally(() => { if (!controller.signal.aborted) setLoaded(true); });
    return () => controller.abort();
  }, []);

  const firstAlbum = albums[0];
  const items = firstAlbum?.items.slice(0, 4) || [];
  if (loaded && !firstAlbum) return <section className={styles.previewSection} aria-label="图集预览" />;

  return (
    <section className={styles.previewSection} aria-labelledby="home-gallery-title">
      <header className={styles.previewHeading}>
        <div>
          <span className={styles.eyebrow}>IMAGE GALLERY</span>
          <h2 id="home-gallery-title">图集</h2>
        </div>
        <Link to="/gallery" className={styles.galleryLink}>浏览图集 <Icon icon="lucide:arrow-up-right" /></Link>
      </header>
      {items.length ? (
        <div className={styles.previewGrid}>
          {items.map((item, index) => <Link to="/gallery" className={styles.previewImage} key={item.id} aria-label={`浏览图集：${item.title}`}><GalleryImage item={item} eager={index === 0} /></Link>)}
        </div>
      ) : <div className={styles.emptyPreview}>{loaded ? '图集即将上线。' : '正在读取图集…'}</div>}
    </section>
  );
}

export default function ImageGalleryPage(): JSX.Element {
  const [albums, setAlbums] = useState<GalleryAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [tagQuery, setTagQuery] = useState('');
  const [activeAlbum, setActiveAlbum] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x: 0, y: 0});
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{x: number; y: number; panX: number; panY: number} | null>(null);
  const resultsRef = useRef<HTMLElement | null>(null);

  const loadGallery = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchGallery();
      setAlbums(data.albums);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '图集暂时无法读取。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadGallery(); }, [loadGallery]);

  const filteredAlbums = useMemo(() => activeAlbum === 'all'
    ? albums
    : albums.filter((album) => album.id === activeAlbum), [activeAlbum, albums]);
  const allTags = useMemo(() => [...new Set(filteredAlbums.flatMap((album) =>
    album.items.flatMap((item) => item.tags)))].sort((left, right) => left.localeCompare(right, 'zh-CN')), [filteredAlbums]);
  const visibleTags = useMemo(() => {
    const query = tagQuery.trim().toLocaleLowerCase();
    return query ? allTags.filter((tag) => tag.toLocaleLowerCase().includes(query)) : allTags;
  }, [allTags, tagQuery]);
  const galleryItems = useMemo(() => filteredAlbums.flatMap((album) =>
    album.items.filter((item) => !activeTag || item.tags.includes(activeTag))), [activeTag, filteredAlbums]);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(galleryItems.length / pageSize));
  const pageItems = galleryItems.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const previewIndex = previewItem ? galleryItems.findIndex((item) => item.id === previewItem.id) : -1;

  useEffect(() => { setPageIndex(0); }, [activeAlbum, activeTag, tagQuery]);
  useEffect(() => {
    if (pageIndex >= pageCount) setPageIndex(Math.max(0, pageCount - 1));
  }, [pageCount, pageIndex]);

  useEffect(() => {
    if (!previewItem) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewItem(null);
      if (event.key === 'ArrowLeft' && previewIndex > 0) setPreviewItem(galleryItems[previewIndex - 1]);
      if (event.key === 'ArrowRight' && previewIndex >= 0 && previewIndex + 1 < galleryItems.length) setPreviewItem(galleryItems[previewIndex + 1]);
      if (event.key === '+' || event.key === '=') setZoom((current) => Math.min(5, current * 1.2));
      if (event.key === '-') setZoom((current) => Math.max(0.5, current / 1.2));
      if (event.key === '0') { setZoom(1); setPan({x: 0, y: 0}); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [galleryItems, previewIndex, previewItem]);

  useEffect(() => {
    setZoom(1);
    setPan({x: 0, y: 0});
    setIsDragging(false);
    dragRef.current = null;
  }, [previewItem?.id]);

  const resetZoom = () => { setZoom(1); setPan({x: 0, y: 0}); };
  const changeZoom = (factor: number) => setZoom((current) => Math.max(0.5, Math.min(5, current * factor)));
  const handleImageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  };

  const jumpToPage = (nextPage: number) => {
    const safePage = Math.max(0, Math.min(pageCount - 1, nextPage));
    setPageIndex(safePage);
    if (resultsRef.current) {
      const top = resultsRef.current.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({top: Math.max(0, top), behavior: 'smooth'});
    }
  };

  return (
    <Layout title="图集" description="插画收藏。">
      <main className={styles.page}>
        <header className={styles.pageHeading}>
          <div>
            <span className={styles.eyebrow}>CURATED ILLUSTRATIONS</span>
            <h1>图集</h1>
          </div>
        </header>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {albums.length ? (
          <div className={styles.filterPanel}>
            <label className={styles.tagSearch}>
              <Icon icon="lucide:search" />
              <input value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} placeholder="搜索标签" aria-label="搜索图集标签" />
            </label>
            <label className={styles.albumSelector}>
              <span>图集</span>
              <select value={activeAlbum} onChange={(event) => setActiveAlbum(event.target.value)} aria-label="快速选择图集">
                <option value="all">全部图集</option>
                {albums.map((album) => <option value={album.id} key={album.id}>{album.title}</option>)}
              </select>
            </label>
            {allTags.length ? (
              <nav className={styles.tagFilters} aria-label="按标签筛选图集">
                <button type="button" className={`${styles.tagFilter} ${!activeTag ? styles.filterActive : ''}`} onClick={() => setActiveTag('')}>全部标签</button>
                {visibleTags.map((tag) => <button type="button" className={`${styles.tagFilter} ${activeTag === tag ? styles.filterActive : ''}`} key={tag} onClick={() => setActiveTag(activeTag === tag ? '' : tag)}>{tag}</button>)}
              </nav>
            ) : null}
          </div>
        ) : null}

        {loading ? <div className={styles.emptyState} role="status"><Icon icon="lucide:loader-circle" />正在读取图集…</div> : null}
        {!loading && !error && !albums.length ? <div className={styles.emptyState}>暂无图集。</div> : null}
        {!loading && !error && !galleryItems.length ? <div className={styles.emptyState}>没有符合筛选条件的图片。</div> : null}
        {galleryItems.length ? (
          <section className={styles.album} ref={resultsRef}>
            {filteredAlbums.length === 1 ? <AlbumHeading album={filteredAlbums[0]} /> : null}
            <div className={styles.resultBar}>
              <span>{activeTag ? `标签：${activeTag}` : '全部作品'} · {galleryItems.length} 张</span>
              <label>跳转页面
                <select value={pageIndex} onChange={(event) => jumpToPage(Number(event.target.value))} aria-label="快速跳转图片页">
                  {Array.from({length: pageCount}, (_, index) => <option value={index} key={index}>第 {index + 1} / {pageCount} 页</option>)}
                </select>
              </label>
            </div>
            <div className={styles.grid}>
              {pageItems.map((item) => <ArtworkCard item={item} eager onPreview={setPreviewItem} key={item.id} />)}
            </div>
            {pageCount > 1 ? (
              <nav className={styles.pagination} aria-label="图集分页">
                <button type="button" onClick={() => jumpToPage(pageIndex - 1)} disabled={pageIndex === 0}><Icon icon="lucide:chevron-left" />上一页</button>
                <span>第 {pageIndex + 1} / {pageCount} 页</span>
                <button type="button" onClick={() => jumpToPage(pageIndex + 1)} disabled={pageIndex + 1 >= pageCount}>下一页<Icon icon="lucide:chevron-right" /></button>
              </nav>
            ) : null}
          </section>
        ) : null}
        {previewItem ? (
          <div className={styles.viewerBackdrop} role="presentation" onClick={() => setPreviewItem(null)}>
            <section className={styles.viewer} role="dialog" aria-modal="true" aria-label={`插画预览：${previewItem.title}`} onClick={(event) => event.stopPropagation()}>
              <button className={styles.viewerClose} type="button" aria-label="关闭预览" onClick={() => setPreviewItem(null)}><Icon icon="lucide:x" /></button>
              <div className={styles.viewerArtwork}>
                <div
                  className={`${styles.viewerImageCanvas}${isDragging ? ` ${styles.viewerImageCanvasDragging}` : ''}`}
                  onWheel={handleImageWheel}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    dragRef.current = {x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y};
                    setIsDragging(true);
                  }}
                  onPointerMove={(event) => {
                    if (!dragRef.current) return;
                    setPan({x: dragRef.current.panX + event.clientX - dragRef.current.x, y: dragRef.current.panY + event.clientY - dragRef.current.y});
                  }}
                  onPointerUp={() => { dragRef.current = null; setIsDragging(false); }}
                  onPointerCancel={() => { dragRef.current = null; setIsDragging(false); }}
                  onLostPointerCapture={() => { dragRef.current = null; setIsDragging(false); }}
                >
                  <GalleryImage item={previewItem} eager contain original imageStyle={{transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`}} />
                </div>
                <div className={styles.viewerZoom} aria-label="图片缩放控制">
                  <button type="button" aria-label="缩小图片" onClick={() => changeZoom(1 / 1.2)}><Icon icon="lucide:minus" /></button>
                  <span className={styles.zoomLevel} aria-label={`当前缩放 ${Math.round(zoom * 100)}%`}>{Math.round(zoom * 100)}%</span>
                  <button className={styles.zoomReset} type="button" onClick={resetZoom} aria-label="重置为完整适应显示区域" title="重置为完整适应显示区域（快捷键 0）"><Icon icon="lucide:scan" /><span>适应</span></button>
                  <button type="button" aria-label="放大图片" onClick={() => changeZoom(1.2)}><Icon icon="lucide:plus" /></button>
                </div>
                <div className={styles.viewerNavigation}>
                  <button type="button" aria-label="上一张" disabled={previewIndex <= 0} onClick={() => setPreviewItem(galleryItems[previewIndex - 1])}><Icon icon="lucide:chevron-left" /></button>
                  <span>{previewIndex + 1} / {galleryItems.length}</span>
                  <button type="button" aria-label="下一张" disabled={previewIndex < 0 || previewIndex + 1 >= galleryItems.length} onClick={() => setPreviewItem(galleryItems[previewIndex + 1])}><Icon icon="lucide:chevron-right" /></button>
                </div>
              </div>
              <aside className={styles.viewerDetails}>
                <span className={styles.eyebrow}>ILLUSTRATION</span>
                <h2>{previewItem.title}</h2>
                {previewItem.author ? <p className={styles.author}>{previewItem.author}</p> : null}
                {previewItem.description ? <p className={styles.viewerDescription}>{previewItem.description}</p> : null}
                {previewItem.tags.length ? <div className={styles.tags}>{previewItem.tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}
                {previewItem.pixivUrl ? <a className={styles.pixivLink} href={previewItem.pixivUrl} target="_blank" rel="noreferrer"><Icon icon="lucide:external-link" />打开 Pixiv 作品</a> : null}
              </aside>
            </section>
          </div>
        ) : null}
      </main>
    </Layout>
  );
}
