import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Icon} from '@iconify/react';

import {consoleApi, consoleUpload, describeGitSync, type GitSyncResult} from './consoleApi';
import MarkdownPreview, {splitFrontMatter, getFrontMatterValue, frontMatterLineOffset, type FrontMatterEntry} from './MarkdownPreview';
import styles from '@site/src/pages/admin/styles.module.css';

type FileEntry = {path: string; name: string; section: string};
type ArticleSummary = {path: string; title: string; tags: string[]; section: string};
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

function normalizeSection(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) return '';
  if (/^(?:docs|blog)(?:\/|$)/.test(trimmed)) return trimmed;
  return `docs/${trimmed}`;
}

function parseTagList(value: string): string[] {
  const inner = String(value ?? '').trim().replace(/^\[/, '').replace(/\]$/, '');
  if (!inner.trim()) return [];
  return inner
    .split(',')
    .map((tag) => tag.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function formatTagList(tags: string[]): string {
  return tags.length ? `[${tags.join(', ')}]` : '';
}

function TagEditor({
  value,
  suggestions,
  listId,
  placeholder,
  onChange,
}: {
  value: string;
  suggestions: string[];
  listId: string;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  const tags = useMemo(() => parseTagList(value), [value]);
  const [input, setInput] = useState('');
  const commit = (raw: string) => {
    const tag = raw.trim().replace(/^["']|["']$/g, '');
    if (!tag) return;
    onChange(formatTagList(tags.includes(tag) ? tags : [...tags, tag]));
    setInput('');
  };
  const remove = (tag: string) => onChange(formatTagList(tags.filter((item) => item !== tag)));
  const available = suggestions.filter((suggestion) => !tags.includes(suggestion));
  return (
    <div className={styles.tagEditor}>
      {tags.map((tag) => (
        <span key={tag} className={styles.tagChip}>
          {tag}
          <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => remove(tag)}>
            <Icon icon="lucide:x" />
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={input}
        placeholder={tags.length ? '添加标签' : (placeholder || '输入标签后回车')}
        onChange={(event) => {
          const next = event.target.value;
          if (next.includes(',')) commit(next);
          else setInput(next);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit(input);
          } else if (event.key === 'Backspace' && !input && tags.length) {
            remove(tags[tags.length - 1]);
          }
        }}
        onBlur={() => commit(input)}
      />
      <datalist id={listId}>
        {available.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
    </div>
  );
}

type UploadResult = {created: string[]; updated: string[]; skipped: string[]; backend: string; gitSync?: GitSyncResult};

function relativeName(file: File): string {
  const withPath = file as File & {webkitRelativePath?: string};
  return withPath.webkitRelativePath || file.name;
}

function UploadPanel({sections, defaultTarget, onFinish}: {sections: string[]; defaultTarget: string; onFinish: (result: UploadResult) => void}) {
  const [target, setTarget] = useState(defaultTarget);
  const [files, setFiles] = useState<File[]>([]);
  const [archive, setArchive] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from<File>(list).filter((file) => /\.(?:md|mdx)$/i.test(file.name));
    if (!incoming.length) {
      setError('请选择 .md 或 .mdx 文件。');
      return;
    }
    setFiles((current) => [...current, ...incoming]);
    setError('');
  };

  const resetInputs = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (dirInputRef.current) dirInputRef.current.value = '';
    if (archiveInputRef.current) archiveInputRef.current.value = '';
  };

  const submit = async () => {
    const destination = normalizeSection(target);
    if (!destination) {
      setError('请填写目标分区路径，例如 docs/notes/web。');
      return;
    }
    if (!files.length && !archive) {
      setError('请选择 Markdown 文件或一个压缩包。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('target', destination);
      for (const file of files) form.append('files', file, relativeName(file));
      if (archive) form.append('archive', archive);
      const result = await consoleUpload<UploadResult>('/api/console/upload', form);
      setFiles([]);
      setArchive(null);
      resetInputs();
      onFinish(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '上传失败。');
    } finally {
      setBusy(false);
    }
  };

  const destination = normalizeSection(target);
  return (
    <div className={styles.uploadPanel}>
      <div className={styles.panelHeading}>
        <h3>批量上传</h3>
        <p>上传多个 Markdown 文件或一个 zip 压缩包，自动解压到目标分区；与 Obsidian 一样，新的文件夹会成为新的分区。</p>
      </div>
      <div className={styles.field}>
        <span>目标分区路径</span>
        <input
          list="upload-sections"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          placeholder="docs/notes/web"
        />
        <datalist id="upload-sections">
          {sections.map((section) => <option key={section} value={section} />)}
        </datalist>
        <small className={styles.fieldHint}>压缩包内的文件夹结构会保留；不存在的新分区会自动创建。</small>
      </div>
      <div className={styles.uploadButtons}>
        <button type="button" className={styles.secondaryButton} onClick={() => fileInputRef.current?.click()} disabled={busy}>
          <Icon icon="lucide:file-plus-2" />
          选择 Markdown
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => dirInputRef.current?.click()} disabled={busy}>
          <Icon icon="lucide:folder-tree" />
          选择文件夹
        </button>
        <button type="button" className={styles.secondaryButton} onClick={() => archiveInputRef.current?.click()} disabled={busy}>
          <Icon icon="lucide:file-archive" />
          选择压缩包
        </button>
        <input ref={fileInputRef} className={styles.hiddenInput} type="file" accept=".md,.mdx,text/markdown" multiple onChange={(event) => addFiles(event.target.files)} />
        <input
          ref={dirInputRef}
          className={styles.hiddenInput}
          type="file"
          multiple
          onChange={(event) => addFiles(event.target.files)}
          {...({webkitdirectory: 'true'} as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        <input ref={archiveInputRef} className={styles.hiddenInput} type="file" accept=".zip,application/zip" onChange={(event) => setArchive(event.target.files?.[0] || null)} />
      </div>
      {archive ? (
        <div className={styles.uploadSummary}>
          <Icon icon="lucide:file-archive" />
          <span>{archive.name}</span>
          <button type="button" aria-label="移除压缩包" onClick={() => { setArchive(null); if (archiveInputRef.current) archiveInputRef.current.value = ''; }}>
            <Icon icon="lucide:x" />
          </button>
        </div>
      ) : null}
      {files.length ? (
        <div className={styles.uploadList}>
          {files.map((file, index) => (
            <div key={`${relativeName(file)}-${index}`} className={styles.uploadItem}>
              <Icon icon="lucide:file-text" />
              <span>{relativeName(file)}</span>
              <button type="button" aria-label="移除文件" onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}>
                <Icon icon="lucide:x" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <div className={styles.errorBanner}><Icon icon="lucide:circle-alert" />{error}</div> : null}
      <div className={styles.uploadFooter}>
        <span>{files.length} 个文件{archive ? ` + 压缩包` : ''}</span>
        <button type="button" className={styles.primaryButton} onClick={() => void submit()} disabled={busy || (!files.length && !archive)}>
          <Icon icon="lucide:upload" />
          上传到 {destination || '—'}
        </button>
      </div>
    </div>
  );
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
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
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
  const [showUpload, setShowUpload] = useState(false);
  const [showSections, setShowSections] = useState(false);
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
  const mirrorRef = useRef<HTMLDivElement>(null);
  const sectionPickerRef = useRef<HTMLDivElement>(null);
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const lineOffsetsRef = useRef<number[]>([]);
  const previewAnchorsRef = useRef<{line: number; top: number}[]>([]);
  const programmatic = useRef<{editor: number; preview: number}>({editor: 0, preview: 0});

  const dirty = content !== baseline;
  const frontMatter = useMemo(() => splitFrontMatter(content), [content]);
  const metaTitle = getFrontMatterValue(frontMatter.entries, 'title');
  const metaTags = getFrontMatterValue(frontMatter.entries, 'tags');
  const words = useMemo(() => countWords(frontMatter.body), [frontMatter.body]);
  const mirrorLines = useMemo(() => content.split('\n'), [content]);
  const frontMatterOffset = useMemo(() => frontMatterLineOffset(content), [content]);
  const knownTags = useMemo(() => {
    const set = new Set<string>();
    for (const article of articles) {
      for (const tag of article.tags || []) if (tag) set.add(tag);
    }
    for (const tag of parseTagList(metaTags)) set.add(tag);
    return [...set].sort((left, right) => left.localeCompare(right, 'zh-CN'));
  }, [articles, metaTags]);
  const isNew = Boolean(loadedPath) === false && content.trim() !== '';

  const loadFiles = async () => {
    const data = await consoleApi<{files: string[]; sections?: string[]; articles?: ArticleSummary[]; headSha: string}>('/api/console/files');
    const entries = data.files.map((path) => ({path, name: basename(path), section: dirname(path)}));
    const derived = [...new Set(entries.map((entry) => entry.section))].sort((left, right) => left.localeCompare(right, 'zh-CN'));
    setFiles(entries);
    setArticles(data.articles || []);
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const editor = textareaRef.current;
      if (editor) {
        editor.selectionStart = 0;
        editor.selectionEnd = 0;
        editor.scrollTop = 0;
      }
      if (previewRef.current) previewRef.current.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [loadedPath]);

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
      const payload: {path: string; content: string; baseHeadSha: string | null; message: string; previousPath?: string} = {
        path: selectedPath,
        content,
        baseHeadSha: headSha || null,
        message: message || `文章：通过控制台更新 ${selectedPath}`,
      };
      if (loadedPath && loadedPath !== selectedPath) payload.previousPath = loadedPath;
      const result = await consoleApi<{path: string; savedTo: string; gitSync?: GitSyncResult}>('/api/console/file', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await loadFiles();
      await loadFile(selectedPath);
      setNotice(`文章已保存到 ${result.savedTo === 'local' ? '本地 Blob 模拟' : 'Netlify Blob'}${describeGitSync(result.gitSync)}。`);
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
      const result = await consoleApi<{path: string; deletedFrom: string; gitSync?: GitSyncResult}>('/api/console/file', {
        method: 'DELETE',
        body: JSON.stringify({path: loadedPath, baseHeadSha: headSha || null, message: `文章：通过控制台删除 ${loadedPath}`}),
      });
      setContent('');
      setBaseline('');
      setLoadedPath('');
      const entries = await loadFiles();
      if (entries[0]) await loadFile(entries[0].path);
      setNotice(`文章已删除${describeGitSync(result.gitSync)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除失败。');
    } finally {
      setBusy(false);
    }
  };

  const updateMeta = (key: 'title' | 'tags', value: string) => {
    const entries = frontMatter.entries.filter((entry) => entry.key.toLowerCase() !== key);
    if (key === 'title') entries.unshift({key, value});
    else if (value.trim()) entries.push({key, value});
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

  const refreshLineOffsets = () => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    lineOffsetsRef.current = Array.from(mirror.children, (child) => (child as HTMLElement).offsetTop);
  };

  const refreshPreviewAnchors = () => {
    const preview = previewRef.current;
    if (!preview) return;
    const nodes = preview.querySelectorAll<HTMLElement>('[data-line]');
    const base = preview.getBoundingClientRect().top - preview.scrollTop;
    const map = new Map<number, number>();
    nodes.forEach((node) => {
      const line = Number(node.dataset.line);
      if (!Number.isFinite(line)) return;
      const top = node.getBoundingClientRect().top - base;
      const existing = map.get(line);
      if (existing === undefined || top < existing) map.set(line, top);
    });
    previewAnchorsRef.current = [...map.entries()]
      .map(([line, top]) => ({line, top}))
      .sort((left, right) => left.line - right.line);
  };

  const syncMirrorStyles = () => {
    const editor = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!editor || !mirror) return;
    const computed = window.getComputedStyle(editor);
    mirror.style.width = `${editor.clientWidth}px`;
    mirror.style.fontFamily = computed.fontFamily;
    mirror.style.fontSize = computed.fontSize;
    mirror.style.fontWeight = computed.fontWeight;
    mirror.style.fontStyle = computed.fontStyle;
    mirror.style.lineHeight = computed.lineHeight;
    mirror.style.letterSpacing = computed.letterSpacing;
    mirror.style.tabSize = computed.tabSize;
    mirror.style.padding = computed.padding;
  };

  const previewScrollForLine = (line: number): number => {
    const anchors = previewAnchorsRef.current;
    if (!anchors.length) return 0;
    if (line <= anchors[0].line) return Math.max(0, anchors[0].top);
    let previous = anchors[0];
    for (const anchor of anchors) {
      if (anchor.line <= line) {
        previous = anchor;
        continue;
      }
      const span = Math.max(1, anchor.line - previous.line);
      const ratio = Math.min(1, Math.max(0, (line - previous.line) / span));
      return Math.max(0, previous.top + ratio * (anchor.top - previous.top));
    }
    return Math.max(0, previous.top);
  };

  const lineForPreviewOffset = (offset: number): number => {
    const anchors = previewAnchorsRef.current;
    if (anchors.length < 2) return anchors.length ? anchors[0].line : 1;
    let low = 0;
    let high = anchors.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (anchors[mid].top <= offset) low = mid;
      else high = mid - 1;
    }
    const start = anchors[low];
    const next = anchors[low + 1];
    if (!next || next.top === start.top) return start.line;
    const ratio = Math.min(1, Math.max(0, (offset - start.top) / (next.top - start.top)));
    return start.line + ratio * (next.line - start.line);
  };

  const offsetForLine = (line: number): number => {
    const offsets = lineOffsetsRef.current;
    if (!offsets.length) return 0;
    const index = Math.min(offsets.length, Math.max(1, Math.round(line))) - 1;
    return offsets[index];
  };

  const lineForEditorOffset = (offset: number): number => {
    const offsets = lineOffsetsRef.current;
    if (offsets.length < 2) return 1;
    let low = 0;
    let high = offsets.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (offsets[mid] <= offset) low = mid;
      else high = mid - 1;
    }
    const start = offsets[low];
    const next = low + 1 < offsets.length ? offsets[low + 1] : start + 1;
    if (next === start) return low + 1;
    const ratio = Math.min(1, Math.max(0, (offset - start) / (next - start)));
    return low + 1 + ratio;
  };

  const setEditorScroll = (value: number) => {
    const editor = textareaRef.current;
    if (!editor) return;
    programmatic.current.editor = performance.now() + 220;
    editor.scrollTop = value;
  };

  const setPreviewScroll = (value: number) => {
    const preview = previewRef.current;
    if (!preview) return;
    programmatic.current.preview = performance.now() + 220;
    preview.scrollTop = value;
  };

  const onEditorScroll = () => {
    const editor = textareaRef.current;
    if (!editor) return;
    if (performance.now() < programmatic.current.editor) return;
    if (!previewRef.current) return;
    setPreviewScroll(previewScrollForLine(lineForEditorOffset(editor.scrollTop)));
  };

  const onPreviewScroll = () => {
    const preview = previewRef.current;
    if (!preview) return;
    if (performance.now() < programmatic.current.preview) return;
    if (!textareaRef.current) return;
    setEditorScroll(offsetForLine(lineForPreviewOffset(preview.scrollTop)));
  };

  const cursorLine = (): number => {
    const editor = textareaRef.current;
    if (!editor) return 1;
    const value = editor.value;
    const limit = Math.min(editor.selectionStart, value.length);
    let line = 1;
    for (let index = 0; index < limit; index += 1) {
      if (value.charCodeAt(index) === 10) line += 1;
    }
    return line;
  };

  const revealCursor = () => {
    const editor = textareaRef.current;
    const preview = previewRef.current;
    if (!editor || !preview || document.activeElement !== editor) return;
    const top = previewScrollForLine(cursorLine());
    const margin = Math.min(preview.clientHeight * 0.2, 90);
    if (top < preview.scrollTop + margin || top > preview.scrollTop + preview.clientHeight - margin) {
      setPreviewScroll(Math.max(0, top - margin));
    }
  };

  useEffect(() => {
    syncMirrorStyles();
    refreshLineOffsets();
    refreshPreviewAnchors();
    const timer = window.setTimeout(() => {
      syncMirrorStyles();
      refreshLineOffsets();
      refreshPreviewAnchors();
    }, 120);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, viewMode]);

  useEffect(() => {
    const editor = textareaRef.current;
    if (!editor || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      syncMirrorStyles();
      refreshLineOffsets();
      refreshPreviewAnchors();
    });
    observer.observe(editor);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showSections) return;
    const close = (event: MouseEvent) => {
      if (!sectionPickerRef.current?.contains(event.target as Node)) setShowSections(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSections(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [showSections]);

  const normalizedSection = normalizeSection(draft.section);
  const draftPath = draft.useCustomPath
    ? draft.customPath.trim()
    : (normalizedSection ? joinPath(normalizedSection, `${slugify(draft.slug)}.md`) : '');

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

  const finishUpload = async (result: UploadResult) => {
    const parts: string[] = [];
    if (result.created.length) parts.push(`新增 ${result.created.length} 篇`);
    if (result.updated.length) parts.push(`更新 ${result.updated.length} 篇`);
    if (result.skipped.length) parts.push(`跳过 ${result.skipped.length} 篇`);
    const first = result.created[0] || result.updated[0];
    await loadFiles();
    if (first) await loadFile(first);
    setNotice(`批量导入完成：${parts.length ? parts.join('，') : '没有写入文件'}${describeGitSync(result.gitSync)}。`);
    setShowUpload(false);
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
            {loadedPath && !dirty ? (
              <a
                className={styles.secondaryButton}
                href={`/api/console/download?type=article&path=${encodeURIComponent(loadedPath)}`}
                download
                title="下载当前文章">
                <Icon icon="lucide:download" />
              </a>
            ) : null}
            <button
              type="button"
              className={showUpload ? styles.primaryButton : styles.secondaryButton}
              onClick={() => setShowUpload((value) => !value)}
              disabled={busy}
              title="批量上传 Markdown 或压缩包">
              <Icon icon="lucide:upload" />
              上传
            </button>
            {loadedPath ? (
              <button type="button" className={styles.dangerButton} onClick={() => void removeArticle()} disabled={busy} title="删除文章">
                <Icon icon="lucide:trash-2" />
              </button>
            ) : null}
            <button type="button" className={styles.primaryButton} onClick={() => void save()} disabled={!dirty || busy}>
              <Icon icon="lucide:git-commit-horizontal" />
              {isNew ? '创建文章' : '保存文章'}
            </button>
          </div>
        </div>

        {error ? <div className={styles.errorBanner}><Icon icon="lucide:circle-alert" />{error}</div> : null}
        {notice ? (
          <div className={styles.noticeBanner}>
            <Icon icon="lucide:circle-check" />
            <span>{notice}</span>
            {repository ? <a href={`https://github.com/${repository}/actions`} target="_blank" rel="noreferrer">查看 Actions</a> : null}
          </div>
        ) : null}

        {showNew ? (
          <div className={styles.newArticlePanel}>
            <div className={styles.panelHeading}>
              <h3>新建文章</h3>
              <p>选择文章分区并填写文件名，路径会实时生成；标题与标签将写入文章前言。</p>
            </div>
            <div className={styles.newArticleGrid}>
              <div className={styles.field}>
                <span>文章分区</span>
                <div className={styles.sectionPicker} ref={sectionPickerRef}>
                  <input
                    ref={sectionInputRef}
                    value={draft.section}
                    onChange={(event) => setDraft({...draft, section: event.target.value})}
                    placeholder="docs/notes 或新路径"
                    disabled={draft.useCustomPath}
                  />
                  <button
                    type="button"
                    className={styles.sectionToggle}
                    aria-label="浏览已有分区"
                    aria-expanded={showSections}
                    onClick={() => setShowSections((value) => !value)}
                    disabled={draft.useCustomPath}>
                    <Icon icon={showSections ? 'lucide:chevron-up' : 'lucide:chevron-down'} />
                  </button>
                  {showSections ? (
                    <div className={styles.sectionMenu} role="listbox">
                      <div className={styles.sectionMenuList}>
                        {sections.map((section) => (
                          <button
                            type="button"
                            key={section}
                            role="option"
                            aria-selected={draft.section === section}
                            className={draft.section === section ? styles.sectionMenuItemActive : styles.sectionMenuItem}
                            onClick={() => {
                              setDraft({...draft, section, useCustomPath: false});
                              setShowSections(false);
                            }}>
                            <Icon icon="lucide:folder" />
                            <span>{section}</span>
                          </button>
                        ))}
                        {!sections.length ? <div className={styles.sectionMenuEmpty}>还没有分区</div> : null}
                      </div>
                      <button
                        type="button"
                        className={styles.sectionMenuNew}
                        onClick={() => {
                          setDraft({...draft, section: '', useCustomPath: false});
                          setShowSections(false);
                          requestAnimationFrame(() => sectionInputRef.current?.focus());
                        }}>
                        <Icon icon="lucide:folder-plus" />
                        新建分区路径
                      </button>
                    </div>
                  ) : null}
                </div>
                <small className={styles.fieldHint}>输入新的分区路径（如 docs/notes/web）即可创建新分区。</small>
              </div>
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
              <div className={styles.field}>
                <span>标签</span>
                <TagEditor
                  value={draft.tags}
                  suggestions={knownTags}
                  listId="article-new-tags"
                  placeholder="输入标签后回车"
                  onChange={(next) => setDraft({...draft, tags: next})}
                />
              </div>
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

        {showUpload ? (
          <UploadPanel
            sections={sections}
            defaultTarget={normalizedSection || DEFAULT_SECTION}
            onFinish={(result) => void finishUpload(result)}
          />
        ) : null}

        <div className={styles.metaPanel}>
          <label className={styles.field}>
            <span>标题</span>
            <input value={metaTitle} onChange={(event) => updateMeta('title', event.target.value)} placeholder="未设置" />
          </label>
          <div className={styles.field}>
            <span>标签</span>
            <TagEditor
              value={metaTags}
              suggestions={knownTags}
              listId="article-meta-tags"
              placeholder="输入标签后回车"
              onChange={(next) => updateMeta('tags', next)}
            />
          </div>
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
                onKeyUp={revealCursor}
                onClick={revealCursor}
                onSelect={revealCursor}
                spellCheck={false}
                aria-label="Markdown 源文件"
                disabled={!selectedPath || busy}
                placeholder="在此书写 Markdown…"
              />
              <div className={styles.editorMirror} ref={mirrorRef} aria-hidden="true">
                {mirrorLines.map((line, index) => (
                  <div key={index}>{line === '' ? '\u200b' : line}</div>
                ))}
              </div>
            </div>
          ) : null}
          {viewMode !== 'edit' ? (
            <div className={styles.previewPane} ref={previewRef} onScroll={onPreviewScroll}>
              {content.trim() ? (
                <MarkdownPreview source={frontMatter.body} className={styles.previewBody} lineOffset={frontMatterOffset} />
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
