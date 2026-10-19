import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import BackToTopButton from '@theme/BackToTopButton';
import {type PixivItem, type PixivRankingData, emptyRanking} from '@site/data/pixiv';
import {useAdminSession} from '@site/src/components/AdminSession';
import PixivImage from '@site/src/components/PixivImage';
import {IMAGE_MIRRORS, imageUrlOnMirror, measureFastestMirror, readMirrorPreference, saveMirrorPreference, type ImageMirror} from '@site/src/utils/pixiv-image-mirrors';
import styles from './pixiv.module.css';

const API_URL = '/api/pixiv-ranking';
const LIST_API_URL = '/api/pixiv-list';
const BOOKMARK_API_URL = '/api/pixiv-bookmark';
const DETAIL_URL = '/api/pixiv-detail';
const RELATED_URL = '/api/pixiv-related';
const GALLERY_API_URL = '/api/console/gallery';
const GALLERY_IMPORT_URL = '/api/console/gallery/from-pixiv';
const MODES = [
  {key: 'day', label: '日榜'},
  {key: 'week', label: '周榜'},
  {key: 'month', label: '月榜'},
  {key: 'week_rookie', label: '新人榜'},
  {key: 'week_original', label: '原创榜'},
  {key: 'recommended', label: '推荐'},
  {key: 'bookmarks', label: '收藏'},
];
const RANKING_MODES = new Set(['day', 'week', 'month', 'week_rookie', 'week_original']);
const PERSONAL_MODES = new Set(['recommended', 'bookmarks']);

type Artwork = {
  id: number;
  title: string;
  caption?: string;
  width?: number;
  height?: number;
  page_count?: number;
  total_view?: number;
  total_bookmarks?: number;
  is_bookmarked?: boolean;
  create_date?: string;
  user?: {name?: string};
  tags?: Array<{name: string; translated_name?: string}>;
  image_urls?: {large?: string; medium?: string; original?: string};
  meta_single_page?: {original_image_url?: string};
  meta_pages?: Array<{image_urls?: {large?: string; original?: string}}>;
};

type RelatedArtwork = {id: number; title: string; author: string; thumb: string; isBookmarked?: boolean};
type ArtworkDetail = {illust: Artwork; related: RelatedArtwork[]};
type PreviewSeed = {id: number; title: string; author: string; thumb: string; tags: string[]; isBookmarked?: boolean};

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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isRetryableRequestError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  const status = Number((error as {status?: number} | null)?.status);
  const message = error instanceof Error ? error.message : '';
  if (status === 401 || status === 403 || status === 404) return false;
  if (status === 429 || (status >= 500 && status < 600)) {
    return !(status === 503 && message.includes('未配置 PIXIV_REFRESH_TOKEN'));
  }
  return !Number.isFinite(status) && error instanceof TypeError;
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('请求已取消。', 'AbortError'));
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('请求已取消。', 'AbortError'));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal.addEventListener('abort', onAbort, {once: true});
  });
}

async function fetchPixivPayload(url: string, init: RequestInit) {
  const signal = init.signal as AbortSignal;
  const retryDelays = [500, 1200, 2500];
  for (let attempt = 0; ; attempt += 1) {
    let response: Response;
    let payload: {success?: boolean; message?: string; data?: unknown};
    try {
      response = await fetch(url, init);
      payload = await response.json().catch(() => ({}));
    } catch (error) {
      if (!isRetryableRequestError(error) || attempt >= retryDelays.length) throw error;
      await waitForRetry(retryDelays[attempt], signal);
      continue;
    }
    if (response.ok && payload.success) return payload;
    const error = Object.assign(
      new Error(payload.message || `图集列表加载失败（${response.status}）`),
      {status: response.status},
    );
    if (!isRetryableRequestError(error) || attempt >= retryDelays.length) throw error;
    await waitForRetry(retryDelays[attempt], signal);
  }
}

