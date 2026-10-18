import React, {useEffect, useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import {Icon} from '@iconify/react';

import styles from './styles.module.css';

type ArticleSummary = {
  path: string;
  title: string;
  tags: string[];
  section: string;
  updatedAt?: string | null;
};

type ArticlePreview = ArticleSummary & {excerpt: string};

function articleRoute(path: string): string {
  const route = path.replace(/^docs\//i, '').replace(/\.mdx?$/i, '').split('/');
  return `/docs/${route.map((part) => encodeURIComponent(part)).join('/')}`;
}

function excerptFromMarkdown(source: string): string {
  const body = String(source || '')
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/^\s*```[\s\S]*?^\s*```\s*$/gm, '')
    .replace(/<!-- gallery-items[\s\S]*?-->/g, '')
    .split(/\r?\n\s*\r?\n/)
    .map((paragraph) => paragraph.trim())
    .find((paragraph) => paragraph && !/^#{1,6}\s/.test(paragraph) && !/^\|/.test(paragraph) && !/^</.test(paragraph)) || '';
  return body
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[`*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

export default function HomeArticleRecommendations(): JSX.Element {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [previews, setPreviews] = useState<ArticlePreview[]>([]);
  const [preview, setPreview] = useState<ArticlePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/content/list', {
      credentials: 'same-origin',
      headers: {accept: 'application/json'},
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success || !Array.isArray(payload.data?.articles)) {
        throw new Error(payload.message || `文章列表读取失败（${response.status}）`);
      }
      if (!controller.signal.aborted) setArticles(payload.data.articles);
    }).catch(() => {
      if (!controller.signal.aborted) setArticles([]);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, []);

  const selectedArticles = useMemo(() => {
    const available = articles.filter((article) => {
      const filename = article.path.split('/').pop()?.toLowerCase() || '';
      return /^docs\//i.test(article.path)
        && !/^docs\/gallery(?:\/|$)/i.test(article.path)
        && !/^(?:index|readme)\.mdx?$/.test(filename);
    });
    const dateValue = (article: ArticleSummary) => new Date(article.updatedAt || 0).getTime() || 0;
    const ordered = available.slice().sort((left, right) => dateValue(right) - dateValue(left));
    const curated = ordered.filter((article) => article.tags.some((tag) => /^(?:首页|推荐|精选)$/u.test(tag)));
    const featured = curated.length ? [...curated, ...ordered.filter((article) => !curated.includes(article))] : ordered;
    return featured.slice(0, 6);
  }, [articles]);

  useEffect(() => {
    if (!selectedArticles.length) {
      setPreviews([]);
      setPreviewLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setPreviews([]);
    setPreviewLoading(true);
    void Promise.all(selectedArticles.map(async (article) => {
      try {
        const response = await fetch(`/api/content/file?path=${encodeURIComponent(article.path)}`, {
          credentials: 'same-origin',
          headers: {accept: 'application/json'},
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success || typeof payload.data?.content !== 'string') return {...article, excerpt: ''};
        return {...article, excerpt: excerptFromMarkdown(payload.data.content)};
      } catch {
        return {...article, excerpt: ''};
      }
    })).then((items) => {
      if (!controller.signal.aborted) {
        setPreviews(items.filter((item) => item.excerpt.trim()));
        setPreviewLoading(false);
      }
    });
    return () => controller.abort();
  }, [selectedArticles]);

  const cards = previews;
  if (!loading && !cards.length) return <section className={styles.section} aria-labelledby="home-article-recommendations" />;

  return (
    <section className={styles.section} aria-labelledby="home-article-recommendations">
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>READING PICKS</span>
          <h2 id="home-article-recommendations">推荐阅读</h2>
        </div>
        <Link to="/docs/notes/" className={styles.moreLink}>浏览文章库 <Icon icon="lucide:arrow-up-right" /></Link>
      </header>

      {(loading || previewLoading) && !cards.length ? (
        <div className={styles.loading} role="status"><Icon icon="lucide:loader-circle" />正在加载文章推荐…</div>
      ) : (
        <div className={styles.grid}>
          {cards.map((article, index) => (
            <article className={styles.card} key={article.path}>
              <div className={styles.cardTop}>
                <span className={styles.number}>{String(index + 1).padStart(2, '0')}</span>
                <span className={styles.sectionName}>{article.section.replace(/^docs\/?/, '').replace(/\//g, ' / ')}</span>
              </div>
              <Link to={articleRoute(article.path)} className={styles.title}>{article.title}</Link>
              <p className={styles.excerpt}>{article.excerpt || '打开文章查看详细内容与示例。'}</p>
              <div className={styles.cardFooter}>
                <div className={styles.tags}>
                  {article.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <button type="button" className={styles.previewButton} onClick={() => setPreview(article)}>
                  <Icon icon="lucide:scan-eye" />预览
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {preview ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setPreview(null)}>
          <section className={styles.previewModal} role="dialog" aria-modal="true" aria-labelledby="article-preview-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className={styles.closeButton} aria-label="关闭预览" onClick={() => setPreview(null)}><Icon icon="lucide:x" /></button>
            <span className={styles.eyebrow}>ARTICLE PREVIEW</span>
            <h2 id="article-preview-title">{preview.title}</h2>
            <p>{preview.excerpt || '打开文章查看详细内容与示例。'}</p>
            <div className={styles.tags}>{preview.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <Link to={articleRoute(preview.path)} className={styles.readButton} onClick={() => setPreview(null)}>阅读全文 <Icon icon="lucide:arrow-right" /></Link>
          </section>
        </div>
      ) : null}
    </section>
  );
}
