import React, {useCallback, useEffect, useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import {Icon} from '@iconify/react';

import MarkdownPreview from '@site/src/components/admin/MarkdownPreview';
import styles from './styles.module.css';

type ArticleSummary = {
  path: string;
  title: string;
  tags: string[];
  section: string;
  updatedAt: string | null;
};

type ApiResult<T> = {success: boolean; data: T; message?: string};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {credentials: 'same-origin', headers: {accept: 'application/json'}});
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) throw new Error(payload.message || `请求失败（${response.status}）`);
  return payload.data;
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', {year: 'numeric', month: '2-digit', day: '2-digit'});
}

function resolveRequestedPath(articles: ArticleSummary[], requested: string): string {
  const path = requested.replace(/^\/+|\/+$/g, '');
  if (!path) return '';
  const candidates = [path];
  if (!/\.(?:md|mdx)$/i.test(path)) {
    candidates.push(`${path}.md`, `${path}.mdx`, `${path}/index.md`, `${path}/index.mdx`);
  }
  return candidates.find((candidate) => articles.some((article) => article.path === candidate)) || '';
}

export default function NotesPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [content, setContent] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const data = await fetchJson<{articles: ArticleSummary[]}>('/api/content/list');
      setArticles(data.articles);
      const requested = new URLSearchParams(window.location.search).get('path') || '';
      const target = resolveRequestedPath(data.articles, requested) || data.articles[0]?.path || '';
      setSelected((current) => current || target);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '文章列表暂时无法读取。');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingArticle(true);
    setError('');
    fetchJson<{path: string; content: string}>(
      `/api/content/file?path=${encodeURIComponent(selected)}`,
    )
      .then((data) => {
        if (cancelled) return;
        setContent(data.content);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : '文章暂时无法读取。');
      })
      .finally(() => {
        if (!cancelled) setLoadingArticle(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const openArticle = (path: string) => {
    setSelected(path);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('path', path);
      window.history.replaceState(null, '', url.toString());
    }
  };

  const sections = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase();
    const visible = needle
      ? articles.filter((article) =>
          `${article.title} ${article.path} ${article.tags.join(' ')}`.toLocaleLowerCase().includes(needle))
      : articles;
    const map = new Map<string, ArticleSummary[]>();
    for (const article of visible) {
      const list = map.get(article.section) || [];
      list.push(article);
      map.set(article.section, list);
    }
    return [...map.entries()].sort((left, right) => left[0].localeCompare(right[0], 'zh-CN'));
  }, [articles, filter]);

  const current = articles.find((article) => article.path === selected) || null;

  return (
    <Layout title="文章" description="站内文章，由 Netlify Blob 运行时提供。">
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>RUNTIME ARTICLES</span>
            <h1>文章</h1>
            <p>内容由 Netlify Blob 提供，后台保存后无需重新部署即可生效。</p>
          </div>
          <button type="button" className={styles.refreshButton} onClick={() => void loadList()}>
            <Icon icon="lucide:refresh-cw" />
            刷新
          </button>
        </header>

        {error ? (
          <div className={styles.errorBanner}>
            <Icon icon="lucide:circle-alert" />
            {error}
          </div>
        ) : null}

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <label className={styles.searchBox}>
              <Icon icon="lucide:search" />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索文章" />
            </label>
            {loadingList ? (
              <div className={styles.emptyState}><Icon icon="lucide:loader-circle" />正在加载文章…</div>
            ) : sections.length ? (
              <nav className={styles.sectionList}>
                {sections.map(([section, items]) => (
                  <div key={section} className={styles.sectionGroup}>
                    <span className={styles.sectionName}>{section || '根目录'}</span>
                    {items.map((article) => (
                      <button
                        type="button"
                        key={article.path}
                        className={article.path === selected ? styles.articleActive : styles.articleButton}
                        onClick={() => openArticle(article.path)}>
                        <Icon icon="lucide:file-text" />
                        <span>{article.title}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            ) : (
              <div className={styles.emptyState}>暂无文章。</div>
            )}
          </aside>

          <article className={styles.article}>
            {loadingArticle ? (
              <div className={styles.emptyState}><Icon icon="lucide:loader-circle" />正在加载…</div>
            ) : current ? (
              <>
                <h1 className={styles.articleTitle}>{current.title}</h1>
                <div className={styles.articleMeta}>
                  <span>{current.path}</span>
                  {current.tags.length ? <span className={styles.tags}>{current.tags.map((tag) => <em key={tag}>{tag}</em>)}</span> : null}
                  {formatDate(current.updatedAt) ? <span>更新于 {formatDate(current.updatedAt)}</span> : null}
                </div>
                <MarkdownPreview source={content} />
              </>
            ) : (
              <div className={styles.emptyState}>从左侧选择一篇文章。</div>
            )}
          </article>
        </div>
      </main>
    </Layout>
  );
}
