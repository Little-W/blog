#!/usr/bin/env python3
"""Repair gaps in the music mid sequence without changing track metadata.

The two music datasets are treated as one table. Records are ordered by their
current mid, then renumbered from zero so HQ and SQ receive the same continuous
IDs. A preview is the default; ``--apply`` is required to rewrite JSONL.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


HEADER_PREFIX = '#filetype:JSON-streaming '


def read_jsonl(path: Path) -> tuple[str, list[dict[str, object]]]:
    lines = path.read_text(encoding='utf-8').splitlines()
    if not lines or not lines[0].startswith(HEADER_PREFIX):
        raise ValueError(f'缺少 JSON-streaming 文件头：{path}')
    records = [json.loads(line) for line in lines[1:] if line.strip()]
    if any(not isinstance(record, dict) for record in records):
        raise ValueError(f'存在非对象记录：{path}')
    return lines[0], records


def sort_and_validate(records: list[dict[str, object]], label: str) -> list[dict[str, object]]:
    mids = [record.get('mid') for record in records]
    if any(not isinstance(mid, int) or mid < 0 for mid in mids):
        raise ValueError(f'{label} 存在无效 mid。')
    if len(set(mids)) != len(mids):
        raise ValueError(f'{label} 存在重复 mid。')
    return sorted(records, key=lambda record: int(record['mid']))


def write_jsonl(path: Path, header: str, records: list[dict[str, object]]) -> None:
    payload = header + '\n' + '\n'.join(
        json.dumps(record, ensure_ascii=False, separators=(',', ':')) for record in records
    ) + '\n'
    path.write_text(payload, encoding='utf-8')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='将 HQ/SQ 音乐 mid 修复为连续编号。')
    parser.add_argument('--data-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'static/data')
    parser.add_argument('--apply', action='store_true', help='实际写回两个 JSONL；默认只预览。')
    parser.add_argument('--report', type=Path, help='写入修复映射报告。')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    hq_path = args.data_dir / 'music_hq.0.jsonl'
    sq_path = args.data_dir / 'music_sq.0.jsonl'
    hq_header, hq_records = read_jsonl(hq_path)
    sq_header, sq_records = read_jsonl(sq_path)
    hq_sorted = sort_and_validate(hq_records, 'music_hq')
    sq_sorted = sort_and_validate(sq_records, 'music_sq')

    hq_ids = {int(record['mid']) for record in hq_sorted}
    sq_ids = {int(record['mid']) for record in sq_sorted}
    if hq_ids != sq_ids:
        raise ValueError('HQ/SQ 的 mid 集合不一致，拒绝自动重编号。')
    if len(hq_sorted) != len(sq_sorted):
        raise ValueError('HQ/SQ 记录数量不一致，拒绝自动重编号。')

    target_ids = list(range(len(hq_sorted)))
    mapping = {int(record['mid']): target for record, target in zip(hq_sorted, target_ids)}
    changed = {old: new for old, new in mapping.items() if old != new}
    hq_new = [dict(record, mid=mapping[int(record['mid'])]) for record in hq_sorted]
    sq_new = [dict(record, mid=mapping[int(record['mid'])]) for record in sq_sorted]

    result = {
        'record_count': len(hq_new),
        'old_min': min(mapping, default=None),
        'old_max': max(mapping, default=None),
        'new_min': 0 if mapping else None,
        'new_max': len(mapping) - 1 if mapping else None,
        'changed_count': len(changed),
        'changed_mid': changed,
        'applied': bool(args.apply),
    }
    print(f'记录数：{len(hq_new)}；原范围：{result["old_min"]}–{result["old_max"]}；新范围：0–{result["new_max"]}')
    print(f'需要重编号：{len(changed)} 条。')
    if changed:
        preview = list(changed.items())[:12]
        print('映射预览：' + '，'.join(f'{old}→{new}' for old, new in preview))
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if not args.apply:
        print('这是预览；确认后增加 --apply。')
        return 0

    write_jsonl(hq_path, hq_header, hq_new)
    write_jsonl(sq_path, sq_header, sq_new)
    print(f'已写回：{hq_path}、{sq_path}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
