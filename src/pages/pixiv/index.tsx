import React, {useCallback, useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import BackToTopButton from '@theme/BackToTopButton';
import {type PixivItem, type PixivRankingData, emptyRanking} from '@site/data/pixiv';
import styles from './pixiv.module.css';

const API_URL = '/api/pixiv-ranking';

const MODES = [
  {key: 'day', label: '日榜'},
  {key: 'week', label: '周榜'},
  {key: 'month', label: '月榜'},
  {key: 'week_rookie', label: '新人榜'},
  {key: 'week_original', label: '原创榜'},
];

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

function thumbSrc(url: string): string {
  return `/api/pixiv-thumb?u=${encodeURIComponent(url)}`;
}

export default function PixivRanking() {
  const [mode, setMode] = useState('day');
  const [data, setData] = useState<PixivRankingData>(emptyRanking);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchRanking = useCallback(async (targetMode: string, opts: {noCache?: boolean} = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    if (!opts.noCache) setLoading(true);
    try {
      const res = await fetch(`${API_URL}?mode=${encodeURIComponent(targetMode)}`, {
        signal: controller.signal,
        cache: opts.noCache ? 'no-store' : 'default',
        headers: opts.noCache ? {'cache-control': 'no-cache'} : {},
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        throw new Error(payload.message || `榜单加载失败（${res.status}）`);
      }
      setData(payload.data || emptyRanking);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : '榜单加载失败。');
      setData(emptyRanking);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchRanking(mode);
  }, [mode, fetchRanking]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchRanking(mode, {noCache: true});
  }, [fetchRanking, mode]);

  const items: PixivItem[] = data.illusts ?? [];
  const banner = items.find((item) => item.thumb)?.thumb;
  const dateLabel = data.date ? formatDate(data.date) : '';

  return (
    <Layout title="P站美图榜" description="Pixiv 插画榜单（原创页面）">
      <PageMetadata title="P站美图榜" description="Pixiv 插画榜单 · 数据来自站点自有接口" />
      <div className={styles.page}>
        <header className={styles.hero} style={banner ? {backgroundImage: `url("${thumbSrc(banner)}")`} : undefined}>
          <button className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? '刷新中…' : '刷新'}
          </button>
          <h1 className={styles.heroTitle}>Pixiv 美图榜</h1>
          <p className={styles.heroSub}>
            {loading ? '正在加载榜单…' : dateLabel ? `正在查看 ${dateLabel} 榜单` : '暂无榜单数据'}
          </p>
          <nav className={styles.tabs}>
            {MODES.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={clsx(styles.tab, mode === entry.key && styles.tabActive)}
                onClick={() => setMode(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
        </header>

        {error && <p className={styles.tip}>提示：{error}</p>}

        {items.length === 0 ? (
          <p className={styles.empty}>{loading ? '正在加载榜单…' : '暂无数据。'}</p>
        ) : (
          <div className={styles.waterfall}>
            {items.map((item) => (
              <article key={`${item.rank}-${item.url}`} className={styles.card}>
                <Link href={item.url} target="_blank" rel="noopener noreferrer" className={styles.cover}>
                  <span className={clsx(styles.rankBadge, rankClass(item.rank))}>#{item.rank}</span>
                  {item.thumb ? (
                    <img
                      src={thumbSrc(item.thumb)}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className={styles.coverFallback}>无缩略图</span>
                  )}
                </Link>
                <div className={styles.info}>
                  <Link href={item.url} target="_blank" rel="noopener noreferrer" className={styles.cardTitle}>
                    {item.title || '无题'}
                  </Link>
                  <div className={styles.cardAuthor}>
                    <span>By: </span>
                    <Link
                      href={`https://www.pixiv.net/users/${item.authorId}`}
                      target="_blank"
                      rel="noopener noreferrer">
                      {item.author}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <BackToTopButton />
    </Layout>
  );
}
