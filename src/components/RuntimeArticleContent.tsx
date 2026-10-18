import React, {createContext, type ReactNode, useEffect, useMemo, useState} from 'react';
import MarkdownPreview, {getFrontMatterValue, splitFrontMatter} from '@site/src/components/admin/MarkdownPreview';

import styles from './RuntimeArticleContent.module.css';

type ArticlePayload = {
  path: string;
  content: string;
  summary?: {title?: string; tags?: string[]; updatedAt?: string | null};
};

type Props = {
  sourcePath: string;
  fallbackTitle: string;
  fallback: ReactNode;
  showTitle?: boolean;
  onTitleChange?: (title: string) => void;
};

export const RuntimeArticleTitleContext = createContext<string | null>(null);

function titleHeading(source: string, title: string): string {
  const lines = source.split('\n');
  const firstContent = lines.findIndex((line) => line.trim());
  if (firstContent >= 0 && /^#\s+/.test(lines[firstContent])) {
    lines[firstContent] = `# ${title}`;
    return lines.join('\n');
  }
  return `# ${title}\n\n${source}`;
}

export default function RuntimeArticleContent({sourcePath, fallbackTitle, fallback, showTitle = false, onTitleChange}: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [summaryTitle, setSummaryTitle] = useState('');
  const frontMatter = useMemo(() => splitFrontMatter(content || ''), [content]);
  const frontMatterTitle = getFrontMatterValue(frontMatter.entries, 'title');
  const title = summaryTitle || frontMatterTitle || fallbackTitle;
  const normalizedPath = sourcePath.replace(/^@site\//, '').replace(/^\.\//, '');

  useEffect(() => {
    const controller = new AbortController();
    setContent(null);
    setMissing(false);
    setLoadFailed(false);
    setSummaryTitle('');
    if (!/^(?:docs|blog)\/.+\.(?:md|mdx)$/i.test(normalizedPath)) {
      setLoadFailed(true);
      return () => controller.abort();
    }

    void fetch(`/api/content/file?path=${encodeURIComponent(normalizedPath)}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {accept: 'application/json'},
      signal: controller.signal,
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (response.status === 404) {
        setMissing(true);
        return;
      }
      if (!response.ok || !payload.success || typeof payload.data?.content !== 'string') {
        throw new Error(payload.message || `文章读取失败（${response.status}）`);
      }
      setSummaryTitle(String(payload.data.summary?.title || ''));
      setContent(payload.data.content);
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setLoadFailed(true);
    });
    return () => controller.abort();
  }, [normalizedPath]);

  useEffect(() => {
    if (!content) return;
    onTitleChange?.(title);
    if (typeof document !== 'undefined') document.title = title;
  }, [content, onTitleChange, title]);

  if (missing) {
    return <div className={styles.articleMissing}>这篇文章已从内容库中删除或暂不可用。</div>;
  }
  if (content === null || loadFailed) return <>{fallback}</>;

  const body = showTitle ? titleHeading(frontMatter.body, title) : frontMatter.body;
  return <MarkdownPreview source={body} className={styles.runtimeArticle} sourcePath={normalizedPath} siteStyles />;
}
