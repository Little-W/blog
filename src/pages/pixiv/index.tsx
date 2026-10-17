import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import BackToTopButton from '@theme/BackToTopButton';
import {type PixivItem, type PixivRankingData, emptyRanking} from '@site/data/pixiv';
import PixivImage from './PixivImage';
import {IMAGE_MIRRORS, imageUrlOnMirror, measureFastestMirror, readMirrorPreference, saveMirrorPreference, type ImageMirror} from './image-mirrors';
import styles from './pixiv.module.css';

const API_URL = '/api/pixiv-ranking';
const DETAIL_URL = '/api/pixiv-detail';
const RELATED_URL = '/api/pixiv-related';
const MODES = [
  {key: 'day', label: '日榜'},
  {key: 'week', label: '周榜'},
  {key: 'month', label: '月榜'},
  {key: 'week_rookie', label: '新人榜'},
  {key: 'week_original', label: '原创榜'},
];

type Artwork = {
  id: number;
  title: string;
  caption?: string;
  width?: number;
  height?: number;
  page_count?: number;
  total_view?: number;
  total_bookmarks?: number;
  create_date?: string;
  user?: {name?: string};
  tags?: Array<{name: string; translated_name?: string}>;
  image_urls?: {large?: string; medium?: string; original?: string};
  meta_single_page?: {original_image_url?: string};
  meta_pages?: Array<{image_urls?: {large?: string; original?: string}}>;
};

type RelatedArtwork = {id: number; title: string; author: string; thumb: string};
type ArtworkDetail = {illust: Artwork; related: RelatedArtwork[]};

function rankClass(rank: number): string {
  if (rank === 1) return styles.rank1;
  if (rank === 2) return styles.rank2;
  if (rank === 3) return styles.rank3;
  return styles.rankOther;
}

function formatDate(date: string): string {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return matched ? `${matched[1]}年${Number(matched[2])}月${Number(matched[3])}日` : date;
}

function imageProxy(url: string, filename: string | undefined, mirror: ImageMirror): string {
  const query = new URLSearchParams({u: imageUrlOnMirror(url, mirror)});
  if (filename) query.set('download', filename);
  return `/api/pixiv-thumb?${query.toString()}`;
}

function originalPage(illust: Artwork, page: number): string {
  return illust.meta_pages?.[page]?.image_urls?.original
    || illust.meta_single_page?.original_image_url
    || illust.meta_pages?.[page]?.image_urls?.large
    || illust.image_urls?.large
    || '';
}

function displayPage(illust: Artwork, page: number): string {
  return illust.meta_pages?.[page]?.image_urls?.large
    || (page === 0 ? illust.image_urls?.large : '')
    || illust.meta_pages?.[page]?.image_urls?.original
    || (page === 0 ? illust.meta_single_page?.original_image_url : '')
    || illust.image_urls?.large
    || originalPage(illust, page);
}

function cleanCaption(caption = ''): string {
  return caption.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').trim();
}

function formatCount(count?: number): string {
  return typeof count === 'number' ? new Intl.NumberFormat('zh-CN').format(count) : '—';
}