export default function PixivRanking() {
  const {authenticated: adminAuthenticated, loading: adminSessionLoading} = useAdminSession();
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
  const [previewSeed, setPreviewSeed] = useState<PreviewSeed | null>(null);
  const [detailHistory, setDetailHistory] = useState<PreviewSeed[]>([]);
  const [detail, setDetail] = useState<ArtworkDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState<Set<number>>(new Set());
  const [bookmarkRemoving, setBookmarkRemoving] = useState<Set<number>>(new Set());
  const [bookmarkError, setBookmarkError] = useState<string | null>(null);
  const [bookmarkOverrides, setBookmarkOverrides] = useState<Record<number, boolean>>({});
  const [galleryAlbums, setGalleryAlbums] = useState<Array<{id: string; title: string}>>([]);
  const [galleryExisting, setGalleryExisting] = useState<Set<number>>(new Set());
  const [galleryAlbumId, setGalleryAlbumId] = useState('');
  const [galleryBusy, setGalleryBusy] = useState<Set<number>>(new Set());
  const [galleryQueued, setGalleryQueued] = useState<Set<number>>(new Set());
  const [galleryToast, setGalleryToast] = useState<{kind: 'success' | 'error'; text: string} | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x: 0, y: 0});
  const [dragging, setDragging] = useState(false);
  const [previewImage, setPreviewImage] = useState<HTMLCanvasElement | null>(null);
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
  const previewImageSourceRef = useRef('');
  const pointerDragRef = useRef<{pointerId: number; startX: number; startY: number; panX: number; panY: number} | null>(null);
  const galleryQueueRef = useRef<Array<{id: number; title: string}>>([]);
  const galleryActiveRef = useRef(0);
  const pendingScrollRestoreRef = useRef<number | null>(null);
  const bookmarkHiddenRef = useRef<Set<number>>(new Set());

  const fetchRanking = useCallback(async (targetMode: string, pageParam: number | string = 0, append = false, noCache = false) => {
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
      const isPersonalized = PERSONAL_MODES.has(targetMode);
      const pageUrl = isPersonalized
        ? `${LIST_API_URL}?type=${encodeURIComponent(targetMode)}${typeof pageParam === 'string' && pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`
        : `${API_URL}?mode=${encodeURIComponent(targetMode)}&offset=${typeof pageParam === 'number' ? pageParam : 0}`;
      const payload = await fetchPixivPayload(pageUrl, {
        signal: controller.signal,
        cache: noCache ? 'no-store' : 'default',
        headers: noCache ? {'cache-control': 'no-cache'} : {},
      });
      const responsePage = payload.data as PixivRankingData;
      const rankBase = typeof pageParam === 'number' ? pageParam : 0;
      const pageData = {
        ...responsePage,
        illusts: responsePage.illusts.map((item, index) => RANKING_MODES.has(targetMode)
          ? {...item, rank: rankBase + index + 1}
          : item),
      };
      if (!append && !pageData.illusts.some((item) => item.thumb)) setSpeedTesting(false);
      setData((current) => {
        if (!append) return pageData;
        const seen = new Set(current.illusts.map((item) => item.id));
        return {...pageData, illusts: [...current.illusts, ...pageData.illusts.filter((item) => !seen.has(item.id) && !bookmarkHiddenRef.current.has(item.id))]};
      });
    } catch (caught) {
      if (isAbortError(caught)) return;
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
    bookmarkHiddenRef.current = new Set();
    void fetchRanking(mode);
    return () => abortRef.current?.abort();
  }, [mode, fetchRanking]);

  useEffect(() => {
    if (!adminSessionLoading && !adminAuthenticated && PERSONAL_MODES.has(mode)) setMode('day');
  }, [adminAuthenticated, adminSessionLoading, mode]);

  useEffect(() => {
    if (!adminAuthenticated) {
      setBookmarkOverrides({});
      return;
    }
    try {
      const saved = JSON.parse(window.localStorage.getItem('pixiv-bookmark-overrides') || 'null');
      if (!saved || Date.now() - saved.savedAt > 24 * 60 * 60 * 1000 || typeof saved.values !== 'object') return;
      const values: Record<number, boolean> = {};
      for (const [id, value] of Object.entries(saved.values)) {
        if (/^\d+$/.test(id) && typeof value === 'boolean') values[Number(id)] = value;
      }
      setBookmarkOverrides(values);
    } catch {
      setBookmarkOverrides({});
    }
  }, [adminAuthenticated]);

  useEffect(() => {
    if (!adminAuthenticated || adminSessionLoading) return undefined;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(GALLERY_API_URL, {credentials: 'same-origin', headers: {accept: 'application/json'}, signal: controller.signal});
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.message || '图集列表读取失败。');
        const rawAlbums: Array<{id: string; title: string; items?: Array<{id?: string | number; pixivId?: string | number}>}> = payload.data?.albums || [];
        const existing = new Set<number>();
        for (const entry of rawAlbums) {
          for (const candidate of entry.items || []) {
            const value = Number(String(candidate.pixivId || candidate.id || '').replace(/[^0-9]/g, ''));
            if (Number.isInteger(value) && value > 0) existing.add(value);
          }
        }
        const albums = rawAlbums.map((entry) => ({id: entry.id, title: entry.title}));
        setGalleryAlbums(albums);
        setGalleryExisting(existing);
        setGalleryAlbumId((current) => albums.some((entry) => entry.id === current) ? current : albums[0]?.id || '');
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === 'AbortError')) {
          setGalleryToast({kind: 'error', text: caught instanceof Error ? caught.message : '图集列表读取失败。'});
        }
      }
    })();
    return () => controller.abort();
  }, [adminAuthenticated, adminSessionLoading]);

  useEffect(() => {
    if (!galleryToast) return undefined;
    const timer = window.setTimeout(() => setGalleryToast(null), galleryToast.kind === 'success' ? 3200 : 5200);
    return () => window.clearTimeout(timer);
  }, [galleryToast]);

  useEffect(() => {
    const node = sentinelRef.current;
    const nextPage = PERSONAL_MODES.has(mode) ? data.nextCursor : data.nextOffset;
    if (!node || nextPage === null || loading || loadingMore || error) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void fetchRanking(mode, nextPage!, true);
      }
    }, {rootMargin: '700px 0px'});
    observer.observe(node);
    return () => observer.disconnect();
  }, [data.nextCursor, data.nextOffset, error, fetchRanking, loading, loadingMore, mode]);

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
    if (pendingScrollRestoreRef.current === null) return undefined;
    const target = pendingScrollRestoreRef.current;
    pendingScrollRestoreRef.current = null;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => window.scrollTo(0, target));
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [data.illusts.length]);

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
      if (isAbortError(caught)) return;
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
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedId(null);
        setPreviewSeed(null);
        setDetailHistory([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    modalScrollRef.current?.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.scrollTo(0, scrollY);
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
    previewImageSourceRef.current = '';
  }, [selectedId, pageIndex]);

  useEffect(() => {
    const image = previewImage;
    const viewport = viewerViewportRef.current;
    const canvas = previewCanvasRef.current;
    if (!image || !viewport || !canvas || image.width === 0 || image.height === 0) return undefined;

    const drawPreview = () => {
      const pixelScale = Math.min(
        1,
        4096 / image.width,
        4096 / image.height,
        Math.sqrt(12_000_000 / (image.width * image.height)),
      );
      const pixelWidth = Math.max(1, Math.round(image.width * pixelScale));
      const pixelHeight = Math.max(1, Math.round(image.height * pixelScale));
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

  const toggleBookmark = async (id: number, currentlyBookmarked: boolean) => {
    if (!adminAuthenticated || bookmarkBusy.has(id)) return;
    setBookmarkError(null);
    setBookmarkBusy((current) => new Set(current).add(id));
    try {
      const response = await fetch(BOOKMARK_API_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'content-type': 'application/json', accept: 'application/json'},
        body: JSON.stringify({id, action: currentlyBookmarked ? 'remove' : 'add'}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.message || '收藏操作失败。');
      const isBookmarked = Boolean(payload.data?.isBookmarked);
      setBookmarkOverrides((current) => {
        const values = {...current, [id]: isBookmarked};
        try {
          window.localStorage.setItem('pixiv-bookmark-overrides', JSON.stringify({savedAt: Date.now(), values}));
        } catch {
          // The current page state still updates if storage is unavailable.
        }
        return values;
      });
      if (mode === 'bookmarks' && currentlyBookmarked) {
        pendingScrollRestoreRef.current = window.scrollY;
        bookmarkHiddenRef.current.add(id);
        setBookmarkRemoving((current) => new Set(current).add(id));
        const nextCursor = data.nextCursor;
        window.setTimeout(() => {
          setData((current) => ({
            ...current,
            illusts: current.illusts.filter((item) => item.id !== id),
          }));
          setBookmarkRemoving((current) => {
            const next = new Set(current);
            next.delete(id);
            return next;
          });
          if (nextCursor !== null) void fetchRanking('bookmarks', nextCursor, true);
        }, 240);
      } else {
        setData((current) => ({
          ...current,
          illusts: current.illusts.map((item) => item.id === id ? {...item, isBookmarked} : item),
        }));
      }
      setDetail((current) => current ? {
        ...current,
        illust: current.illust.id === id ? {...current.illust, is_bookmarked: isBookmarked} : current.illust,
        related: current.related.map((item) => item.id === id ? {...item, isBookmarked} : item),
      } : current);
    } catch (caught) {
      setBookmarkError(caught instanceof Error ? caught.message : '收藏操作失败。');
    } finally {
      setBookmarkBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const GALLERY_MAX_PARALLEL = 3;

  async function runGalleryJob(job: {id: number; title: string}) {
    const {id, title} = job;
    setGalleryQueued((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    setGalleryBusy((current) => new Set(current).add(id));
    try {
      const response = await fetch(GALLERY_IMPORT_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'content-type': 'application/json', accept: 'application/json'},
        body: JSON.stringify({pixivId: String(id), albumId: galleryAlbumId}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.message || '导入图集失败。');
      const albumTitle = payload.data?.albumTitle || '图集';
      const itemTitle = payload.data?.item?.title || title || '作品';
      setGalleryExisting((current) => new Set(current).add(id));
      setGalleryToast({kind: 'success', text: `已把「${itemTitle}」加入「${albumTitle}」`});
    } catch (caught) {
      setGalleryToast({kind: 'error', text: caught instanceof Error ? caught.message : '导入图集失败。'});
    } finally {
      setGalleryBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      galleryActiveRef.current = Math.max(0, galleryActiveRef.current - 1);
      pumpGalleryQueue();
    }
  }

  function pumpGalleryQueue() {
    while (galleryActiveRef.current < GALLERY_MAX_PARALLEL && galleryQueueRef.current.length) {
      const job = galleryQueueRef.current.shift();
      if (!job) break;
      galleryActiveRef.current += 1;
      void runGalleryJob(job);
    }
  }

  const addToGallery = (id: number, title: string) => {
    if (!adminAuthenticated || galleryBusy.has(id) || galleryQueued.has(id) || galleryExisting.has(id)) return;
    if (!galleryAlbumId) {
      setGalleryToast({kind: 'error', text: '请先选择要导入的图集。'});
      return;
    }
    setGalleryToast(null);
    galleryQueueRef.current.push({id, title});
    setGalleryQueued((current) => new Set(current).add(id));
    pumpGalleryQueue();
  };

  const openArtwork = (seed: PreviewSeed, fromRelated = false) => {
    setDetailHistory((history) => fromRelated && previewSeed ? [...history, previewSeed] : []);
    setPreviewSeed(seed);
    setSelectedId(seed.id);
  };

  const goBackDetail = () => {
    const previousSeed = detailHistory[detailHistory.length - 1];
    if (!previousSeed) return;
    setDetailHistory((history) => history.slice(0, -1));
    setPreviewSeed(previousSeed);
    setSelectedId(previousSeed.id);
  };

  const closeDetail = () => {
    setDetailHistory([]);
    setPreviewSeed(null);
    setSelectedId(null);
  };

  const items = data.illusts || [];
  const isRankingMode = RANKING_MODES.has(mode);
  const nextPage = PERSONAL_MODES.has(mode) ? data.nextCursor : data.nextOffset;
  const banner = items.find((item) => item.thumb)?.thumb;
  const dateLabel = data.date ? formatDate(data.date) : '';
  const currentDetail = detail?.illust.id === selectedId ? detail.illust : undefined;
  const currentSeed = previewSeed?.id === selectedId ? previewSeed : null;
  const selectedItem = selectedId === null ? undefined : items.find((item) => item.id === selectedId);
  const artwork: Artwork | undefined = currentDetail || (currentSeed ? {
    id: currentSeed.id,
    title: currentSeed.title,
    user: {name: currentSeed.author},
    tags: currentSeed.tags.map((name) => ({name})),
    image_urls: {large: currentSeed.thumb},
    is_bookmarked: currentSeed.isBookmarked,
  } : undefined);
  const pageCount = Math.max(1, currentDetail?.page_count || currentDetail?.meta_pages?.length || 1);
  const pageOriginal = currentDetail ? originalPage(currentDetail, pageIndex) : '';
  const pageDisplay = currentDetail ? displayPage(currentDetail, pageIndex) : currentSeed?.thumb || '';
  const detailBookmarked = artwork ? bookmarkOverrides[artwork.id] ?? Boolean(artwork.is_bookmarked ?? selectedItem?.isBookmarked) : false;
  const relatedItems = currentDetail ? detail?.related || [] : [];
  const isBookmarked = (id: number, fallback?: boolean) => bookmarkOverrides[id] ?? Boolean(fallback);
  const filename = `${(artwork?.title || 'pixiv-artwork').replace(/[\\/:*?"<>|]/g, '_')}_p${pageIndex + 1}${imageExtension(pageOriginal)}`;

  const snapshotPreviewImage = useCallback((image: HTMLImageElement, source = image.currentSrc || image.src) => {
    if (!image.complete || !image.naturalWidth || !image.naturalHeight || !source || source === previewImageSourceRef.current) return;
    const pixelScale = Math.min(
      1,
      4096 / image.naturalWidth,
      4096 / image.naturalHeight,
      Math.sqrt(12_000_000 / (image.naturalWidth * image.naturalHeight)),
    );
    const snapshot = document.createElement('canvas');
    snapshot.width = Math.max(1, Math.round(image.naturalWidth * pixelScale));
    snapshot.height = Math.max(1, Math.round(image.naturalHeight * pixelScale));
    const context = snapshot.getContext('2d');
    if (!context) return;
    try {
      context.drawImage(image, 0, 0, snapshot.width, snapshot.height);
      previewImageSourceRef.current = source;
      setPreviewImage(snapshot);
    } catch {
      // Keep the last successfully drawn preview visible while a new source loads.
    }
  }, []);

  useEffect(() => {
    const viewport = viewerViewportRef.current;
    if (!pageDisplay || speedTesting || previewImage || !viewport) return undefined;
    const captureLoadedImage = () => {
      const image = viewport.querySelector<HTMLImageElement>(`.${styles.detailSourceImage}`);
      const source = image?.currentSrc || image?.src || '';
      if (image?.complete && image.naturalWidth > 0 && source) snapshotPreviewImage(image, source);
    };
    captureLoadedImage();
    const timer = window.setInterval(captureLoadedImage, 120);
    return () => window.clearInterval(timer);
  }, [pageDisplay, previewImage, snapshotPreviewImage, speedTesting]);

  useEffect(() => {
    const preferred = readMirrorPreference();
    setMirror(preferred);
  }, []);

  useEffect(() => {
    const viewport = viewerViewportRef.current;
    if (!viewport || !pageDisplay) return undefined;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
      setZoom((current) => Math.min(5, Math.max(1, current * factor)));
    };
    viewport.addEventListener('wheel', onWheel, {passive: false});
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [pageDisplay, selectedId]);

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

  const handlePreviewImageLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    const image = event.currentTarget;
    const source = image.currentSrc || image.src;
    snapshotPreviewImage(image, source);
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
        <header
          className={styles.hero}
          style={banner && bannerLoaded
            ? {'--hero-image': `url("${imageUrlOnMirror(banner, mirror)}")`} as React.CSSProperties
            : undefined}
        >
          <button className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? '刷新中…' : '刷新'}
          </button>
          <h1 className={styles.heroTitle}>Pixiv 美图榜</h1>
          <p className={styles.heroSub}>
            {loading ? '正在加载图集…' : isRankingMode ? dateLabel ? `正在查看 ${dateLabel} 榜单` : '暂无榜单数据' : mode === 'recommended' ? '为当前账户推荐的图集' : '当前账户收藏的图集'}
          </p>
          <nav className={styles.tabs} aria-label="榜单类型">
            {MODES.filter((entry) => !PERSONAL_MODES.has(entry.key) || (adminAuthenticated && !adminSessionLoading)).map((entry) => (
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
          {adminAuthenticated && !adminSessionLoading && (
            <div className={styles.importControl} role="group" aria-label="导入到图集" title="选择目标图集后，点作品上的「+」即可后端下载原图与信息并入库。">
              <svg className={styles.importIcon} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9.5m0 0 3.4-3.4M12 12.5 8.6 9.1" /><path d="M5 15.5v3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-3" /></svg>
              <span className={styles.importLabel}>导入到图集</span>
              {galleryAlbums.length ? (
                <span className={styles.importSelectWrap}>
                  <select className={styles.importSelect} value={galleryAlbumId} onChange={(event) => setGalleryAlbumId(event.target.value)} aria-label="选择要导入的图集">
                    {galleryAlbums.map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}
                  </select>
                  <svg className={styles.importChevron} viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </span>
              ) : <span className={styles.importEmpty}>暂无图集</span>}
            </div>
          )}
        </header>

        {error && <p className={styles.tip} role="status">提示：{error}</p>}
        {bookmarkError && <p className={styles.tip} role="status">提示：{bookmarkError}</p>}

        {items.length === 0 && !loading ? (
          <p className={styles.empty}>暂无数据。</p>
        ) : (
          <>
            <div className={styles.waterfall} ref={gridRef}>
              {items.map((item: PixivItem, index) => {
                const bookmarked = isBookmarked(item.id, item.isBookmarked);
                return (
                  <article key={item.id} className={clsx(styles.card, bookmarkRemoving.has(item.id) && styles.cardRemoving)}>
                  <div className={styles.coverWrap}>
                    <button type="button" className={styles.cover} onClick={() => openArtwork({id: item.id, title: item.title, author: item.author, thumb: item.thumb, tags: item.tags, isBookmarked: bookmarked})} aria-label={`查看作品：${item.title}`}>
                      {isRankingMode && item.rank > 0 && <span className={clsx(styles.rankBadge, rankClass(item.rank))}>#{item.rank}</span>}
                      {item.thumb ? speedTesting
                        ? <span className={styles.imagePlaceholder} aria-hidden="true" />
                        : <PixivImage src={item.thumb} preferredMirror={mirror} priority={item.rank || 500 + index} placeholderClassName={styles.imagePlaceholder} onMirrorFailure={handleMirrorFailure} onLoad={(isRankingMode ? item.rank === 1 : index === 0) ? () => setBannerLoaded(true) : undefined} alt={item.title} />
                        : <span className={styles.coverFallback}>无缩略图</span>}
                    </button>
                    {adminAuthenticated && !adminSessionLoading && (
                      <button
                        type="button"
                        className={clsx(styles.favoriteButton, bookmarked && styles.favoriteActive)}
                        aria-label={bookmarked ? '取消收藏' : '收藏图集'}
                        aria-pressed={bookmarked}
                        disabled={bookmarkBusy.has(item.id) || bookmarkRemoving.has(item.id)}
                        onClick={() => void toggleBookmark(item.id, bookmarked)}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
                      </button>
                    )}
                    {adminAuthenticated && !adminSessionLoading && (
                      <button
                        type="button"
                        className={clsx(styles.galleryAddButton, galleryExisting.has(item.id) && styles.galleryAddButtonDone, (galleryBusy.has(item.id) || galleryQueued.has(item.id)) && styles.galleryAddButtonBusy, galleryQueued.has(item.id) && styles.galleryAddButtonQueued)}
                        aria-label={galleryQueued.has(item.id) ? '排队中' : galleryBusy.has(item.id) ? '正在加入' : galleryExisting.has(item.id) ? '已在图集' : '加入图集'}
                        title={galleryQueued.has(item.id) ? '排队中' : galleryExisting.has(item.id) ? '已在图集' : '加入图集'}
                        aria-busy={galleryBusy.has(item.id) || galleryQueued.has(item.id)}
                        disabled={galleryBusy.has(item.id) || galleryQueued.has(item.id) || galleryExisting.has(item.id)}
                        onClick={() => addToGallery(item.id, item.title)}
                      >
                        {galleryBusy.has(item.id) || galleryQueued.has(item.id)
                          ? <span className={styles.gallerySpinner} aria-hidden="true" />
                          : galleryExisting.has(item.id)
                            ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>}
                      </button>
                    )}
                  </div>
                  <div className={styles.info}>
                    <button type="button" className={styles.cardTitle} onClick={() => openArtwork({id: item.id, title: item.title, author: item.author, thumb: item.thumb, tags: item.tags, isBookmarked: bookmarked})}>{item.title || '无题'}</button>
                    <div className={styles.cardAuthor}>By: {item.author}</div>
                  </div>
                  </article>
                );
              })}
            </div>
            <div className={styles.loadStatus} ref={sentinelRef} aria-live="polite">
              {loadingMore ? '正在加载更多作品…' : nextPage !== null ? '继续向下滚动以加载更多' : items.length ? '已经到底了' : loading ? '正在加载图集…' : ''}
            </div>
          </>
        )}
      </div>
      <BackToTopButton />

      {galleryToast && (
        <div
          className={clsx(styles.galleryToast, galleryToast.kind === 'error' ? styles.galleryToastError : styles.galleryToastSuccess)}
          role="status"
          aria-live="polite"
        >
          {galleryToast.kind === 'error'
            ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8v5m0 3.5v.01" /><circle cx="12" cy="12" r="9" /></svg>
            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" /></svg>}
          <span>{galleryToast.text}</span>
        </div>
      )}

      {selectedId !== null && (
        <div className={styles.modalBackdrop} onMouseDown={(event) => {if (event.target === event.currentTarget) closeDetail();}}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-label="作品详情">
            {detailHistory.length > 0 && <button type="button" className={styles.modalBack} onClick={goBackDetail}>← 返回上一张</button>}
            <button type="button" className={styles.modalClose} onClick={closeDetail} aria-label="关闭详情">×</button>
            <div className={styles.modalScroll} ref={modalScrollRef}>
              {detailLoading && <div className={styles.modalMessage}>正在加载作品详情…</div>}
              {detailError && <div className={styles.modalMessage}>{detailError}</div>}
              {artwork && (
                <>
                  <div className={styles.detailLayout}>
                    <div className={styles.detailImagePanel}>
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
                      <div className={styles.detailActions}>
                        {currentDetail && pageOriginal && (
                          <a className={styles.downloadButton} href={imageProxy(pageOriginal, filename, mirror)}>
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10.5m0 0 3.6-3.6m-3.6 3.6-3.6-3.6" /><path d="M5 16.5v2A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-2" /></svg>
                            下载原图
                          </a>
                        )}
                        {adminAuthenticated && !adminSessionLoading && (
                          <button
                            type="button"
                            className={clsx(styles.detailGalleryButton, galleryExisting.has(artwork.id) && styles.detailGalleryButtonDone, (galleryBusy.has(artwork.id) || galleryQueued.has(artwork.id)) && styles.detailGalleryButtonBusy)}
                            disabled={galleryBusy.has(artwork.id) || galleryQueued.has(artwork.id) || galleryExisting.has(artwork.id)}
                            aria-busy={galleryBusy.has(artwork.id) || galleryQueued.has(artwork.id)}
                            onClick={() => addToGallery(artwork.id, artwork.title)}
                          >
                            {galleryBusy.has(artwork.id) || galleryQueued.has(artwork.id)
                              ? <span className={styles.gallerySpinner} aria-hidden="true" />
                              : galleryExisting.has(artwork.id)
                                ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7" /></svg>
                                : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>}
                            {galleryQueued.has(artwork.id) ? '排队中…' : galleryBusy.has(artwork.id) ? '添加中…' : galleryExisting.has(artwork.id) ? '已在图集' : '加入图集'}
                          </button>
                        )}
                        {adminAuthenticated && !adminSessionLoading && (
                          <button
                            type="button"
                            className={clsx(styles.detailFavoriteButton, detailBookmarked && styles.favoriteActive)}
                            aria-pressed={detailBookmarked}
                            disabled={bookmarkBusy.has(artwork.id)}
                            onClick={() => void toggleBookmark(artwork.id, detailBookmarked)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
                            {detailBookmarked ? '已收藏' : '收藏'}
                          </button>
                        )}
                      </div>
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
                    {relatedItems.length ? (
                      <div className={styles.relatedGrid}>
                        {relatedItems.map((related, index) => {
                          const bookmarked = isBookmarked(related.id, related.isBookmarked);
                          return (
                            <article className={styles.relatedCard} key={related.id}>
                              <div className={styles.relatedCoverWrap}>
                                <button type="button" className={clsx(styles.cover, styles.relatedCover)} onClick={() => openArtwork({id: related.id, title: related.title, author: related.author, thumb: related.thumb, tags: [], isBookmarked: bookmarked}, true)} aria-label={`查看作品：${related.title}`}>
                                  <PixivImage src={related.thumb} preferredMirror={mirror} priority={10000 + index} placeholderClassName={styles.imagePlaceholder} enabled={!speedTesting} onMirrorFailure={handleMirrorFailure} alt={related.title} />
                                </button>
                                {adminAuthenticated && !adminSessionLoading && (
                                  <button
                                    type="button"
                                    className={clsx(styles.favoriteButton, styles.relatedFavorite, bookmarked && styles.favoriteActive)}
                                    aria-label={bookmarked ? '取消收藏' : '收藏图集'}
                                    aria-pressed={bookmarked}
                                    disabled={bookmarkBusy.has(related.id)}
                                    onClick={() => void toggleBookmark(related.id, bookmarked)}
                                  >
                                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
                                  </button>
                                )}
                              </div>
                              <div className={styles.relatedInfo}>
                                <button type="button" className={styles.relatedTitle} onClick={() => openArtwork({id: related.id, title: related.title, author: related.author, thumb: related.thumb, tags: [], isBookmarked: bookmarked}, true)}>{related.title}</button>
                                <small>By: {related.author}</small>
                              </div>
                            </article>
                          );
                        })}
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
