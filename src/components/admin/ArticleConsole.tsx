import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Icon} from '@iconify/react';

import {consoleApi} from './consoleApi';
import MarkdownPreview, {splitFrontMatter, getFrontMatterValue, type FrontMatterEntry} from './MarkdownPreview';
import styles from '@site/src/pages/admin/styles.module.css';

type FileEntry = {path: string; name: string; section: string};
type Draft = {
  section: string;
  slug: string;
  title: string;
  tags: string;
  useCustomPath: boolean;
  customPath: string;
};
type ViewMode = 'split' | 'edit' | 'preview';

const DEFAULT_SECTION = 'docs/notes';

function basename(path: string): string {
  return path.split('/').pop() || path;
}

function dirname(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

function isValidPath(path: string): boolean {
  if (!path || path.includes('..') || path.startsWith('/') || /[\0\r\n]/.test(path)) return false;
  return /^(?:docs|blog)\/.+\.(?:md|mdx)$/i.test(path);
}

function slugify(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[\\/:*?"<>|#%{}^[\]]+/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function joinPath(section: string, name: string): string {
  return `${section.replace(/\/+$/, '')}/${name}`;
}

function serializeFrontMatter(entries: FrontMatterEntry[]): string {
  if (!entries.length) return '';
  return `---\n${entries.map((entry) => `${entry.key}: ${entry.value}`).join('\n')}\n---\n\n`;
}

function countWords(value: string): number {
  const text = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/[#>*_\-~[\]()!]/g, ' ')
    .trim();
  if (!text) return 0;
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/g) || []).length;
  const latin = (text.replace(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff]/g, ' ').match(/[A-Za-z0-9]+/g) || []).length;
  return cjk + latin;
}

const TOOLBAR: Array<{icon: string; label: string; before: string; after?: string; line?: boolean}> = [
  {icon: 'lucide:heading-2', label: '标题', before: '## ', line: true},
  {icon: 'lucide:bold', label: '加粗', before: '**', after: '**'},
  {icon: 'lucide:italic', label: '斜体', before: '*', after: '*'},
  {icon: 'lucide:strikethrough', label: '删除线', before: '~~', after: '~~'},
  {icon: 'lucide:code', label: '行内代码', before: '`', after: '`'},
  {icon: 'lucide:link', label: '链接', before: '[', after: '](https://)'},
  {icon: 'lucide:image', label: '图片', before: '![', after: '](https://)'},
  {icon: 'lucide:quote', label: '引用', before: '> ', line: true},
  {icon: 'lucide:list', label: '无序列表', before: '- ', line: true},
  {icon: 'lucide:list-ordered', label: '有序列表', before: '1. ', line: true},
  {icon: 'lucide:square-check', label: '任务', before: '- [ ] ', line: true},
  {icon: 'lucide:code-xml', label: '代码块', before: '```\n', after: '\n```'},
  {icon: 'lucide:table', label: '表格', before: '| 列1 | 列2 |\n| --- | --- |\n| 内容 | 内容 |\n', line: true},
  {icon: 'lucide:minus', label: '分隔线', before: '\n---\n', line: true},
];

