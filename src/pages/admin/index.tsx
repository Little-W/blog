import React, {useEffect, useMemo, useState} from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import {Icon} from '@iconify/react';
import {useAdminSession} from '@site/src/components/AdminSession';

import styles from './styles.module.css';

type ApiResult<T> = {success: boolean; data: T; message?: string; code?: string};
type DatasetInfo = {name: string; label: string; path: string};
type JsonRecord = Record<string, unknown>;
type DatasetPayload = {
  name: string;
  label: string;
  path: string;
  records: JsonRecord[];
  count: number;
  headSha: string;
  blobSha: string;
};
type MusicTag = {
  id: number;
  name: string;
  order: number;
};
type PlaylistTagOrderItem = {
  id: number;
  name: string;
  order: number;
};
type EditorField = {
  id: string;
  key: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'null';
  value: string;
};

class ConsoleApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function consoleApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      accept: 'application/json',
      ...(init?.body ? {'content-type': 'application/json; charset=utf-8'} : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json()) as ApiResult<T>;
  if (!response.ok || !payload.success) {
    throw new ConsoleApiError(payload.message || `请求失败（${response.status}）`, response.status, payload.code);
  }
  return payload.data;
}

function recordTitle(record: JsonRecord, index: number) {
  const preferred = [
    record.title,
    record.z_full_name,
    record.tag_name,
    record.name,
    record.bilibili_bvid,
    record.objectId,
    record.mid,
  ].find((value) => typeof value === 'string' || typeof value === 'number');
  return preferred ? String(preferred) : `第 ${index + 1} 条`;
}

function fieldType(value: unknown): EditorField['type'] {
  if (value === null) return 'null';
  if (Array.isArray(value) || typeof value === 'object') return 'json';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'string';
}

function recordToFields(record: JsonRecord): EditorField[] {
  return Object.entries(record).map(([key, value], index) => ({
    id: `${index}-${key}`,
    key,
    type: fieldType(value),
    value: typeof value === 'object' && value !== null
      ? JSON.stringify(value, null, 2)
      : value === null
        ? ''
        : String(value),
  }));
}

function fieldsToRecord(fields: EditorField[]): JsonRecord {
  const result: JsonRecord = {};
  for (const field of fields) {
    const key = field.key.trim();
    if (!key) throw new Error('字段名不得为空。');
    if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error(`字段 ${key} 重复。`);
    if (field.type === 'number') {
      const value = Number(field.value);
      if (!Number.isFinite(value)) throw new Error(`${key} 不是有效数字。`);
      result[key] = value;
    } else if (field.type === 'boolean') {
      result[key] = field.value === 'true';
    } else if (field.type === 'json') {
      result[key] = JSON.parse(field.value);
    } else if (field.type === 'null') {
      result[key] = null;
    } else {
      result[key] = field.value;
    }
  }
  return result;
}

function parseImportedRecords(text: string): JsonRecord[] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('导入内容为空。');
  let records: unknown[];
  if (clean.startsWith('[') || clean.startsWith('{')) {
    const parsed = JSON.parse(clean);
    records = Array.isArray(parsed) ? parsed : [parsed];
  } else {
    records = clean
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => JSON.parse(line));
  }
  if (!records.length || records.some((record) => !record || Array.isArray(record) || typeof record !== 'object')) {
    throw new Error('导入内容必须是 JSON 对象、对象数组或 JSONL。');
  }
  return records as JsonRecord[];
}

function parseListTagIds(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map(Number).filter((id) => Number.isInteger(id) && id >= 0))];
  } catch {
    return [];
  }
}

