import React, {useCallback, useEffect, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import {PageMetadata} from '@docusaurus/theme-common';
import Layout from '@theme/Layout';
import BackToTopButton from '@theme/BackToTopButton';
import {type PixivItem, type PixivRankingData, emptyRanking} from '@site/data/pixiv';
import styles from './pixiv.module.css';

const API_URL = '/api/pixiv-ranking';

export default function PixivRanking() {
  const [data, setData] = useState<PixivRankingData>(emptyRanking);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRanking = useCallback(async (opts: {noCache?: boolean}) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL, {
        cache: opts.noCache ? 'no-store' : 'default',
        headers: opts.noCache ? {'cache-control': 'no-cache'} : {},
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.success) {
        throw new Error(payload.message || `榜单加载失败（${res.status}）`);
      }
      setData(payload.data || emptyRanking);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '榜单加载失败。';
      setError(message);
      // 服务端未配置凭据或临时故障时，展示空占位而不中断站点。
      setData(emptyRanking);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchRanking({noCache: true});
  }, [fetchRanking]);

  useEffect(() => {
    void fetchRanking({noCache: false});
    // 页面打开后若数据陈旧，轻量尝试刷新一次（由服务端 30 分钟缓存保护，不会频繁打扰 Pixiv）。
    const t = setTimeout(() => void fetchRanking({noCache: false}), 2000);
    return () => clearTimeout(t);
  }, [fetchRanking]);

  const updatedAt = data.date || '未知';
  const items: PixivItem[] = data.illusts ?? [];

  return (
    <Layout title="P站美图榜" description="Pixiv 插画实时榜单（原创页面）">
      <PageMetadata title="P站美图榜" description="Pixiv 插画榜单 · 原创页面，数据来自站点自有接口" />
      <div className={clsx(styles.container, 'margin-vert--lg')}>
        <header className={styles.header}>
          <h1>P站美图榜</h1>
          <p className={styles.subtitle}>
            Pixiv 插画榜单 · 仅供个人学习演示 · 请遵守 Pixiv 服务条款
          </p>
          <div className={styles.actions}>
            <span className={clsx(styles.badge, refreshing && styles.refreshing)}>
              {refreshing ? '刷新中…' : `榜单日期：${updatedAt}`}
            </span>
            <button className={styles.refreshBtn} onClick={handleRefresh} disabled={refreshing || loading}>
              {refreshing ? '…' : '刷新'}
            </button>
            {error && (
              <span className={styles.tip}>提示：{error}</span>
            )}
          </div>
        </header>

        <section className={styles.list}>
          {items.length === 0 ? (
            <p className={styles.empty}>
              暂无数据。生产环境请在 Netlify 后台设置 <code>PIXIV_CLIENT_ID</code> 与
              <code>PIXIV_REFRESH_TOKEN</code>，并部署 <code>/api/pixiv-ranking</code> 函数。
            </p>
          ) : (
            <ol className={styles.ranking}>
              {items.map((item) => (
                <li key={item.authorId + item.title} className={styles.item}>
                  <span className={styles.rank}>{item.rank}</span>
                  <div className={styles.body}>
                    {item.thumb ? (
                      <img src={item.thumb} alt={item.title} className={styles.thumb} />
                    ) : (
                      <div className={clsx(styles.thumb, styles.thumbPlaceholder)}>无缩略图</div>
                    )}
                    <div className={styles.meta}>
                      <Link href={item.url} target="_blank" rel="noopener noreferrer" className={styles.title}>
                        {item.title}
                      </Link>
                      <div className={styles.author}>
                        <span>作者：</span>
                        <Link href={`https://www.pixiv.net/users/${item.authorId}`} target="_blank" rel="noopener noreferrer">
                          {item.author}
                        </Link>
                      </div>
                      <div className={styles.tags}>
                        {item.tags.map((tag) => (
                          <span key={tag} className={styles.tag}>#{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className={styles.note}>
          <strong>说明：</strong>
          <ul>
            <li>本页为原创页面，未从第三方站点抓取任何内容。</li>
            <li>Pixiv 对跨域请求有限制，榜单由站点自有服务端（Netlify 函数）代理并缓存 30 分钟。</li>
            <li>使用 Pixiv 官方 API 前请先阅读并遵守其服务条款与机器人协议。</li>
          </ul>
        </aside>
      </div>
      <BackToTopButton />
    </Layout>
  );
}