function imageExtension(url: string): string {
  const extension = /\.(jpe?g|png|webp|gif)(?:$|\?)/i.exec(url)?.[1];
  return extension ? `.${extension.toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

export default function PixivRanking() {
  const [mode, setMode] = useState('day');
  const [data, setData] = useState<PixivRankingData>(emptyRanking);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mirror, setMirror] = useState<ImageMirror>(readMirrorPreference);
  const [speedTesting, setSpeedTesting] = useState(true);
  const [bannerLoaded, setBannerLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ArtworkDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x: 0, y: 0});
  const [dragging, setDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({width: 0, height: 0});
  const abortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const relatedAbortRef = useRef<AbortController | null>(null);
  const loadMoreLock = useRef(false);
  const speedProbeStarted = useRef(false);
  const failedMirrors = useRef<Set<ImageMirror>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const viewerViewportRef = useRef<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerDragRef = useRef<{pointerId: number; startX: number; startY: number; panX: number; panY: number} | null>(null);

  const fetchRanking = useCallback(async (targetMode: string, offset = 0, append = false, noCache = false) => {
    if (append && loadMoreLock.current) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (append) {
      loadMoreLock.current = true;
      setLoadingMore(true);
    } else {
      loadMoreLock.current = false;
      setLoadingMore(false);
      setError(null);
      setLoading(true);
      setData(emptyRanking);
    }

    try {
      const response = await fetch(`${API_URL}?mode=${encodeURIComponent(targetMode)}&offset=${offset}`, {
        signal: controller.signal,
        cache: noCache ? 'no-store' : 'default',
        headers: noCache ? {'cache-control': 'no-cache'} : {},
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || `榜单加载失败（${response.status}）`);
      }
      const page = payload.data as PixivRankingData;
      if (!append && !page.illusts.some((item) => item.thumb)) setSpeedTesting(false);
      setData((current) => {
        if (!append) return page;
        const seen = new Set(current.illusts.map((item) => item.id));
        return {...page, illusts: [...current.illusts, ...page.illusts.filter((item) => !seen.has(item.id))]};
      });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : '榜单加载失败。');
      if (!append) {
        setData(emptyRanking);
        setSpeedTesting(false);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        loadMoreLock.current = false;
      }
    }
  }, []);

  useEffect(() => {
    void fetchRanking(mode);
    return () => abortRef.current?.abort();
  }, [mode, fetchRanking]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || data.nextOffset === null || loading || loadingMore || error) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void fetchRanking(mode, data.nextOffset!, true);
      }
    }, {rootMargin: '700px 0px'});
    observer.observe(node);
    return () => observer.disconnect();
  }, [data.nextOffset, error, fetchRanking, loading, loadingMore, mode]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return undefined;
    let frame = 0;
    const arrangeMasonry = () => {
      const computed = getComputedStyle(grid);
      const columns = Math.max(1, Number.parseInt(computed.getPropertyValue('--waterfall-columns'), 10) || 1);
      const columnGap = Number.parseFloat(computed.columnGap) || 16;
      const rowGap = Number.parseFloat(computed.rowGap) || 14;
      const cards = [...grid.querySelectorAll<HTMLElement>(':scope > article')];
      if (!cards.length) {
        grid.style.height = '0px';
        return;
      }

      const columnWidth = (grid.clientWidth - columnGap * (columns - 1)) / columns;
      cards.forEach((card) => {
        card.style.position = 'absolute';
        card.style.width = `${columnWidth}px`;
        card.style.gridColumnStart = '';
        card.style.gridRowStart = '';
        card.style.gridRowEnd = '';
        card.dataset.masonryPositioned = 'true';
      });

      const columnBottoms = Array(columns).fill(0) as number[];
      cards.forEach((card, index) => {
        const column = index < columns
          ? index
          : columnBottoms.indexOf(Math.min(...columnBottoms));
        const top = columnBottoms[column];
        card.style.left = `${column * (columnWidth + columnGap)}px`;
        card.style.top = `${top}px`;
        columnBottoms[column] = top + card.getBoundingClientRect().height + rowGap;
      });

      grid.style.height = `${Math.max(...columnBottoms) - rowGap}px`;
    };
    const scheduleArrange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(arrangeMasonry);
    };
    const resizeObserver = new ResizeObserver(scheduleArrange);
    grid.querySelectorAll<HTMLElement>(':scope > article').forEach((card) => resizeObserver.observe(card));
    resizeObserver.observe(grid);
    scheduleArrange();
    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [data.illusts.length, mode]);

  useEffect(() => {
    relatedAbortRef.current?.abort();
    if (selectedId === null) {
      detailAbortRef.current?.abort();
      setDetail(null);
      setRelatedLoading(false);
      return undefined;
    }
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    const relatedController = new AbortController();
    relatedAbortRef.current = relatedController;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setRelatedLoading(true);
    setPageIndex(0);
    void (async () => {
      try {
        const response = await fetch(`${DETAIL_URL}?id=${selectedId}`, {signal: controller.signal});
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.message || '作品详情加载失败。');
        setDetail({illust: payload.data.illust as Artwork, related: []});
        void (async () => {
          try {
            const relatedResponse = await fetch(`${RELATED_URL}?id=${selectedId}`, {signal: relatedController.signal});
            const relatedPayload = await relatedResponse.json().catch(() => ({}));
            if (!relatedResponse.ok || !relatedPayload.success) throw new Error(relatedPayload.message || '相似推荐加载失败。');
            const related = (relatedPayload.data?.illusts || []) as RelatedArtwork[];
            setDetail((current) => current?.illust.id === selectedId ? {...current, related} : current);
          } catch (caught) {
            if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
              setDetail((current) => current?.illust.id === selectedId ? {...current, related: []} : current);
            }
          } finally {
            if (!relatedController.signal.aborted) setRelatedLoading(false);
          }
        })();
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setDetailError(caught instanceof Error ? caught.message : '作品详情加载失败。');
        setRelatedLoading(false);
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    })();
    return () => {
      controller.abort();
      relatedController.abort();
    };
  }, [selectedId]);

  useEffect(() => {
    if (selectedId === null) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    modalScrollRef.current?.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedId]);

  useEffect(() => {
    setZoom(1);
    setPan({x: 0, y: 0});
    setDragging(false);
    pointerDragRef.current = null;
  }, [selectedId, pageIndex]);

  useEffect(() => {
    if (zoom === 1) setPan({x: 0, y: 0});
  }, [zoom]);

  useEffect(() => {
    setPreviewImage(null);
    setCanvasSize({width: 0, height: 0});
  }, [detail?.illust?.id, pageIndex]);

  useEffect(() => {
    const image = previewImage;
    const viewport = viewerViewportRef.current;
    const canvas = previewCanvasRef.current;
    if (!image || !viewport || !canvas || image.naturalWidth === 0 || image.naturalHeight === 0) return undefined;

    const drawPreview = () => {
      const pixelScale = Math.min(
        1,
        4096 / image.naturalWidth,
        4096 / image.naturalHeight,
        Math.sqrt(12_000_000 / (image.naturalWidth * image.naturalHeight)),
      );
      const pixelWidth = Math.max(1, Math.round(image.naturalWidth * pixelScale));
      const pixelHeight = Math.max(1, Math.round(image.naturalHeight * pixelScale));
      const fit = Math.min(viewport.clientWidth / pixelWidth, viewport.clientHeight / pixelHeight);
      if (!Number.isFinite(fit) || fit <= 0) return;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(image, 0, 0, pixelWidth, pixelHeight);
      setCanvasSize({width: pixelWidth * fit, height: pixelHeight * fit});
    };

    drawPreview();
    const observer = new ResizeObserver(drawPreview);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [detail?.illust?.id, pageIndex, previewImage]);

  const handleRefresh = () => {
    setRefreshing(true);
    void fetchRanking(mode, 0, false, true);
  };

  const items = data.illusts || [];
  const banner = items.find((item) => item.thumb)?.thumb;
  const dateLabel = data.date ? formatDate(data.date) : '';
  const artwork = detail?.illust;
  const pageCount = Math.max(1, artwork?.page_count || artwork?.meta_pages?.length || 1);
  const pageOriginal = artwork ? originalPage(artwork, pageIndex) : '';
  const pageDisplay = artwork ? displayPage(artwork, pageIndex) : '';
  const filename = `${(artwork?.title || 'pixiv-artwork').replace(/[\\/:*?"<>|]/g, '_')}_p${pageIndex + 1}${imageExtension(pageOriginal)}`;

  useEffect(() => {
    const viewport = viewerViewportRef.current;
    if (!pageDisplay || speedTesting || previewImage || !viewport) return undefined;
    const captureLoadedImage = () => {
      const image = viewport.querySelector<HTMLImageElement>(`.${styles.detailSourceImage}`);
      if (image?.complete && image.naturalWidth > 0) setPreviewImage(image);
    };
    captureLoadedImage();
    const timer = window.setInterval(captureLoadedImage, 120);
    return () => window.clearInterval(timer);
  }, [pageDisplay, previewImage, speedTesting]);

  useEffect(() => {
    const preferred = readMirrorPreference();
    setMirror(preferred);
  }, []);

  useEffect(() => {
    const probeImage = items.find((item) => item.thumb)?.thumb;
    if (!probeImage || speedProbeStarted.current) return undefined;
    speedProbeStarted.current = true;
    let active = true;
    setSpeedTesting(true);
    void measureFastestMirror(probeImage).then((fastest) => {
      if (!active) return;
      if (fastest) {
        setMirror(fastest);
        saveMirrorPreference(fastest);
      }
      setSpeedTesting(false);
    });
    return () => { active = false; };
  }, [items]);

  useEffect(() => setBannerLoaded(false), [banner]);

  const handleMirrorFailure = useCallback((failedMirror: ImageMirror) => {
    failedMirrors.current.add(failedMirror);
    setMirror((current) => {
      if (current !== failedMirror) return current;
      const fallback = IMAGE_MIRRORS.find((candidate) => !failedMirrors.current.has(candidate)) || current;
      saveMirrorPreference(fallback);
      return fallback;
    });
  }, []);

  const handleViewerWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom((current) => Math.min(5, Math.max(1, current * factor)));
  };

  const handlePreviewImageLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setPreviewImage(event.currentTarget);
  };

  const handleViewerPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (zoom <= 1 || event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture may be unavailable in synthetic events; dragging still works while the pointer stays over the image.
    }
    pointerDragRef.current = {pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y};
    setDragging(true);
  };

  const handleViewerPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({x: drag.panX + event.clientX - drag.startX, y: drag.panY + event.clientY - drag.startY});
  };

  const finishViewerDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointerDragRef.current?.pointerId !== event.pointerId) return;
    pointerDragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const resetViewer = () => {
    setZoom(1);
    setPan({x: 0, y: 0});
    setDragging(false);
    pointerDragRef.current = null;
  };

  return (
    <Layout title="P站美图榜" description="Pixiv 插画榜单">
      <PageMetadata title="P站美图榜" description="Pixiv 插画榜单" />
      <div className={styles.page}>
        <header className={styles.hero} style={banner && bannerLoaded ? {backgroundImage: `url("${imageUrlOnMirror(banner, mirror)}")`} : undefined}>
          <button className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? '刷新中…' : '刷新'}
          </button>
          <h1 className={styles.heroTitle}>Pixiv 美图榜</h1>
          <p className={styles.heroSub}>
            {loading ? '正在加载榜单…' : dateLabel ? `正在查看 ${dateLabel} 榜单` : '暂无榜单数据'}
          </p>
          <nav className={styles.tabs} aria-label="榜单类型">
            {MODES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={mode === entry.key}
                className={clsx(styles.tab, mode === entry.key && styles.tabActive)}
                onClick={() => setMode(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
        </header>

        {error && <p className={styles.tip} role="status">提示：{error}</p>}

        {items.length === 0 && !loading ? (
          <p className={styles.empty}>暂无数据。</p>
        ) : (
          <>
            <div className={styles.waterfall} ref={gridRef}>
              {items.map((item: PixivItem) => (
                <article key={item.id} className={styles.card}>
                  <button type="button" className={styles.cover} onClick={() => setSelectedId(item.id)} aria-label={`查看作品：${item.title}`}>
                    <span className={clsx(styles.rankBadge, rankClass(item.rank))}>#{item.rank}</span>
                    {item.thumb ? speedTesting
                      ? <span className={styles.imagePlaceholder} aria-hidden="true" />
                      : <PixivImage src={item.thumb} preferredMirror={mirror} priority={item.rank} onMirrorFailure={handleMirrorFailure} onLoad={item.rank === 1 ? () => setBannerLoaded(true) : undefined} alt={item.title} />
                      : <span className={styles.coverFallback}>无缩略图</span>}
                  </button>
                  <div className={styles.info}>
                    <button type="button" className={styles.cardTitle} onClick={() => setSelectedId(item.id)}>{item.title || '无题'}</button>
                    <div className={styles.cardAuthor}>By: {item.author}</div>
                  </div>
                </article>
              ))}
            </div>
            <div className={styles.loadStatus} ref={sentinelRef} aria-live="polite">
              {loadingMore ? '正在加载更多作品…' : data.nextOffset !== null ? '继续向下滚动以加载更多' : items.length ? '已经到底了' : loading ? '正在加载榜单…' : ''}
            </div>
          </>
        )}
      </div>
      <BackToTopButton />

      {selectedId !== null && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => {if (event.target === event.currentTarget) setSelectedId(null);}}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="作品详情">
            <button type="button" className={styles.modalClose} onClick={() => setSelectedId(null)} aria-label="关闭详情">×</button>
            <div className={styles.modalScroll} ref={modalScrollRef}>
              {detailLoading && <div className={styles.modalMessage}>正在加载作品详情…</div>}
              {detailError && <div className={styles.modalMessage}>{detailError}</div>}
              {artwork && (
                <>
                  <div className={styles.detailLayout}>
                    <div className={styles.detailImagePanel} onWheel={handleViewerWheel}>
                      {pageDisplay && (
                        <div className={styles.detailImageViewport} ref={viewerViewportRef}>
                          {!previewImage && <span className={styles.detailImagePlaceholder} aria-hidden="true" />}
                          <PixivImage
                            className={styles.detailSourceImage}
                            placeholderClassName={styles.detailSourcePlaceholder}
                            src={pageDisplay}
                            preferredMirror={mirror}
                            priority={-100}
                            enabled={!speedTesting}
                            onMirrorFailure={handleMirrorFailure}
                            onLoad={handlePreviewImageLoad}
                            alt={artwork.title}
                          />
                          {previewImage && (
                            <canvas
                              ref={previewCanvasRef}
                              className={styles.detailImageCanvas}
                              style={{
                                width: `${canvasSize.width * zoom}px`,
                                height: `${canvasSize.height * zoom}px`,
                                left: '50%',
                                top: '50%',
                                marginLeft: `${pan.x - canvasSize.width * zoom / 2}px`,
                                marginTop: `${pan.y - canvasSize.height * zoom / 2}px`,
                                cursor: dragging ? 'grabbing' : zoom > 1 ? 'grab' : 'zoom-in',
                              }}
                              aria-label={artwork.title}
                              onPointerDown={handleViewerPointerDown}
                              onPointerMove={handleViewerPointerMove}
                              onPointerUp={finishViewerDrag}
                              onPointerCancel={finishViewerDrag}
                            />
                          )}
                        </div>
                      )}
                      <div className={styles.zoomTools}>
                        <span className={styles.zoomHint}>滚轮缩放 · 放大后可拖动</span>
                        <button type="button" onClick={() => setZoom((current) => Math.max(1, current / 1.25))} disabled={zoom <= 1} aria-label="缩小">−</button>
                        <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
                        <button type="button" onClick={() => setZoom((current) => Math.min(5, current * 1.25))} disabled={zoom >= 5} aria-label="放大">+</button>
                        <button type="button" onClick={resetViewer}>重置</button>
                      </div>
                      {pageCount > 1 && (
                        <div className={styles.pageControls}>
                          <button type="button" onClick={() => setPageIndex((page) => Math.max(0, page - 1))} disabled={pageIndex === 0}>上一张</button>
                          <span>{pageIndex + 1} / {pageCount}</span>
                          <button type="button" onClick={() => setPageIndex((page) => Math.min(pageCount - 1, page + 1))} disabled={pageIndex >= pageCount - 1}>下一张</button>
                        </div>
                      )}
                    </div>
                    <aside className={styles.detailInfo}>
                      <h2>{artwork.title || '无题'}</h2>
                      <p className={styles.detailAuthor}>By: {artwork.user?.name || '未知'}</p>
                      <div className={styles.stats}>
                        <span>浏览 {formatCount(artwork.total_view)}</span>
                        <span>收藏 {formatCount(artwork.total_bookmarks)}</span>
                        <span>{artwork.width || '—'} × {artwork.height || '—'}</span>
                      </div>
                      <a className={styles.downloadButton} href={imageProxy(pageOriginal, filename, mirror)}>下载原图</a>
                      {artwork.tags?.length ? (
                        <div className={styles.detailTags}>
                          {artwork.tags.map((tag, index) => <span key={`${tag.name}-${index}`}>{tag.translated_name || tag.name}</span>)}
                        </div>
                      ) : null}
                      {cleanCaption(artwork.caption) && <p className={styles.caption}>{cleanCaption(artwork.caption)}</p>}
                    </aside>
                  </div>

                  <section className={styles.relatedSection}>
                    <h3>相似推荐</h3>
                    {detail.related.length ? (
                      <div className={styles.relatedGrid}>
                        {detail.related.map((related, index) => (
                          <button type="button" className={styles.relatedCard} key={related.id} onClick={() => setSelectedId(related.id)}>
                            <PixivImage src={related.thumb} preferredMirror={mirror} priority={10000 + index} enabled={!speedTesting} onMirrorFailure={handleMirrorFailure} alt={related.title} />
                            <span>{related.title}</span>
                            <small>By: {related.author}</small>
                          </button>
                        ))}
                      </div>
                    ) : <p className={styles.modalMessage}>{relatedLoading ? '正在加载相似推荐…' : '暂时没有相似推荐。'}</p>}
                  </section>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </Layout>
  );
}