export default function ArticleConsole({initialPath, repository}: {initialPath: string; repository: string | null}) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [loadedPath, setLoadedPath] = useState('');
  const [content, setContent] = useState('');
  const [baseline, setBaseline] = useState('');
  const [headSha, setHeadSha] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    section: DEFAULT_SECTION,
    slug: '',
    title: '',
    tags: '',
    useCustomPath: false,
    customPath: '',
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollLock = useRef<'editor' | 'preview' | null>(null);

  const dirty = content !== baseline;
  const frontMatter = useMemo(() => splitFrontMatter(content), [content]);
  const metaTitle = getFrontMatterValue(frontMatter.entries, 'title');
  const metaTags = getFrontMatterValue(frontMatter.entries, 'tags');
  const words = useMemo(() => countWords(frontMatter.body), [frontMatter.body]);
  const isNew = Boolean(loadedPath) === false && content.trim() !== '';

  const loadFiles = async () => {
    const data = await consoleApi<{files: string[]; sections?: string[]; headSha: string}>('/api/console/files');
    const entries = data.files.map((path) => ({path, name: basename(path), section: dirname(path)}));
    const derived = [...new Set(entries.map((entry) => entry.section))].sort((left, right) => left.localeCompare(right, 'zh-CN'));
    setFiles(entries);
    setSections(data.sections?.length ? data.sections : derived);
    return entries;
  };

  const loadFile = async (path: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await consoleApi<{path: string; content: string; headSha: string}>(`/api/console/file?path=${encodeURIComponent(path)}`);
      setSelectedPath(data.path);
      setLoadedPath(data.path);
      setContent(data.content);
      setBaseline(data.content);
      setHeadSha(data.headSha);
      setMessage(`文章：通过控制台更新 ${data.path}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法读取文章。');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const entries = await loadFiles();
        const target = initialPath && entries.some((entry) => entry.path === initialPath) ? initialPath : entries[0]?.path;
        if (target) await loadFile(target);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '无法读取文章列表。');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  const chooseFile = (path: string) => {
    if (path === selectedPath && loadedPath === path) return;
    if (dirty && !window.confirm('当前文章有未提交的修改，确定放弃吗？')) return;
    setShowNew(false);
    void loadFile(path);
  };

  const save = async () => {
    if (!selectedPath || !dirty) return;
    if (!isValidPath(selectedPath)) {
      setError('路径必须位于 docs/ 或 blog/ 目录下，并以 .md 或 .mdx 结尾。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const payload: {path: string; content: string; baseHeadSha: string; message: string; previousPath?: string} = {
        path: selectedPath,
        content,
        baseHeadSha: headSha,
        message: message || `文章：通过控制台更新 ${selectedPath}`,
      };
      if (loadedPath && loadedPath !== selectedPath) payload.previousPath = loadedPath;
      const result = await consoleApi<{commitSha: string}>('/api/console/file', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await loadFiles();
      await loadFile(selectedPath);
      setNotice(`文章已写入仓库，提交编号为 ${result.commitSha.slice(0, 8)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '文章提交失败。');
    } finally {
      setBusy(false);
    }
  };

  const removeArticle = async () => {
    if (!loadedPath) return;
    if (!window.confirm(`确定要删除 ${loadedPath} 吗？此操作会直接提交到仓库。`)) return;
    setBusy(true);
    setError('');
    try {
      const result = await consoleApi<{commitSha: string}>('/api/console/file', {
        method: 'DELETE',
        body: JSON.stringify({path: loadedPath, baseHeadSha: headSha, message: `文章：通过控制台删除 ${loadedPath}`}),
      });
      setContent('');
      setBaseline('');
      setLoadedPath('');
      const entries = await loadFiles();
      if (entries[0]) await loadFile(entries[0].path);
      setNotice(`文章已删除，提交编号为 ${result.commitSha.slice(0, 8)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败。');
    } finally {
      setBusy(false);
    }
  };

  const updateMeta = (key: 'title' | 'tags', value: string) => {
    const entries = frontMatter.entries.filter((entry) => entry.key.toLowerCase() !== key);
    if (key === 'title') entries.unshift({key, value});
    else entries.push({key, value});
    setContent(serializeFrontMatter(entries) + frontMatter.body);
  };

  const applyToolbar = (item: typeof TOOLBAR[number]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    let next: string;
    let cursor: number;
    if (item.line) {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      next = content.slice(0, lineStart) + item.before + content.slice(lineStart);
      cursor = start + item.before.length;
    } else {
      const after = item.after || '';
      next = content.slice(0, start) + item.before + selected + after + content.slice(end);
      cursor = start + item.before.length + selected.length;
    }
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const onEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const meta = event.ctrlKey || event.metaKey;
    if (event.key === 'Tab') {
      event.preventDefault();
      const textarea = event.currentTarget;
      const start = textarea.selectionStart;
      setContent(content.slice(0, start) + '  ' + content.slice(textarea.selectionEnd));
      requestAnimationFrame(() => textarea.setSelectionRange(start + 2, start + 2));
      return;
    }
    if (!meta) return;
    const key = event.key.toLowerCase();
    if (key === 's') {
      event.preventDefault();
      void save();
    } else if (key === 'b') {
      event.preventDefault();
      applyToolbar(TOOLBAR[1]);
    } else if (key === 'i') {
      event.preventDefault();
      applyToolbar(TOOLBAR[2]);
    } else if (key === 'k') {
      event.preventDefault();
      applyToolbar(TOOLBAR[5]);
    }
  };

  const onEditorScroll = () => {
    if (scrollLock.current === 'preview') return;
    scrollLock.current = 'editor';
    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (editor && preview) {
      const ratio = editor.scrollTop / Math.max(1, editor.scrollHeight - editor.clientHeight);
      preview.scrollTop = ratio * Math.max(0, preview.scrollHeight - preview.clientHeight);
    }
    requestAnimationFrame(() => { scrollLock.current = null; });
  };

  const onPreviewScroll = () => {
    if (scrollLock.current === 'editor') return;
    scrollLock.current = 'preview';
    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (editor && preview) {
      const ratio = preview.scrollTop / Math.max(1, preview.scrollHeight - preview.clientHeight);
      editor.scrollTop = ratio * Math.max(0, editor.scrollHeight - editor.clientHeight);
    }
    requestAnimationFrame(() => { scrollLock.current = null; });
  };

  const draftPath = draft.useCustomPath
    ? draft.customPath.trim()
    : joinPath(draft.section.trim(), `${slugify(draft.slug)}.md`);

  const createArticle = () => {
    const path = draftPath.replace(/^@site\//, '');
    if (!isValidPath(path)) {
      setError('新文章路径无效：需位于 docs/ 或 blog/ 下并以 .md 或 .mdx 结尾。');
      return;
    }
    if (files.some((entry) => entry.path === path)) {
      setError('该路径已存在，请更换文件名或使用自定义路径。');
      return;
    }
    const title = draft.title.trim() || basename(path).replace(/\.(md|mdx)$/i, '');
    const entries: FrontMatterEntry[] = [{key: 'title', value: title}];
    const tags = draft.tags.trim();
    if (tags) entries.push({key: 'tags', value: tags.startsWith('[') ? tags : `[${tags}]`});
    const template = `${serializeFrontMatter(entries)}# ${title}\n\n在这里开始撰写内容。\n`;
    if (dirty && !window.confirm('当前文章有未提交的修改，新建文章会放弃这些修改，确定继续吗？')) return;
    setError('');
    setNotice('');
    setSelectedPath(path);
    setLoadedPath('');
    setHeadSha('');
    setContent(template);
    setBaseline('');
    setMessage(`文章：通过控制台新建 ${path}`);
    setShowNew(false);
    setViewMode('split');
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const visibleFiles = useMemo(() => {
    const needle = filter.trim().toLocaleLowerCase();
    if (!needle) return files;
    return files.filter((entry) => entry.path.toLocaleLowerCase().includes(needle));
  }, [files, filter]);

  const groupedFiles = useMemo(() => {
    const map = new Map<string, FileEntry[]>();
    for (const entry of visibleFiles) {
      const list = map.get(entry.section) || [];
      list.push(entry);
      map.set(entry.section, list);
    }
    return [...map.entries()].sort((left, right) => left[0].localeCompare(right[0], 'zh-CN'));
  }, [visibleFiles]);

  return (
    <div className={styles.articleGrid}>
      <aside className={styles.fileSidebar}>
        <div className={styles.sidebarTitle}>
          <span>文章文件</span>
          <small>{files.length}</small>
        </div>
        <button type="button" className={styles.newArticleButton} onClick={() => setShowNew((value) => !value)}>
          <Icon icon={showNew ? 'lucide:x' : 'lucide:file-plus-2'} />
          {showNew ? '取消新建' : '新建文章'}
        </button>
        <label className={styles.searchBox}>
          <Icon icon="lucide:search" />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索文章文件" />
        </label>
        <div className={styles.fileList}>
          {groupedFiles.map(([section, entries]) => {
            const isCollapsed = filter.trim() ? false : Boolean(collapsed[section]);
            return (
              <div key={section} className={styles.fileSection}>
                <button
                  type="button"
                  className={styles.fileSectionHeader}
                  onClick={() => setCollapsed((current) => ({...current, [section]: !current[section]}))}>
                  <Icon icon={isCollapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'} />
                  <span>{section || '根目录'}</span>
                  <small>{entries.length}</small>
                </button>
                {!isCollapsed
                  ? entries.map((entry) => (
                      <button
                        type="button"
                        key={entry.path}
                        className={entry.path === selectedPath ? styles.fileActive : styles.fileButton}
                        onClick={() => chooseFile(entry.path)}>
                        <Icon icon="lucide:file-text" />
                        <span>{entry.name}<small>{entry.section}</small></span>
                      </button>
                    ))
                  : null}
              </div>
            );
          })}
          {!busy && visibleFiles.length === 0 ? <div className={styles.emptyState}>没有匹配的文章。</div> : null}
        </div>
      </aside>

      <section className={styles.articleEditor}>
        <div className={styles.workspaceHeader}>
          <div>
            <span className={styles.eyebrow}>MARKDOWN EDITOR</span>
            <h2>
              {isNew ? '新建文章' : (selectedPath ? basename(selectedPath) : '选择文章')}
              {isNew ? <em className={styles.newBadge}>未提交</em> : null}
            </h2>
            <p>{selectedPath || '从左侧列表选择 Markdown 文件'}</p>
          </div>
          <div className={styles.headerActions}>
            <div className={styles.viewModeTabs} role="group" aria-label="视图模式">
              <button type="button" className={viewMode === 'edit' ? styles.viewModeActive : styles.viewModeButton} onClick={() => setViewMode('edit')} title="仅编辑"><Icon icon="lucide:pencil" /></button>
              <button type="button" className={viewMode === 'split' ? styles.viewModeActive : styles.viewModeButton} onClick={() => setViewMode('split')} title="分栏"><Icon icon="lucide:columns-2" /></button>
              <button type="button" className={viewMode === 'preview' ? styles.viewModeActive : styles.viewModeButton} onClick={() => setViewMode('preview')} title="仅预览"><Icon icon="lucide:eye" /></button>
            </div>
            {loadedPath ? (
              <button type="button" className={styles.dangerButton} onClick={() => void removeArticle()} disabled={busy} title="删除文章">
                <Icon icon="lucide:trash-2" />
              </button>
            ) : null}
            <button type="button" className={styles.primaryButton} onClick={() => void save()} disabled={!dirty || busy}>
              <Icon icon="lucide:git-commit-horizontal" />
              {isNew ? '创建文章' : '提交文章'}
            </button>
          </div>
        </div>

        {error ? <div className={styles.errorBanner}><Icon icon="lucide:circle-alert" />{error}</div> : null}
        {notice ? (
          <div className={styles.noticeBanner}>
            <Icon icon="lucide:circle-check" />
            <span>{notice} GitHub Actions 将继续构建和部署。</span>
            {repository ? <a href={`https://github.com/${repository}/actions`} target="_blank" rel="noreferrer">查看 Actions</a> : null}
          </div>
        ) : null}

        {showNew ? (
          <div className={styles.newArticlePanel}>
            <div className={styles.editorHeading}>
              <h3>新建文章</h3>
              <p>选择文章分区并填写文件名，路径会实时生成；标题与标签将写入文章前言。</p>
            </div>
            <div className={styles.newArticleGrid}>
              <label className={styles.field}>
                <span>文章分区</span>
                <input
                  list="article-sections"
                  value={draft.section}
                  onChange={(event) => setDraft({...draft, section: event.target.value})}
                  placeholder="docs/notes"
                  disabled={draft.useCustomPath}
                />
                <datalist id="article-sections">
                  {sections.map((section) => <option key={section} value={section} />)}
                </datalist>
              </label>
              <label className={styles.field}>
                <span>文件名</span>
                <input
                  value={draft.slug}
                  onChange={(event) => setDraft({...draft, slug: event.target.value})}
                  placeholder="my-article"
                  disabled={draft.useCustomPath}
                />
              </label>
              <label className={styles.field}>
                <span>标题</span>
                <input value={draft.title} onChange={(event) => setDraft({...draft, title: event.target.value})} placeholder="文章标题" />
              </label>
              <label className={styles.field}>
                <span>标签（逗号分隔）</span>
                <input value={draft.tags} onChange={(event) => setDraft({...draft, tags: event.target.value})} placeholder="笔记, 前端" />
              </label>
            </div>
            <label className={styles.checkboxRow}>
              <input type="checkbox" checked={draft.useCustomPath} onChange={(event) => setDraft({...draft, useCustomPath: event.target.checked})} />
              手动指定完整路径
            </label>
            {draft.useCustomPath ? (
              <label className={styles.field}>
                <span>完整路径</span>
                <input value={draft.customPath} onChange={(event) => setDraft({...draft, customPath: event.target.value})} placeholder="docs/notes/web/my-article.md" />
              </label>
            ) : null}
            <div className={styles.newArticleFooter}>
              <code>{draftPath || '—'}</code>
              <div className={styles.editorActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setDraft({...draft, slug: slugify(draft.title)})}
                  disabled={draft.useCustomPath || !draft.title.trim()}>
                  <Icon icon="lucide:wand-sparkles" />
                  由标题生成文件名
                </button>
                <button type="button" className={styles.primaryButton} onClick={createArticle}>
                  <Icon icon="lucide:file-plus-2" />
                  创建草稿
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className={styles.metaPanel}>
          <label className={styles.field}>
            <span>标题</span>
            <input value={metaTitle} onChange={(event) => updateMeta('title', event.target.value)} placeholder="未设置" />
          </label>
          <label className={styles.field}>
            <span>标签</span>
            <input value={metaTags} onChange={(event) => updateMeta('tags', event.target.value)} placeholder="[标签1, 标签2]" />
          </label>
          <label className={styles.field}>
            <span>文章路径</span>
            <input
              value={selectedPath}
              onChange={(event) => setSelectedPath(event.target.value)}
              placeholder="docs/notes/example.md"
              spellCheck={false}
            />
          </label>
        </div>

        <div className={`${styles.editorSplit} ${viewMode === 'edit' ? styles.editorSplitEdit : ''}${viewMode === 'preview' ? styles.editorSplitPreview : ''}`}>
          {viewMode !== 'preview' ? (
            <div className={styles.editorPane}>
              <div className={styles.editorToolbar}>
                {TOOLBAR.map((item) => (
                  <button type="button" key={item.label} title={item.label} aria-label={item.label} onClick={() => applyToolbar(item)} disabled={!selectedPath || busy}>
                    <Icon icon={item.icon} />
                  </button>
                ))}
              </div>
              <textarea
                ref={textareaRef}
                className={styles.markdownEditor}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onScroll={onEditorScroll}
                onKeyDown={onEditorKeyDown}
                spellCheck={false}
                aria-label="Markdown 源文件"
                disabled={!selectedPath || busy}
                placeholder="在此书写 Markdown…"
              />
            </div>
          ) : null}
          {viewMode !== 'edit' ? (
            <div className={styles.previewPane} ref={previewRef} onScroll={onPreviewScroll}>
              {content.trim() ? (
                <MarkdownPreview source={frontMatter.body} className={styles.previewBody} />
              ) : (
                <div className={styles.emptyState}>暂无内容可预览。</div>
              )}
            </div>
          ) : null}
        </div>

        <div className={styles.commitRow}>
          <label>
            <span>提交说明</span>
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} />
          </label>
          <span className={styles.wordCount}>{words} 字</span>
          <span className={dirty ? styles.dirtyMark : styles.savedMark}>{dirty ? '有未提交修改' : '已与仓库同步'}</span>
        </div>
      </section>
    </div>
  );
}