function RecordEditor({
  record,
  mode,
  musicTags,
  onApply,
  onCancel,
}: {
  record: JsonRecord;
  mode: 'new' | 'edit';
  musicTags: MusicTag[];
  onApply: (record: JsonRecord) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState(() => recordToFields(record));
  const [error, setError] = useState('');

  const changeField = (id: string, patch: Partial<EditorField>) => {
    setFields((current) => current.map((field) => field.id === id ? {...field, ...patch} : field));
  };

  const tagNames = useMemo(() => new Map<number, string>([
    [1, '基础资料'],
    ...musicTags.map((tag) => [tag.id, tag.name] as const),
  ]), [musicTags]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      onApply(fieldsToRecord(fields));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '字段内容无效。');
    }
  };

  return (
    <form className={styles.recordEditor} onSubmit={submit}>
      <div className={styles.editorHeading}>
        <div>
          <span className={styles.eyebrow}>{mode === 'new' ? 'NEW RECORD' : 'EDIT RECORD'}</span>
          <h3>{mode === 'new' ? '新增表项' : '编辑表项'}</h3>
        </div>
        <button type="button" className={styles.iconButton} onClick={onCancel} aria-label="关闭编辑器">
          <Icon icon="lucide:x" />
        </button>
      </div>
      <div className={styles.fields}>
        {fields.map((field) => (
          <div className={styles.fieldRow} key={field.id}>
            <input
              className={styles.fieldKey}
              aria-label="字段名"
              value={field.key}
              onChange={(event) => changeField(field.id, {key: event.target.value})}
              placeholder="field_name"
            />
            <select
              className={styles.fieldType}
              aria-label="字段类型"
              value={field.type}
              onChange={(event) => changeField(field.id, {type: event.target.value as EditorField['type']})}>
              <option value="string">文本</option>
              <option value="number">数字</option>
              <option value="boolean">布尔</option>
              <option value="json">JSON</option>
              <option value="null">null</option>
            </select>
            {field.type === 'boolean' ? (
              <select
                className={styles.fieldValue}
                aria-label={`${field.key} 的值`}
                value={field.value}
                onChange={(event) => changeField(field.id, {value: event.target.value})}>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : field.type === 'json' ? field.key === 'list' && musicTags.length ? (
              <div className={styles.listFieldValue}>
                <textarea
                  className={styles.fieldValue}
                  aria-label={`${field.key} 的值`}
                  value={field.value}
                  onChange={(event) => changeField(field.id, {value: event.target.value})}
                  rows={3}
                />
                <div className={styles.listTagQuickPick}>
                  <span>快速选择</span>
                  <div>
                    {musicTags.map((tag) => {
                      const selected = parseListTagIds(field.value).includes(tag.id);
                      return (
                        <button
                          type="button"
                          key={tag.id}
                          className={selected ? styles.listTagSelected : styles.listTagButton}
                          aria-pressed={selected}
                          onClick={() => {
                            const current = parseListTagIds(field.value);
                            const next = selected
                              ? current.filter((id) => id !== tag.id)
                              : [...current, tag.id];
                            changeField(field.id, {value: JSON.stringify(next.sort((left, right) => left - right))});
                          }}>
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <small className={styles.listTagNames}>
                  当前标签：{(() => {
                    const ids = parseListTagIds(field.value);
                    return ids.length ? ids.map((id) => tagNames.get(id) || `未知标签 #${id}`).join(' · ') : '未设置';
                  })()}
                </small>
              </div>
            ) : (
              <textarea
                className={styles.fieldValue}
                aria-label={`${field.key} 的值`}
                value={field.value}
                onChange={(event) => changeField(field.id, {value: event.target.value})}
                rows={3}
              />
            ) : (
              <input
                className={styles.fieldValue}
                aria-label={`${field.key} 的值`}
                value={field.value}
                disabled={field.type === 'null'}
                onChange={(event) => changeField(field.id, {value: event.target.value})}
              />
            )}
            <button
              type="button"
              className={styles.removeField}
              onClick={() => setFields((current) => current.filter((item) => item.id !== field.id))}
              aria-label={`删除 ${field.key || '字段'}`}>
              <Icon icon="lucide:trash-2" />
            </button>
          </div>
        ))}
      </div>
      {error ? <div className={styles.inlineError}>{error}</div> : null}
      <div className={styles.editorActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setFields((current) => [...current, {
            id: `${Date.now()}-${Math.random()}`,
            key: '',
            type: 'string',
            value: '',
          }])}>
          <Icon icon="lucide:plus" />
          添加字段
        </button>
        <button type="submit" className={styles.primaryButton} disabled={!fields.length}>
          <Icon icon="lucide:check" />
          应用到数据表
        </button>
      </div>
    </form>
  );
}

function DataConsole({repository}: {repository: string | null}) {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [dataset, setDataset] = useState<DatasetPayload | null>(null);
  const [records, setRecords] = useState<JsonRecord[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [musicTags, setMusicTags] = useState<MusicTag[]>([]);
  const [tagFilter, setTagFilter] = useState<number | 'all'>('all');
  const [syncMusicLists, setSyncMusicLists] = useState(true);
  const [draggingPlaylistTagId, setDraggingPlaylistTagId] = useState<number | null>(null);
  const [dragOverPlaylistTagId, setDragOverPlaylistTagId] = useState<number | null>(null);

  const supportsTagFilter = selectedName === 'music_hq' || selectedName === 'music_sq';
  const supportsPlaylistTagOrdering = selectedName === 'music_tag';

  const loadDataset = async (name: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    setSelectedIndex(null);
    setCreating(false);
    try {
      const tagRequest = (name === 'music_hq' || name === 'music_sq')
        ? consoleApi<DatasetPayload>('/api/console/dataset?name=music_tag')
        : Promise.resolve(null);
      const [data, tagDataset] = await Promise.all([
        consoleApi<DatasetPayload>(`/api/console/dataset?name=${encodeURIComponent(name)}`),
        tagRequest,
      ]);
      setDataset(data);
      setRecords(data.records);
      setMusicTags((tagDataset?.records || [])
        .map((record) => ({
          id: Number(record.tag_id),
          name: String(record.tag_name || ''),
          order: Number(record.tag_order) || 0,
        }))
        .filter((tag) => Number.isInteger(tag.id) && tag.id >= 0 && tag.name)
        .sort((left, right) => left.order - right.order || left.id - right.id));
      setTagFilter('all');
      setDirty(false);
      setPage(0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '无法读取数据表。');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void consoleApi<{datasets: DatasetInfo[]}>('/api/console/datasets')
      .then(({datasets: values}) => {
        setDatasets(values);
        if (values[0]) setSelectedName(values[0].name);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : '无法读取数据表列表。'));
  }, []);

  useEffect(() => {
    if (selectedName) void loadDataset(selectedName);
  }, [selectedName]);

  const filteredIndexes = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase();
    return records
      .map((record, index) => ({record, index}))
      .filter(({record}) => {
        if (supportsTagFilter && tagFilter !== 'all') {
          const tags = Array.isArray(record.list) ? record.list.map(Number) : [];
          if (!tags.includes(tagFilter)) return false;
        }
        return !keyword || JSON.stringify(record).toLocaleLowerCase().includes(keyword);
      })
      .map(({index}) => index);
  }, [records, search, supportsTagFilter, tagFilter]);
  const pageSize = 36;
  const pageCount = Math.max(1, Math.ceil(filteredIndexes.length / pageSize));
  const visibleIndexes = filteredIndexes.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    setPage(0);
  }, [search, tagFilter]);

  const playlistTagOrder = useMemo<PlaylistTagOrderItem[]>(() => records
    .map((record) => ({
      id: Number(record.tag_id),
      name: String(record.tag_name || '').trim(),
      order: Number(record.tag_order),
    }))
    .filter((tag) => Number.isInteger(tag.id) && tag.id >= 0 && tag.name && Number.isFinite(tag.order))
    .sort((left, right) => left.order - right.order || left.id - right.id), [records]);

  const applyPlaylistTagOrder = (ordered: PlaylistTagOrderItem[]) => {
    const nextOrders = new Map(ordered.map((tag, index) => [tag.id, index + 1]));
    setRecords((current) => current.map((record) => {
      const nextOrder = nextOrders.get(Number(record.tag_id));
      return nextOrder === undefined || Number(record.tag_order) === nextOrder
        ? record
        : {...record, tag_order: nextOrder};
    }));
    setDirty(true);
    setNotice('歌单显示顺序已在页面中调整，提交数据表后才会写入仓库。');
  };

  const movePlaylistTag = (tagId: number, position: number) => {
    const sourceIndex = playlistTagOrder.findIndex((tag) => tag.id === tagId);
    if (sourceIndex < 0) return;
    const targetIndex = Math.max(0, Math.min(playlistTagOrder.length - 1, Math.round(position) - 1));
    if (sourceIndex === targetIndex) return;
    const ordered = playlistTagOrder.slice();
    const [tag] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, tag);
    applyPlaylistTagOrder(ordered);
  };

  const chooseDataset = (name: string) => {
    if (name === selectedName) return;
    if (dirty && !window.confirm('当前数据表有未提交的修改，确定放弃吗？')) return;
    setSelectedName(name);
  };

  const applyRecord = (record: JsonRecord) => {
    if (creating || selectedIndex === null) {
      setRecords((current) => [...current, record]);
      setSelectedIndex(records.length);
      setCreating(false);
    } else {
      setRecords((current) => current.map((item, index) => index === selectedIndex ? record : item));
    }
    setDirty(true);
    setNotice('修改已保留在页面中，提交数据表后才会写入仓库。');
  };

  const deleteRecord = () => {
    if (selectedIndex === null || !window.confirm('确定删除当前表项吗？')) return;
    setRecords((current) => current.filter((_, index) => index !== selectedIndex));
    setSelectedIndex(null);
    setDirty(true);
  };

  const commitRecords = async () => {
    if (!dataset || !dirty) return;
    setBusy(true);
    setError('');
    try {
      const result = await consoleApi<{commitSha: string; commitUrl: string; count: number; syncedCount?: number; unmatchedCount?: number}>('/api/console/dataset', {
        method: 'POST',
        body: JSON.stringify({
          name: dataset.name,
          operation: 'replace',
          records,
          baseHeadSha: dataset.headSha,
          syncMusicLists: supportsTagFilter && syncMusicLists,
          message: supportsTagFilter && syncMusicLists
            ? `音乐：通过控制台更新 ${dataset.label} 并同步另一音质的歌单标签`
            : `数据：通过控制台编辑 ${dataset.label}`,
        }),
      });
      await loadDataset(dataset.name);
      const syncNotice = supportsTagFilter && syncMusicLists
        ? `；已同步另一音质的 ${result.syncedCount || 0} 条标签设置${result.unmatchedCount ? `，另有 ${result.unmatchedCount} 条曲目未找到对应项` : ''}`
        : '';
      setNotice(`已创建提交 ${result.commitSha.slice(0, 8)}${syncNotice}。GitHub Actions 将继续构建和部署。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '提交数据表失败。');
    } finally {
      setBusy(false);
    }
  };

  const importRecords = async () => {
    if (!dataset) return;
    setError('');
    if (dirty) {
      setError('当前数据表有未提交的手动修改，请先提交或重新加载后再批量导入。');
      return;
    }
    let imported: JsonRecord[];
    try {
      imported = parseImportedRecords(importText);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入内容无效。');
      return;
    }
    if (importMode === 'replace' && !window.confirm(`将使用 ${imported.length} 条记录覆盖整个数据表，是否继续？`)) return;
    setBusy(true);
    try {
      const result = await consoleApi<{commitSha: string; count: number}>('/api/console/dataset', {
        method: 'POST',
        body: JSON.stringify({
          name: dataset.name,
          operation: importMode,
          records: imported,
          baseHeadSha: dataset.headSha,
          message: `数据：通过 JSON ${importMode === 'append' ? '新增' : '覆盖'} ${dataset.label}`,
        }),
      });
      setImportText('');
      await loadDataset(dataset.name);
      setNotice(`已写入 ${result.count} 条记录，提交编号为 ${result.commitSha.slice(0, 8)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.workspaceGrid}>
      <aside className={styles.datasetSidebar}>
        <div className={styles.sidebarTitle}>
          <span>数据表</span>
          <small>{datasets.length}</small>
        </div>
        {datasets.map((item) => (
          <button
            type="button"
            key={item.name}
            className={item.name === selectedName ? styles.datasetActive : styles.datasetButton}
            onClick={() => chooseDataset(item.name)}>
            <Icon icon={item.name.startsWith('mv') ? 'lucide:clapperboard' : 'lucide:music-2'} />
            <span>{item.label}<small>{item.path}</small></span>
          </button>
        ))}
      </aside>

      <section className={styles.dataWorkspace}>
        <div className={styles.workspaceHeader}>
          <div>
            <span className={styles.eyebrow}>DATABASE</span>
            <h2>{dataset?.label || '正在读取数据表'}</h2>
            <p>{dataset ? `${records.length} 条记录 · ${dataset.path}` : '从 GitHub 仓库读取'}</p>
          </div>
          <div className={styles.headerActions}>
            {supportsTagFilter ? (
              <label className={styles.musicListSyncControl} title="提交当前 HQ 或 SQ 表时，同时将每首歌的 list 标签写入另一份音质资料">
                <input
                  type="checkbox"
                  checked={syncMusicLists}
                  onChange={(event) => setSyncMusicLists(event.target.checked)}
                />
                同步 HQ/SQ 标签
              </label>
            ) : null}
            <button type="button" className={styles.secondaryButton} onClick={() => { setCreating(true); setSelectedIndex(null); }} disabled={!dataset || busy}>
              <Icon icon="lucide:plus" />
              新增表项
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => void commitRecords()} disabled={!dirty || busy}>
              <Icon icon="lucide:git-commit-horizontal" />
              提交数据表
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

        <div className={styles.recordToolbar}>
          <label className={styles.searchBox}>
            <Icon icon="lucide:search" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索当前数据表" />
          </label>
          <span>{filteredIndexes.length} 条匹配</span>
          {dirty ? <strong className={styles.dirtyMark}>有未提交修改</strong> : null}
        </div>

        {supportsTagFilter ? (
          <div className={styles.tagFilterBar} aria-label="按歌单标签筛选">
            <span>歌单标签</span>
            <button
              type="button"
              className={tagFilter === 'all' ? styles.tagFilterActive : styles.tagFilterButton}
              onClick={() => setTagFilter('all')}>
              全部
            </button>
            {musicTags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                className={tagFilter === tag.id ? styles.tagFilterActive : styles.tagFilterButton}
                onClick={() => setTagFilter(tag.id)}>
                {tag.name}
              </button>
            ))}
          </div>
        ) : null}

        {supportsPlaylistTagOrdering ? (
          <section className={styles.playlistTagOrderPanel} aria-labelledby="playlist-tag-order-title">
            <div className={styles.playlistTagOrderHeading}>
              <div>
                <span className={styles.eyebrow}>PLAYLIST ORDER</span>
                <h3 id="playlist-tag-order-title">歌单显示顺序</h3>
                <p>拖动标签调整位置，或直接输入“第几位”。保存时会自动重编号为连续整数。</p>
              </div>
              <span>{playlistTagOrder.length} 个公开歌单</span>
            </div>
            <div className={styles.playlistTagOrderList}>
              {playlistTagOrder.map((tag, index) => {
                const isDragging = draggingPlaylistTagId === tag.id;
                const isDragTarget = dragOverPlaylistTagId === tag.id && !isDragging;
                return (
                  <div
                    className={`${styles.playlistTagOrderItem}${isDragging ? ` ${styles.playlistTagOrderDragging}` : ''}${isDragTarget ? ` ${styles.playlistTagOrderDropTarget}` : ''}`}
                    key={tag.id}
                    draggable={!busy}
                    onDragStart={(event) => {
                      setDraggingPlaylistTagId(tag.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(tag.id));
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      if (dragOverPlaylistTagId !== tag.id) setDragOverPlaylistTagId(tag.id);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const rawId = event.dataTransfer.getData('text/plain');
                      const transferredId = rawId ? Number(rawId) : Number.NaN;
                      const sourceId = Number.isInteger(transferredId) ? transferredId : draggingPlaylistTagId;
                      if (sourceId !== null) movePlaylistTag(sourceId, index + 1);
                      setDraggingPlaylistTagId(null);
                      setDragOverPlaylistTagId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingPlaylistTagId(null);
                      setDragOverPlaylistTagId(null);
                    }}>
                    <Icon className={styles.playlistTagOrderGrip} icon="lucide:grip-vertical" aria-hidden="true" />
                    <span className={styles.playlistTagOrderName} title={tag.name}>{tag.name}</span>
                    <label className={styles.playlistTagOrderInput}>
                      <span className={styles.visuallyHidden}>{tag.name} 的显示位置</span>
                      <input
                        type="number"
                        min="1"
                        max={playlistTagOrder.length}
                        value={index + 1}
                        disabled={busy}
                        onChange={(event) => {
                          const nextPosition = Number(event.target.value);
                          if (Number.isInteger(nextPosition) && nextPosition >= 1) movePlaylistTag(tag.id, nextPosition);
                        }}
                        aria-label={`${tag.name} 的显示位置`}
                      />
                      <span>位</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className={styles.recordList} aria-busy={busy}>
          {visibleIndexes.map((index) => {
            const record = records[index];
            return (
              <button
                type="button"
                key={`${index}-${String(record.objectId || record.mid || record.mv_id || '')}`}
                className={selectedIndex === index ? styles.recordActive : styles.recordButton}
                onClick={() => { setSelectedIndex(index); setCreating(false); }}>
                <span className={styles.recordNumber}>{index + 1}</span>
                <span className={styles.recordText}>
                  <strong>{recordTitle(record, index)}</strong>
                  <small>{Object.entries(record).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</small>
                </span>
                <Icon icon="lucide:chevron-right" />
              </button>
            );
          })}
          {!busy && visibleIndexes.length === 0 ? <div className={styles.emptyState}>没有匹配的表项。</div> : null}
          {busy ? <div className={styles.loadingState}><Icon icon="lucide:loader-circle" />正在处理…</div> : null}
        </div>
        <div className={styles.pagination}>
          <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} aria-label="上一页"><Icon icon="lucide:chevron-left" /></button>
          <span>{page + 1} / {pageCount}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} disabled={page >= pageCount - 1} aria-label="下一页"><Icon icon="lucide:chevron-right" /></button>
        </div>

        {(creating || selectedIndex !== null) ? (
          <RecordEditor
            key={creating ? 'new' : `edit-${selectedIndex}-${JSON.stringify(records[selectedIndex as number])}`}
            record={creating ? {} : records[selectedIndex as number]}
            mode={creating ? 'new' : 'edit'}
            musicTags={supportsTagFilter ? musicTags : []}
            onApply={applyRecord}
            onCancel={() => { setCreating(false); setSelectedIndex(null); }}
          />
        ) : null}

        {selectedIndex !== null && !creating ? (
          <button type="button" className={styles.dangerButton} onClick={deleteRecord}>
            <Icon icon="lucide:trash-2" />
            删除当前表项
          </button>
        ) : null}

        <section className={styles.importPanel}>
          <div>
            <span className={styles.eyebrow}>JSON IMPORT</span>
            <h3>JSON 批量导入</h3>
            <p>支持对象、对象数组和每行一个对象的 JSONL 文件。</p>
          </div>
          <div className={styles.importControls}>
            <label><input type="radio" checked={importMode === 'append'} onChange={() => setImportMode('append')} /> 新增到原表</label>
            <label><input type="radio" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} /> 覆盖原表</label>
            <label className={styles.filePicker}>
              <Icon icon="lucide:upload" />
              选择 JSON / JSONL
              <input
                type="file"
                accept=".json,.jsonl,application/json,text/plain"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void file.text().then(setImportText);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
          <textarea
            className={styles.importTextarea}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={'[\n  {"title": "..."}\n]'}
            rows={10}
          />
          <button type="button" className={styles.primaryButton} onClick={() => void importRecords()} disabled={!importText.trim() || !dataset || busy}>
            <Icon icon="lucide:database-backup" />
            {importMode === 'append' ? '导入并新增' : '导入并覆盖'}
          </button>
        </section>
      </section>
    </div>
  );
}

function ArticleConsole({initialPath, repository}: {initialPath: string; repository: string | null}) {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [content, setContent] = useState('');
  const [baseline, setBaseline] = useState('');
  const [headSha, setHeadSha] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = content !== baseline;

  const loadFile = async (path: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await consoleApi<{path: string; content: string; headSha: string}>(`/api/console/file?path=${encodeURIComponent(path)}`);
      setSelectedPath(data.path);
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
    void consoleApi<{files: string[]}>('/api/console/files')
      .then(({files: values}) => {
        setFiles(values);
        const target = initialPath && values.includes(initialPath) ? initialPath : values[0];
        if (target) void loadFile(target);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : '无法读取文章列表。'));
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
    if (path === selectedPath) return;
    if (dirty && !window.confirm('当前文章有未提交的修改，确定放弃吗？')) return;
    void loadFile(path);
  };

  const save = async () => {
    if (!selectedPath || !dirty) return;
    setBusy(true);
    setError('');
    try {
      const result = await consoleApi<{commitSha: string}>('/api/console/file', {
        method: 'POST',
        body: JSON.stringify({path: selectedPath, content, baseHeadSha: headSha, message}),
      });
      await loadFile(selectedPath);
      setNotice(`文章已写入仓库，提交编号为 ${result.commitSha.slice(0, 8)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '文章提交失败。');
    } finally {
      setBusy(false);
    }
  };

  const visibleFiles = files.filter((path) => path.toLocaleLowerCase().includes(filter.toLocaleLowerCase()));

  return (
    <div className={styles.articleGrid}>
      <aside className={styles.fileSidebar}>
        <label className={styles.searchBox}>
          <Icon icon="lucide:search" />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="搜索文章文件" />
        </label>
        <div className={styles.fileList}>
          {visibleFiles.map((path) => (
            <button type="button" key={path} className={path === selectedPath ? styles.fileActive : styles.fileButton} onClick={() => chooseFile(path)}>
              <Icon icon="lucide:file-text" />
              <span>{path.split('/').pop()}<small>{path}</small></span>
            </button>
          ))}
        </div>
      </aside>
      <section className={styles.articleEditor}>
        <div className={styles.workspaceHeader}>
          <div>
            <span className={styles.eyebrow}>MARKDOWN EDITOR</span>
            <h2>{selectedPath ? selectedPath.split('/').pop() : '选择文章'}</h2>
            <p>{selectedPath || '从左侧列表选择 Markdown 文件'}</p>
          </div>
          <button type="button" className={styles.primaryButton} onClick={() => void save()} disabled={!dirty || busy}>
            <Icon icon="lucide:git-commit-horizontal" />
            提交文章
          </button>
        </div>
        {error ? <div className={styles.errorBanner}><Icon icon="lucide:circle-alert" />{error}</div> : null}
        {notice ? (
          <div className={styles.noticeBanner}>
            <Icon icon="lucide:circle-check" />
            <span>{notice} GitHub Actions 将继续构建和部署。</span>
            {repository ? <a href={`https://github.com/${repository}/actions`} target="_blank" rel="noreferrer">查看 Actions</a> : null}
          </div>
        ) : null}
        <textarea
          className={styles.markdownEditor}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          spellCheck={false}
          aria-label="Markdown 源文件"
          disabled={!selectedPath || busy}
        />
        <div className={styles.commitRow}>
          <label>
            <span>提交说明</span>
            <input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} />
          </label>
          <span className={dirty ? styles.dirtyMark : styles.savedMark}>{dirty ? '有未提交修改' : '已与仓库同步'}</span>
        </div>
      </section>
    </div>
  );
}

export default function AdminPage() {
  const {authenticated, loading, user, repository} = useAdminSession();
  const location = useLocation();
  const initialPath = new URLSearchParams(location.search).get('file')?.replace(/^@site\//, '') || '';
  const [tab, setTab] = useState<'data' | 'articles'>(initialPath ? 'articles' : 'data');

  if (loading) {
    return (
      <Layout title="管理控制台">
        <main className={styles.centerState}><Icon icon="lucide:loader-circle" />正在验证 GitHub 登录状态…</main>
      </Layout>
    );
  }

  if (!authenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Layout title="管理控制台">
        <main className={styles.loginCard}>
          <div className={styles.loginIcon}><Icon icon="mdi:github" /></div>
          <span className={styles.eyebrow}>OWNER CONSOLE</span>
          <h1>博客管理控制台</h1>
          <p>请使用 blog 仓库所有者的 GitHub 账号登录。认证成功后才能读写数据和文章。</p>
          <a className={styles.loginButton} href={`/api/console/login?returnTo=${encodeURIComponent(returnTo)}`}>
            <Icon icon="mdi:github" />
            使用 GitHub 登录
          </a>
          <Link to="/">返回博客</Link>
        </main>
      </Layout>
    );
  }

  return (
    <Layout title="管理控制台" description="管理音乐、MV 数据和博客文章">
      <main className={styles.adminPage}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>OWNER CONSOLE</span>
            <h1>博客管理控制台</h1>
            <p>所有修改直接产生 Git 提交，提交后由 GitHub Actions 构建并部署。</p>
          </div>
          <div className={styles.userBadge}>
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
            <span><strong>{user?.login}</strong><small>{repository}</small></span>
          </div>
        </header>
        <nav className={styles.tabs} aria-label="控制台分类">
          <button type="button" className={tab === 'data' ? styles.tabActive : styles.tab} onClick={() => setTab('data')}>
            <Icon icon="lucide:database" />
            音乐与 MV 数据
          </button>
          <button type="button" className={tab === 'articles' ? styles.tabActive : styles.tab} onClick={() => setTab('articles')}>
            <Icon icon="lucide:files" />
            文章编辑
          </button>
        </nav>
        {tab === 'data'
          ? <DataConsole repository={repository} />
          : <ArticleConsole initialPath={initialPath} repository={repository} />}
      </main>
    </Layout>
  );
}
