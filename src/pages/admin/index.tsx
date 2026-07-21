import React, {useEffect, useMemo, useRef, useState} from 'react';
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
  totalCount: number;
  page: number;
  pageSize: number;
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
type MusicOrderItem = {
  mid: number;
  title: string;
};
type DatasetSort = 'id' | 'list_order';
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

const DATASET_ID_FIELDS: Record<string, string> = {
  music_hq: 'mid',
  music_sq: 'mid',
  music_tag: 'tag_id',
  mv: 'mv_id',
  mv_bilibili: 'mv_id',
  mv_class: 'list',
  mv_out: 'mv_id',
};

function datasetRecordId(name: string, record: JsonRecord): string | number | null {
  const field = DATASET_ID_FIELDS[name];
  const value = field ? record[field] : undefined;
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
}

function datasetRecordKey(name: string, record: JsonRecord): string | null {
  const value = datasetRecordId(name, record);
  return value === null ? null : String(value);
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
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [datasetSort, setDatasetSort] = useState<DatasetSort>('id');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [musicTags, setMusicTags] = useState<MusicTag[]>([]);
  const [tagFilter, setTagFilter] = useState<number | 'all'>('all');
  const [syncMusicLists, setSyncMusicLists] = useState(true);
  const [pendingUpserts, setPendingUpserts] = useState<Record<string, JsonRecord>>({});
  const [pendingDeletes, setPendingDeletes] = useState<Array<string | number>>([]);
  const [draggingPlaylistTagId, setDraggingPlaylistTagId] = useState<number | null>(null);
  const [dragOverPlaylistTagId, setDragOverPlaylistTagId] = useState<number | null>(null);
  const [musicOrderMode, setMusicOrderMode] = useState(false);
  const [musicOrder, setMusicOrder] = useState<MusicOrderItem[]>([]);
  const [musicOrderHeadSha, setMusicOrderHeadSha] = useState('');
  const [musicOrderBusy, setMusicOrderBusy] = useState(false);
  const [draggingMusicId, setDraggingMusicId] = useState<number | null>(null);
  const [dragOverMusicId, setDragOverMusicId] = useState<number | null>(null);
  const loadRequestId = useRef(0);
  const musicOrderRequestId = useRef(0);

  const supportsTagFilter = selectedName === 'music_hq' || selectedName === 'music_sq';
  const supportsPlaylistTagOrdering = selectedName === 'music_tag';

  const pageSize = selectedName === 'music_tag' ? 200 : 36;

  useEffect(() => {
    musicOrderRequestId.current += 1;
    setMusicOrderMode(false);
    setMusicOrder([]);
    setMusicOrderHeadSha('');
    setMusicOrderBusy(false);
  }, [selectedName, tagFilter]);

  const loadDataset = async (name: string, ignorePending = false) => {
    const requestId = ++loadRequestId.current;
    setBusy(true);
    setError('');
    setSelectedIndex(null);
    setCreating(false);
    try {
      const params = new URLSearchParams({
        name,
        page: String(page),
        pageSize: String(name === 'music_tag' ? 200 : pageSize),
        query: search,
        sort: supportsTagFilter && tagFilter !== 'all' ? datasetSort : 'id',
      });
      if (supportsTagFilter && tagFilter !== 'all') params.set('tagId', String(tagFilter));
      const data = await consoleApi<DatasetPayload>(`/api/console/dataset?${params.toString()}`);
      if (requestId !== loadRequestId.current) return;
      setDataset(data);
      if (ignorePending) {
        setRecords(data.records);
      } else {
        const deleted = new Set(pendingDeletes.map((value) => String(Number(value))));
        setRecords(data.records
          .filter((record) => {
            const key = datasetRecordKey(name, record);
            return key === null || !deleted.has(key);
          })
          .map((record) => {
            const key = datasetRecordKey(name, record);
            return key && pendingUpserts[key] ? pendingUpserts[key] : record;
          }));
      }
    } catch (caught) {
      if (requestId === loadRequestId.current) {
        setError(caught instanceof Error ? caught.message : '无法读取数据表。');
      }
    } finally {
      if (requestId === loadRequestId.current) setBusy(false);
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
  }, [selectedName, page, search, tagFilter, datasetSort]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 320);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!supportsTagFilter) {
      setMusicTags([]);
      return;
    }
    let active = true;
    void consoleApi<DatasetPayload>('/api/console/dataset?name=music_tag&page=0&pageSize=200')
      .then((tagDataset) => {
        if (!active) return;
        setMusicTags(tagDataset.records
          .map((record) => ({
            id: Number(record.tag_id),
            name: String(record.tag_name || ''),
            order: Number(record.tag_order) || 0,
          }))
          .filter((tag) => Number.isInteger(tag.id) && tag.id >= 0 && tag.name)
          .sort((left, right) => left.order - right.order || left.id - right.id));
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : '无法读取歌单标签。');
      });
    return () => { active = false; };
  }, [supportsTagFilter]);

  const pageCount = Math.max(1, Math.ceil((dataset?.count || 0) / (dataset?.pageSize || pageSize)));

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
    setRecords((current) => {
      const nextRecords = current.map((record) => {
        const nextOrder = nextOrders.get(Number(record.tag_id));
        return nextOrder === undefined || Number(record.tag_order) === nextOrder
          ? record
          : {...record, tag_order: nextOrder};
      });
      setPendingUpserts((pending) => {
        const next = {...pending};
        nextRecords.forEach((record) => {
          const key = datasetRecordKey('music_tag', record);
          if (key) next[key] = record;
        });
        return next;
      });
      return nextRecords;
    });
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
    setDataset(null);
    setRecords([]);
    setPendingUpserts({});
    setPendingDeletes([]);
    setDirty(false);
    setSearchInput('');
    setSearch('');
    setPage(0);
    setTagFilter('all');
    setDatasetSort('id');
    setMusicOrderMode(false);
    setMusicOrder([]);
    setSelectedName(name);
  };

  const applyRecord = (record: JsonRecord) => {
    const key = datasetRecordKey(selectedName, record);
    if (!key) {
      setError(`表项必须包含 ${DATASET_ID_FIELDS[selectedName] || '唯一编号'}。`);
      return;
    }
    const previous = selectedIndex === null ? null : records[selectedIndex];
    const previousId = previous ? datasetRecordId(selectedName, previous) : null;
    const previousKey = previous ? datasetRecordKey(selectedName, previous) : null;
    if (previousKey && previousKey !== key && previousId !== null) {
      setPendingDeletes((current) => [...current.filter((id) => `${typeof id}:${String(id)}` !== previousKey), previousId]);
      setPendingUpserts((current) => {
        const next = {...current};
        delete next[previousKey];
        next[key] = record;
        return next;
      });
    } else {
      setPendingUpserts((current) => ({...current, [key]: record}));
    }
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
    const record = records[selectedIndex];
    const id = datasetRecordId(selectedName, record);
    const key = datasetRecordKey(selectedName, record);
    if (id === null || key === null) {
      setError('当前表项缺少唯一编号，无法安全删除。');
      return;
    }
    setPendingDeletes((current) => [...current.filter((item) => String(Number(item)) !== key), id]);
    setPendingUpserts((current) => {
      const next = {...current};
      delete next[key];
      return next;
    });
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
          operation: 'patch',
          records: Object.values(pendingUpserts),
          deleteIds: pendingDeletes,
          baseHeadSha: dataset.headSha,
          syncMusicLists: supportsTagFilter && syncMusicLists,
          message: supportsTagFilter && syncMusicLists
            ? `音乐：通过控制台更新 ${dataset.label} 并同步另一音质的歌单标签`
            : `数据：通过控制台编辑 ${dataset.label}`,
        }),
      });
      setPendingUpserts({});
      setPendingDeletes([]);
      setDirty(false);
      await loadDataset(dataset.name, true);
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
      await loadDataset(dataset.name, true);
      setNotice(`已写入 ${result.count} 条记录，提交编号为 ${result.commitSha.slice(0, 8)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '导入失败。');
    } finally {
      setBusy(false);
    }
  };

  const loadMusicOrder = async () => {
    if (!dataset || !supportsTagFilter || tagFilter === 'all') return;
    const requestId = ++musicOrderRequestId.current;
    const requestedDataset = dataset.name;
    const requestedTag = tagFilter;
    setMusicOrderBusy(true);
    setError('');
    try {
      const requestPage = (targetPage: number) => {
        const params = new URLSearchParams({
          name: requestedDataset,
          page: String(targetPage),
          pageSize: '200',
          tagId: String(requestedTag),
          sort: 'list_order',
        });
        return consoleApi<DatasetPayload>(`/api/console/dataset?${params.toString()}`);
      };
      const first = await requestPage(0);
      if (requestId !== musicOrderRequestId.current) return;
      const remainingPages = Math.ceil(first.count / first.pageSize);
      const rest = remainingPages > 1
        ? await Promise.all(Array.from({length: remainingPages - 1}, (_, index) => requestPage(index + 1)))
        : [];
      if (requestId !== musicOrderRequestId.current) return;
      if (first.name !== requestedDataset || rest.some((part) => part.name !== requestedDataset || part.headSha !== first.headSha)) {
        throw new Error('读取期间仓库资料发生变化，请重新打开顺序编辑。');
      }
      const seen = new Set<number>();
      const ordered = [first, ...rest]
        .flatMap((part) => part.records)
        .map((record) => ({mid: Number(record.mid), title: String(record.title || `MID ${String(record.mid)}`)}))
        .filter((item) => {
          if (!Number.isInteger(item.mid) || item.mid < 0 || seen.has(item.mid)) return false;
          seen.add(item.mid);
          return true;
        });
      setMusicOrder(ordered);
      setMusicOrderHeadSha(first.headSha);
      setMusicOrderMode(true);
    } catch (caught) {
      if (requestId === musicOrderRequestId.current) {
        setError(caught instanceof Error ? caught.message : '无法读取歌单顺序。');
      }
    } finally {
      if (requestId === musicOrderRequestId.current) setMusicOrderBusy(false);
    }
  };

  const moveMusic = (mid: number, position: number) => {
    setMusicOrder((current) => {
      const sourceIndex = current.findIndex((item) => item.mid === mid);
      if (sourceIndex < 0) return current;
      const targetIndex = Math.max(0, Math.min(current.length - 1, Math.round(position) - 1));
      if (sourceIndex === targetIndex) return current;
      const next = current.slice();
      const [item] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  };

  const saveMusicOrder = async () => {
    if (!dataset || tagFilter === 'all' || !musicOrder.length) return;
    const requestId = ++musicOrderRequestId.current;
    const requestedDataset = dataset.name;
    const requestedTag = tagFilter;
    const requestedMids = musicOrder.map((item) => item.mid);
    const baseHeadSha = musicOrderHeadSha || dataset.headSha;
    setMusicOrderBusy(true);
    setError('');
    try {
      const result = await consoleApi<{commitSha: string; count: number}>('/api/console/music-order', {
        method: 'POST',
        body: JSON.stringify({
          tagId: requestedTag,
          mids: requestedMids,
          baseHeadSha,
          message: `音乐：通过控制台调整歌单「${musicTags.find((tag) => tag.id === requestedTag)?.name || requestedTag}」的曲目顺序`,
        }),
      });
      if (requestId !== musicOrderRequestId.current) return;
      setMusicOrderMode(false);
      setMusicOrder([]);
      setMusicOrderHeadSha('');
      await loadDataset(requestedDataset, true);
      setNotice(`歌单顺序已保存，提交编号为 ${result.commitSha.slice(0, 8)}。`);
    } catch (caught) {
      if (requestId === musicOrderRequestId.current) {
        setError(caught instanceof Error ? caught.message : '保存歌单顺序失败。');
      }
    } finally {
      if (requestId === musicOrderRequestId.current) setMusicOrderBusy(false);
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
            <p>{dataset ? `${dataset.totalCount} 条记录 · 当前仅加载 ${records.length} 条 · ${dataset.path}` : '从 GitHub 仓库读取'}</p>
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
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="搜索数据表" />
          </label>
          {supportsTagFilter ? (
            <label className={styles.sortControl}>
              <span>排序</span>
              <select
                value={tagFilter === 'all' ? 'id' : datasetSort}
                onChange={(event) => {
                  setPage(0);
                  setDatasetSort(event.target.value as DatasetSort);
                }}>
                <option value="id">按 MID</option>
                <option value="list_order" disabled={tagFilter === 'all'}>按歌单内顺序</option>
              </select>
            </label>
          ) : null}
          <span>{dataset?.count || 0} 条匹配</span>
          {dirty ? <strong className={styles.dirtyMark}>有未提交修改</strong> : null}
        </div>

        {supportsTagFilter ? (
          <div className={styles.tagFilterBar} aria-label="按歌单标签筛选">
            <span>歌单标签</span>
            <button
              type="button"
              className={tagFilter === 'all' ? styles.tagFilterActive : styles.tagFilterButton}
              onClick={() => {
                setPage(0);
                setTagFilter('all');
                setDatasetSort('id');
                setMusicOrderMode(false);
                setMusicOrder([]);
              }}>
              全部
            </button>
            {musicTags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                className={tagFilter === tag.id ? styles.tagFilterActive : styles.tagFilterButton}
                onClick={() => {
                  setPage(0);
                  setTagFilter(tag.id);
                  setMusicOrderMode(false);
                  setMusicOrder([]);
                }}>
                {tag.name}
              </button>
            ))}
          </div>
        ) : null}

        {supportsTagFilter && tagFilter !== 'all' ? (
          <div className={styles.musicOrderToolbar}>
            <div>
              <strong>{musicTags.find((tag) => tag.id === tagFilter)?.name || `歌单 #${tagFilter}`}</strong>
              <span>{datasetSort === 'list_order' ? '当前按歌单内顺序显示' : '当前按 MID 显示'}</span>
            </div>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={busy || musicOrderBusy || dirty}
              onClick={() => {
                if (musicOrderMode) {
                  setMusicOrderMode(false);
                  setMusicOrder([]);
                } else {
                  void loadMusicOrder();
                }
              }}>
              <Icon icon={musicOrderMode ? 'lucide:x' : 'lucide:list-ordered'} />
              {musicOrderMode ? '退出调序' : '调整歌单顺序'}
            </button>
          </div>
        ) : null}

        {musicOrderMode ? (
          <section className={styles.musicOrderPanel} aria-labelledby="music-order-title">
            <div className={styles.playlistTagOrderHeading}>
              <div>
                <span className={styles.eyebrow}>TRACK ORDER</span>
                <h3 id="music-order-title">歌单曲目顺序</h3>
                <p>拖动曲目或输入序号。这里只加载当前歌单，不会将整个音乐表载入浏览器。</p>
              </div>
              <span>{musicOrder.length} 首</span>
            </div>
            <div className={styles.musicOrderList} aria-busy={musicOrderBusy}>
              {musicOrder.map((item, index) => {
                const isDragging = draggingMusicId === item.mid;
                const isDragTarget = dragOverMusicId === item.mid && !isDragging;
                return (
                  <div
                    key={item.mid}
                    className={`${styles.musicOrderItem}${isDragging ? ` ${styles.playlistTagOrderDragging}` : ''}${isDragTarget ? ` ${styles.playlistTagOrderDropTarget}` : ''}`}
                    draggable={!musicOrderBusy}
                    onDragStart={(event) => {
                      setDraggingMusicId(item.mid);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(item.mid));
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      if (dragOverMusicId !== item.mid) setDragOverMusicId(item.mid);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const transferred = Number(event.dataTransfer.getData('text/plain'));
                      const sourceId = Number.isInteger(transferred) ? transferred : draggingMusicId;
                      if (sourceId !== null) moveMusic(sourceId, index + 1);
                      setDraggingMusicId(null);
                      setDragOverMusicId(null);
                    }}
                    onDragEnd={() => {
                      setDraggingMusicId(null);
                      setDragOverMusicId(null);
                    }}>
                    <Icon className={styles.playlistTagOrderGrip} icon="lucide:grip-vertical" aria-hidden="true" />
                    <span className={styles.musicOrderMid}>MID {item.mid}</span>
                    <span className={styles.playlistTagOrderName} title={item.title}>{item.title}</span>
                    <label className={styles.playlistTagOrderInput}>
                      <span className={styles.visuallyHidden}>{item.title} 的播放位置</span>
                      <input
                        type="number"
                        min="1"
                        max={musicOrder.length}
                        value={index + 1}
                        disabled={musicOrderBusy}
                        onChange={(event) => {
                          const position = Number(event.target.value);
                          if (Number.isInteger(position) && position >= 1) moveMusic(item.mid, position);
                        }}
                      />
                      <span>位</span>
                    </label>
                  </div>
                );
              })}
            </div>
            <div className={styles.musicOrderActions}>
              <button type="button" className={styles.secondaryButton} disabled={musicOrderBusy} onClick={() => { setMusicOrderMode(false); setMusicOrder([]); }}>取消</button>
              <button type="button" className={styles.primaryButton} disabled={musicOrderBusy || !musicOrder.length} onClick={() => void saveMusicOrder()}>
                <Icon icon="lucide:git-commit-horizontal" />
                保存歌单顺序
              </button>
            </div>
          </section>
        ) : null}

        {supportsPlaylistTagOrdering && !searchInput.trim() ? (
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
          {records.map((record, index) => {
            const absoluteIndex = page * (dataset?.pageSize || pageSize) + index;
            return (
              <button
                type="button"
                key={`${datasetRecordKey(selectedName, record) || index}`}
                className={selectedIndex === index ? styles.recordActive : styles.recordButton}
                onClick={() => { setSelectedIndex(index); setCreating(false); }}>
                <span className={styles.recordNumber}>{absoluteIndex + 1}</span>
                <span className={styles.recordText}>
                  <strong>{recordTitle(record, absoluteIndex)}</strong>
                  <small>{Object.entries(record).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</small>
                </span>
                <Icon icon="lucide:chevron-right" />
              </button>
            );
          })}
          {!busy && records.length === 0 ? <div className={styles.emptyState}>没有匹配的表项。</div> : null}
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
