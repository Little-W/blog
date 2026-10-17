import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import BackToTopButton from '@theme/BackToTopButton';
import {type PixivItem, type PixivRankingData, emptyRanking} from '@site/data/pixiv';
import PixivImage from './PixivImage';
import {IMAGE_MIRRORS, MAX_IMAGE_CONCURRENCY, imageUrlOnMirror, measureFastestMirror, readMirrorPreference, saveMirrorPreference, type ImageMirror} from './image-mirrors';
import styles from './pixiv.module.css';

const API_URL = '/api/pixiv-ranking';
const DETAIL_URL = '/api/pixiv-detail';
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
    || illust.meta_pages?.[page]?.image_urls?.original
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
  const [pageIndex, setPageIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);
  const loadMoreLock = useRef(false);
  const speedProbeStarted = useRef(false);
  const failedMirrors = useRef<Set<ImageMirror>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const modalScrollRef = useRef<HTMLDivElement | null>(null);

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
    const arrangeRows = () => {
      const styles = getComputedStyle(grid);
      const columns = Math.max(1, styles.gridTemplateColumns.split(' ').length);
      const rowHeight = Number.parseFloat(styles.gridAutoRows) || 8;
      const rowGap = Number.parseFloat(styles.rowGap) || 14;
      const cards = [...grid.querySelectorAll<HTMLElement>(':scope > article')];
      let rowStart = 1;

      for (let index = 0; index < cards.length; index += columns) {
        const row = cards.slice(index, index + columns);
        const spans = row.map((card) => Math.max(1, Math.ceil((card.getBoundingClientRect().height + rowGap) / (rowHeight + rowGap))));
        row.forEach((card, column) => {
          card.style.gridColumnStart = String(column + 1);
          card.style.gridRowStart = String(rowStart);
          card.style.gridRowEnd = `span ${spans[column]}`;
        });
        rowStart += Math.max(...spans);
      }
    };
    const scheduleArrange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(arrangeRows);
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
    if (selectedId === null) {
      detailAbortRef.current?.abort();
      setDetail(null);
      return undefined;
    }
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setPageIndex(0);
    void (async () => {
      try {
        const response = await fetch(`${DETAIL_URL}?id=${selectedId}`, {signal: controller.signal});
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) throw new Error(payload.message || '作品详情加载失败。');
        setDetail(payload.data as ArtworkDetail);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setDetailError(caught instanceof Error ? caught.message : '作品详情加载失败。');
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    })();
    return () => controller.abort();
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
          <p className={styles.mirrorStatus} aria-live="polite">
            {speedTesting ? '正在测速图床镜像…' : `图片线路：${mirror} · 最多 ${MAX_IMAGE_CONCURRENCY} 张同时加载`}
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
                    <div className={styles.detailImagePanel}>
                      {pageDisplay && <PixivImage className={styles.detailImage} placeholderClassName={styles.detailImagePlaceholder} src={pageDisplay} preferredMirror={mirror} priority={0} enabled={!speedTesting} onMirrorFailure={handleMirrorFailure} alt={artwork.title} />}
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
                    ) : <p className={styles.modalMessage}>暂时没有相似推荐。</p>}
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
