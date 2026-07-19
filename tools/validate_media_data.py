#!/usr/bin/env python3
"""Validate the static music and MV JSONL collections used by the website.

The default run checks local files only.  Add ``--check-urls`` to make small
HTTP requests to every referenced media URL.  Remote URL failures are reported
as warnings by default because they can be caused by a temporary network issue.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import sys
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / 'static' / 'data'
HEADER_PREFIX = '#filetype:JSON-streaming '
SYSTEM_LIST_IDS = {0, 1}
URL_KEYS = {
    'url',
    'pic',
    'lrc',
    'post_url',
    'post_small_url',
    'video_url_360',
    'video_url_720',
    'video_url_1080',
    'bilibili_cover',
    'cover_url',
}


@dataclass(frozen=True)
class Finding:
    level: str
    code: str
    location: str
    message: str


@dataclass
class Dataset:
    name: str
    header: dict[str, Any]
    records: list[dict[str, Any]]
    path: Path


class Report:
    def __init__(self) -> None:
        self.findings: list[Finding] = []

    def add(self, level: str, code: str, location: str, message: str) -> None:
        self.findings.append(Finding(level, code, location, message))

    def error(self, code: str, location: str, message: str) -> None:
        self.add('error', code, location, message)

    def warning(self, code: str, location: str, message: str) -> None:
        self.add('warning', code, location, message)

    def info(self, code: str, location: str, message: str) -> None:
        self.add('info', code, location, message)

    def count(self, level: str) -> int:
        return sum(item.level == level for item in self.findings)


def is_int(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def record_location(dataset: str, line: int) -> str:
    return f'{dataset}.0.jsonl:{line}'


def load_dataset(data_dir: Path, name: str, report: Report) -> Dataset:
    path = data_dir / f'{name}.0.jsonl'
    if not path.is_file():
        report.error('missing-file', str(path), '资料文件不存在。')
        return Dataset(name, {}, [], path)

    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except UnicodeDecodeError as error:
        report.error('invalid-encoding', str(path), f'文件不是 UTF-8：{error}')
        return Dataset(name, {}, [], path)

    if not lines:
        report.error('empty-file', str(path), '资料文件为空。')
        return Dataset(name, {}, [], path)

    header: dict[str, Any] = {}
    first = lines[0]
    if not first.startswith(HEADER_PREFIX):
        report.error('missing-header', record_location(name, 1), '缺少 JSON-streaming 文件头。')
    else:
        try:
            candidate = json.loads(first[len(HEADER_PREFIX):])
            if isinstance(candidate, dict):
                header = candidate
            else:
                raise ValueError('文件头不是对象')
        except (json.JSONDecodeError, ValueError) as error:
            report.error('invalid-header', record_location(name, 1), f'文件头无法解析：{error}')

    if header.get('type') != 'Class' or header.get('class') != name:
        report.error('header-class', record_location(name, 1), f'文件头应声明 class 为 {name}。')

    records: list[dict[str, Any]] = []
    for line_number, raw in enumerate(lines[1:], start=2):
        if not raw.strip():
            continue
        try:
            value = json.loads(raw)
        except json.JSONDecodeError as error:
            report.error('invalid-json', record_location(name, line_number), f'JSON 无法解析：{error.msg}')
            continue
        if not isinstance(value, dict):
            report.error('record-not-object', record_location(name, line_number), '每行资料必须是 JSON 对象。')
            continue
        value['_validation_line'] = line_number
        records.append(value)
    return Dataset(name, header, records, path)


def nonempty_string(record: dict[str, Any], key: str) -> bool:
    return isinstance(record.get(key), str) and bool(record[key].strip())


def validate_url(report: Report, location: str, key: str, value: Any, required: bool) -> None:
    if value is None or value == '':
        if required:
            report.error('missing-url', location, f'缺少 {key}。')
        return
    if not isinstance(value, str):
        report.error('invalid-url', location, f'{key} 必须是 URL 字符串。')
        return
    parsed = urlsplit(value)
    if parsed.scheme not in {'https', 'http'} or not parsed.netloc:
        report.error('invalid-url', location, f'{key} 不是有效的 HTTP(S) URL。')
    elif parsed.scheme != 'https':
        report.warning('insecure-url', location, f'{key} 使用 HTTP，建议改为 HTTPS。')


def validate_list(report: Report, location: str, record: dict[str, Any], allowed_ids: set[int] | None) -> None:
    values = record.get('list')
    if not isinstance(values, list) or not values:
        report.error('invalid-list', location, 'list 必须是非空的整数数组。')
        return
    if any(not is_int(value) for value in values):
        report.error('invalid-list', location, 'list 中只能包含整数。')
        return
    if len(values) != len(set(values)):
        report.warning('duplicate-list-id', location, 'list 中存在重复的歌单 ID。')
    if allowed_ids is not None:
        unknown = sorted(set(values) - allowed_ids)
        if unknown:
            report.error('unknown-list-id', location, f'引用了不存在的歌单 ID：{unknown}')


def unique_integer_ids(
    report: Report,
    dataset: Dataset,
    key: str,
    allow_negative: bool = False,
) -> set[int]:
    values: dict[int, int] = {}
    for record in dataset.records:
        line = int(record['_validation_line'])
        location = record_location(dataset.name, line)
        value = record.get(key)
        if not is_int(value) or (not allow_negative and value < 0):
            report.error('invalid-id', location, f'{key} 必须是非负整数。')
            continue
        if value in values:
            report.error('duplicate-id', location, f'{key}={value} 已在第 {values[value]} 行出现。')
        else:
            values[value] = line
    return set(values)


def validate_music_dataset(report: Report, dataset: Dataset, allowed_list_ids: set[int] | None) -> set[int]:
    ids = unique_integer_ids(report, dataset, 'mid')
    required_text = ('title', 'author', 'z_full_name')
    for record in dataset.records:
        line = int(record['_validation_line'])
        location = record_location(dataset.name, line)
        for key in required_text:
            if not nonempty_string(record, key):
                report.error('missing-field', location, f'缺少有效的 {key}。')
        title = record.get('title')
        author = record.get('author')
        full_name = record.get('z_full_name')
        if nonempty_string(record, 'title') and nonempty_string(record, 'author') and nonempty_string(record, 'z_full_name'):
            expected = f'{author} - {title}'
            if full_name != expected:
                report.warning('name-mismatch', location, f'z_full_name 与“{expected}”不一致。')
        validate_list(report, location, record, allowed_list_ids)
        validate_url(report, location, 'url', record.get('url'), required=True)
        validate_url(report, location, 'pic', record.get('pic'), required=False)
        validate_url(report, location, 'lrc', record.get('lrc'), required=False)
        if not nonempty_string(record, 'pic'):
            report.warning('missing-cover', location, '未提供封面 URL。')
        if not nonempty_string(record, 'lrc'):
            report.warning('missing-lyrics', location, '未提供歌词 URL。')
    return ids


def validate_tag_dataset(report: Report, dataset: Dataset) -> set[int]:
    ids = unique_integer_ids(report, dataset, 'tag_id')
    orders: dict[int, int] = {}
    for record in dataset.records:
        line = int(record['_validation_line'])
        location = record_location(dataset.name, line)
        if not nonempty_string(record, 'tag_name'):
            report.error('missing-field', location, '缺少有效的 tag_name。')
        order = record.get('tag_order')
        if not is_int(order):
            report.error('invalid-order', location, 'tag_order 必须是整数。')
        elif order in orders:
            report.warning('duplicate-order', location, f'tag_order={order} 已在第 {orders[order]} 行出现。')
        else:
            orders[order] = line
    return ids


def validate_native_mv_dataset(report: Report, dataset: Dataset, allowed_list_ids: set[int] | None) -> set[int]:
    ids = unique_integer_ids(report, dataset, 'mv_id')
    for record in dataset.records:
        line = int(record['_validation_line'])
        location = record_location(dataset.name, line)
        for key in ('title', 'author'):
            if not nonempty_string(record, key):
                report.error('missing-field', location, f'缺少有效的 {key}。')
        validate_list(report, location, record, allowed_list_ids)
        validate_url(report, location, 'post_url', record.get('post_url'), required=True)
        for key in ('video_url_360', 'video_url_720', 'video_url_1080'):
            validate_url(report, location, key, record.get(key), required=True)
    return ids


def validate_bilibili_dataset(report: Report, dataset: Dataset) -> set[int]:
    ids = unique_integer_ids(report, dataset, 'mv_id')
    bvid_pattern = re.compile(r'^BV[1-9A-HJ-NP-Za-km-z]{10}$')
    for record in dataset.records:
        line = int(record['_validation_line'])
        location = record_location(dataset.name, line)
        if not nonempty_string(record, 'title'):
            report.error('missing-field', location, '缺少有效的 title。')
        bvid = record.get('bilibili_bvid')
        if not isinstance(bvid, str) or not bvid_pattern.fullmatch(bvid):
            report.error('invalid-bvid', location, 'bilibili_bvid 不是有效的 BV 号。')
        page = record.get('bilibili_page')
        if not is_int(page) or page < 1:
            report.error('invalid-page', location, 'bilibili_page 必须是大于 0 的整数。')
        duration = record.get('duration')
        if duration is not None and (not is_int(duration) or duration < 1):
            report.warning('invalid-duration', location, 'duration 应为大于 0 的秒数。')
        validate_url(report, location, 'bilibili_cover', record.get('bilibili_cover'), required=False)
    return ids


def validate_mv_class_dataset(report: Report, dataset: Dataset) -> set[int]:
    ids = unique_integer_ids(report, dataset, 'list')
    for record in dataset.records:
        line = int(record['_validation_line'])
        location = record_location(dataset.name, line)
        if not nonempty_string(record, 'list_name'):
            report.error('missing-field', location, '缺少有效的 list_name。')
        validate_url(report, location, 'cover_url', record.get('cover_url'), required=True)
    return ids


def compare_music_libraries(report: Report, hq: Dataset, sq: Dataset, hq_ids: set[int], sq_ids: set[int]) -> None:
    only_hq = sorted(hq_ids - sq_ids)
    only_sq = sorted(sq_ids - hq_ids)
    if only_hq:
        report.error('quality-id-missing', 'music_hq/music_sq', f'HQ 中缺少 SQ 条目：{only_hq[:20]}（共 {len(only_hq)} 条）。')
    if only_sq:
        report.error('quality-id-missing', 'music_hq/music_sq', f'SQ 中缺少 HQ 条目：{only_sq[:20]}（共 {len(only_sq)} 条）。')

    hq_by_id = {record.get('mid'): record for record in hq.records if is_int(record.get('mid'))}
    sq_by_id = {record.get('mid'): record for record in sq.records if is_int(record.get('mid'))}
    for mid in sorted(hq_ids & sq_ids):
        left = hq_by_id[mid]
        right = sq_by_id[mid]
        for key in ('title', 'author'):
            if left.get(key) != right.get(key):
                report.warning('quality-metadata-mismatch', f'music mid={mid}', f'HQ 与 SQ 的 {key} 不一致。')
        if left.get('list') != right.get('list'):
            report.warning('quality-list-mismatch', f'music mid={mid}', 'HQ 与 SQ 的 list 不一致。')


def compare_native_mv_libraries(report: Report, mv: set[int], mv_out: set[int]) -> None:
    only_mv = sorted(mv - mv_out)
    only_out = sorted(mv_out - mv)
    if only_mv:
        report.error('mv-id-missing', 'mv/mv_out', f'mv_out 缺少 mv_id：{only_mv[:20]}（共 {len(only_mv)} 条）。')
    if only_out:
        report.error('mv-id-missing', 'mv/mv_out', f'mv 缺少 mv_id：{only_out[:20]}（共 {len(only_out)} 条）。')


def remote_urls(datasets: Iterable[Dataset]) -> dict[str, list[str]]:
    locations: dict[str, list[str]] = {}
    for dataset in datasets:
        for record in dataset.records:
            line = int(record['_validation_line'])
            location = record_location(dataset.name, line)
            for key in URL_KEYS:
                value = record.get(key)
                if not isinstance(value, str) or not value.strip():
                    continue
                parsed = urlsplit(value)
                if parsed.scheme in {'http', 'https'} and parsed.netloc:
                    locations.setdefault(value, []).append(f'{location}.{key}')
    return locations


def probe_url(url: str, timeout: float) -> tuple[bool, str]:
    headers = {'User-Agent': 'YusenMediaDataValidator/1.0', 'Accept': '*/*'}
    request = Request(url, method='HEAD', headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            return 200 <= response.status < 400, f'HTTP {response.status}'
    except HTTPError as error:
        if error.code not in {405, 501}:
            return False, f'HTTP {error.code}'
    except URLError as error:
        return False, str(error.reason)
    except TimeoutError:
        return False, '请求超时'

    request = Request(url, method='GET', headers={**headers, 'Range': 'bytes=0-0'})
    try:
        with urlopen(request, timeout=timeout) as response:
            return 200 <= response.status < 400, f'HTTP {response.status}'
    except HTTPError as error:
        return False, f'HTTP {error.code}'
    except URLError as error:
        return False, str(error.reason)
    except TimeoutError:
        return False, '请求超时'


def check_remote_urls(
    report: Report,
    datasets: Iterable[Dataset],
    workers: int,
    timeout: float,
    limit: int,
    strict: bool,
) -> None:
    urls = remote_urls(datasets)
    values = sorted(urls)
    if limit > 0:
        values = values[:limit]
    report.info('url-check', '远程资源', f'开始检查 {len(values)} 个去重后的远程 URL。')
    level = report.error if strict else report.warning
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(probe_url, url, timeout): url for url in values}
        for future in concurrent.futures.as_completed(futures):
            url = futures[future]
            try:
                ok, detail = future.result()
            except Exception as error:  # The validator must finish even if one worker fails.
                ok, detail = False, str(error)
            if not ok:
                references = ', '.join(urls[url][:3])
                more = '' if len(urls[url]) <= 3 else f' 等 {len(urls[url])} 处'
                level('unreachable-url', references, f'{detail}：{url}{more}')


def print_report(report: Report, datasets: dict[str, Dataset]) -> None:
    print('媒体资料校验结果')
    print('=' * 58)
    for name, dataset in datasets.items():
        print(f'{name:16} {len(dataset.records):>5} 条  {dataset.path}')

    grouped = Counter(item.level for item in report.findings)
    print('-' * 58)
    print(f"错误 {grouped['error']} 条；警告 {grouped['warning']} 条；信息 {grouped['info']} 条。")
    for level, label in (('error', '错误'), ('warning', '警告'), ('info', '信息')):
        entries = [item for item in report.findings if item.level == level]
        if not entries:
            continue
        print(f'\n{label}：')
        by_code = Counter(item.code for item in entries)
        print('  分类：' + '；'.join(f'{code} {count} 条' for code, count in sorted(by_code.items())))
        for code in sorted(by_code):
            samples = [item for item in entries if item.code == code]
            for item in samples[:8]:
                print(f'  [{item.code}] {item.location}：{item.message}')
            if len(samples) > 8:
                print(f'  [{code}] ……同类问题还有 {len(samples) - 8} 条；使用 --report 导出完整结果。')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='校验静态音乐与 MV JSONL 资料。')
    parser.add_argument('--data-dir', type=Path, default=DEFAULT_DATA_DIR, help='static/data 目录。')
    parser.add_argument('--check-urls', action='store_true', help='检查资料中的远程媒体 URL。')
    parser.add_argument('--strict-urls', action='store_true', help='将不可访问 URL 视为错误；需同时指定 --check-urls。')
    parser.add_argument('--url-limit', type=int, default=0, help='最多检查多少个去重 URL；0 表示全部。')
    parser.add_argument('--workers', type=int, default=12, help='并发 URL 请求数，默认 12。')
    parser.add_argument('--timeout', type=float, default=10.0, help='单个 URL 的超时秒数，默认 10。')
    parser.add_argument('--report', type=Path, help='写入完整 JSON 校验报告。')
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.workers < 1 or args.timeout <= 0 or args.url_limit < 0:
        print('workers、timeout 和 url-limit 参数无效。', file=sys.stderr)
        return 2
    if args.strict_urls and not args.check_urls:
        print('--strict-urls 需要与 --check-urls 一起使用。', file=sys.stderr)
        return 2

    report = Report()
    data_dir = args.data_dir.resolve()
    names = ('music_hq', 'music_sq', 'music_tag', 'mv', 'mv_bilibili', 'mv_class', 'mv_out')
    datasets = {name: load_dataset(data_dir, name, report) for name in names}

    tag_ids = validate_tag_dataset(report, datasets['music_tag'])
    allowed_list_ids = tag_ids | SYSTEM_LIST_IDS
    hq_ids = validate_music_dataset(report, datasets['music_hq'], allowed_list_ids)
    sq_ids = validate_music_dataset(report, datasets['music_sq'], allowed_list_ids)
    mv_ids = validate_native_mv_dataset(report, datasets['mv'], allowed_list_ids)
    validate_bilibili_dataset(report, datasets['mv_bilibili'])
    validate_mv_class_dataset(report, datasets['mv_class'])
    mv_out_ids = validate_native_mv_dataset(report, datasets['mv_out'], allowed_list_ids)
    compare_music_libraries(report, datasets['music_hq'], datasets['music_sq'], hq_ids, sq_ids)
    compare_native_mv_libraries(report, mv_ids, mv_out_ids)

    if args.check_urls:
        check_remote_urls(report, datasets.values(), args.workers, args.timeout, args.url_limit, args.strict_urls)
    else:
        report.info('url-check', '远程资源', '未检查远程 URL；需要时加入 --check-urls。')

    print_report(report, datasets)
    if args.report:
        payload = {
            'dataDir': str(data_dir),
            'datasets': {name: {'path': str(dataset.path), 'records': len(dataset.records)} for name, dataset in datasets.items()},
            'summary': {level: report.count(level) for level in ('error', 'warning', 'info')},
            'findings': [asdict(item) for item in report.findings],
        }
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'完整报告：{args.report}')
    return 1 if report.count('error') else 0


if __name__ == '__main__':
    raise SystemExit(main())
