#!/usr/bin/env python3
"""Populate each public music tag's ``music_order`` with member mids.

The order lives in ``music_tag.0.jsonl`` so HQ and SQ share one playlist
sequence. Existing valid mids keep their current relative order; newly added
members are appended in ascending mid order.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import tempfile


def read_jsonl(path: Path) -> tuple[str, list[dict[str, object]]]:
    header = ''
    records: list[dict[str, object]] = []
    for raw_line in path.read_text(encoding='utf-8-sig').splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith('#'):
            if not header:
                header = line
            continue
        records.append(json.loads(line))
    return header, records


def main() -> int:
    parser = argparse.ArgumentParser(description='为每个公开歌单生成独立的曲目顺序数组。')
    parser.add_argument('--data-dir', type=Path, default=Path(__file__).resolve().parents[1] / 'static' / 'data')
    parser.add_argument('--apply', action='store_true', help='写回 music_tag.0.jsonl；默认只显示统计。')
    args = parser.parse_args()

    tag_path = args.data_dir / 'music_tag.0.jsonl'
    music_path = args.data_dir / 'music_hq.0.jsonl'
    sq_music_path = args.data_dir / 'music_sq.0.jsonl'
    header, tags = read_jsonl(tag_path)
    _, tracks = read_jsonl(music_path)
    _, sq_tracks = read_jsonl(sq_music_path)

    def collect_members(records: list[dict[str, object]]) -> dict[int, list[int]]:
        result: dict[int, list[int]] = {}
        for track in records:
            mid = int(track['mid'])
            for raw_tag_id in track.get('list', []):
                tag_id = int(raw_tag_id)
                result.setdefault(tag_id, []).append(mid)
        return {tag_id: sorted(set(mids)) for tag_id, mids in result.items()}

    members = collect_members(tracks)
    sq_members = collect_members(sq_tracks)
    if members != sq_members:
        different_tags = sorted(tag_id for tag_id in set(members) | set(sq_members)
                                if members.get(tag_id, []) != sq_members.get(tag_id, []))
        print('HQ 与 SQ 的歌单成员不同，拒绝生成顺序；异常标签：' + '、'.join(map(str, different_tags)))
        return 1

    changed = 0
    for tag in tags:
        tag_id = int(tag['tag_id'])
        valid_members = sorted(set(members.get(tag_id, [])))
        valid_set = set(valid_members)
        old_order = [int(mid) for mid in tag.get('music_order', []) if isinstance(mid, int) or str(mid).isdigit()]
        next_order = list(dict.fromkeys(mid for mid in old_order if mid in valid_set))
        used = set(next_order)
        next_order.extend(mid for mid in valid_members if mid not in used)
        if tag.get('music_order') != next_order:
            tag['music_order'] = next_order
            changed += 1

    print(f'歌单：{len(tags)}；需要更新：{changed}；曲目：{len(tracks)}。')
    if not args.apply:
        print('当前为预览；添加 --apply 后写回。')
        return 0

    content = header + '\n' + '\n'.join(json.dumps(record, ensure_ascii=False, separators=(',', ':')) for record in tags) + '\n'
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=tag_path.parent,
                                         prefix=tag_path.name + '.', suffix='.tmp', delete=False) as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
            temporary_path = Path(handle.name)
        os.replace(temporary_path, tag_path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
    print(f'已更新 {tag_path}。')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
