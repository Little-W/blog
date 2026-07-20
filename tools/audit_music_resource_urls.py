#!/usr/bin/env python3
"""Check whether every music URL referenced by the static JSONL files exists.

The checker intentionally performs read-only network requests.  It accepts the
unescaped URLs that occur in old music records, percent-encodes them before
requesting, and tries a one-byte GET when an origin does not implement HEAD.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import socket
import sys
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[1] / "static" / "data"
DATASETS = ("music_hq", "music_sq")
FIELDS = ("url", "pic", "lrc")
USER_AGENT = "YusenMusicResourceAudit/1.0"
HEAD_FALLBACK_STATUS = {403, 405, 501}


@dataclass(frozen=True)
class Reference:
    dataset: str
    field: str
    line: int
    mid: Any
    title: str
    original_url: str
    request_url: str | None


@dataclass(frozen=True)
class Probe:
    result: str
    method: str
    status: int | None
    detail: str
    elapsed_ms: int


def encode_http_url(value: str) -> str | None:
    """Return a request-safe HTTP URL while preserving existing escapes."""
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return None
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    # URL fragments are not sent to a server.  Keep percent escapes intact so
    # records containing an already escaped Japanese filename remain valid.
    try:
        netloc = quote(parsed.netloc, safe="%:@[]")
        path = quote(parsed.path, safe="/%:@!$&'()*+,;=")
        query = quote(parsed.query, safe="/%?:@!$&'()*+,;=")
    except UnicodeEncodeError:
        return None
    return urlunsplit((parsed.scheme, netloc, path, query, ""))


def iter_references(data_dir: Path, max_records: int) -> Iterable[Reference]:
    for dataset in DATASETS:
        path = data_dir / f"{dataset}.0.jsonl"
        if not path.is_file():
            raise FileNotFoundError(f"找不到资料文件：{path}")
        record_count = 0
        with path.open("r", encoding="utf-8") as source:
            for line_number, raw in enumerate(source, start=1):
                if line_number == 1 or not raw.strip():
                    continue
                if max_records and record_count >= max_records:
                    break
                try:
                    record = json.loads(raw)
                except json.JSONDecodeError as error:
                    raise ValueError(f"{path}:{line_number} JSON 无法解析：{error.msg}") from error
                if not isinstance(record, dict):
                    raise ValueError(f"{path}:{line_number} 不是 JSON 对象")
                record_count += 1
                for field in FIELDS:
                    value = record.get(field)
                    original_url = value.strip() if isinstance(value, str) else ""
                    yield Reference(
                        dataset=dataset,
                        field=field,
                        line=line_number,
                        mid=record.get("mid"),
                        title=str(record.get("z_full_name") or record.get("title") or ""),
                        original_url=original_url,
                        request_url=encode_http_url(original_url) if original_url else None,
                    )


def classify_http_status(status: int) -> str:
    if 200 <= status < 400 or status == 416:
        return "exists"
    if status in {404, 410}:
        return "missing"
    if status in {401, 403}:
        return "restricted"
    return "failed"


def make_probe(result: str, method: str, status: int | None, detail: str, started: float) -> Probe:
    return Probe(result, method, status, detail, round((time.monotonic() - started) * 1000))


def request_once(url: str, method: str, timeout: float) -> tuple[int, str]:
    headers = {"User-Agent": USER_AGENT, "Accept": "*/*"}
    if method == "GET":
        headers["Range"] = "bytes=0-0"
    request = Request(url, method=method, headers=headers)
    with urlopen(request, timeout=timeout) as response:
        return int(getattr(response, "status", response.getcode())), ""


def probe_url(url: str, timeout: float) -> Probe:
    started = time.monotonic()
    try:
        status, _ = request_once(url, "HEAD", timeout)
        return make_probe(classify_http_status(status), "HEAD", status, f"HTTP {status}", started)
    except HTTPError as error:
        if error.code not in HEAD_FALLBACK_STATUS:
            return make_probe(classify_http_status(error.code), "HEAD", error.code, f"HTTP {error.code}", started)
        head_detail = f"HEAD HTTP {error.code}，改用 Range GET"
    except (URLError, socket.timeout, TimeoutError, ValueError) as error:
        return make_probe("failed", "HEAD", None, str(getattr(error, "reason", error)), started)

    try:
        status, _ = request_once(url, "GET", timeout)
        return make_probe(classify_http_status(status), "GET", status, f"{head_detail}；GET HTTP {status}", started)
    except HTTPError as error:
        return make_probe(classify_http_status(error.code), "GET", error.code, f"{head_detail}；GET HTTP {error.code}", started)
    except (URLError, socket.timeout, TimeoutError, ValueError) as error:
        return make_probe("failed", "GET", None, f"{head_detail}；{getattr(error, 'reason', error)}", started)


def empty_counters() -> dict[str, int]:
    return {
        "references": 0,
        "unique_urls": 0,
        "exists": 0,
        "missing": 0,
        "restricted": 0,
        "failed": 0,
        "invalid": 0,
        "empty": 0,
    }


def summary_template() -> dict[str, dict[str, dict[str, int]]]:
    return {dataset: {field: empty_counters() for field in FIELDS} for dataset in DATASETS}


def render_summary(summary: dict[str, dict[str, dict[str, int]]]) -> None:
    print("音乐远程资源检查结果")
    print("=" * 96)
    print("资料集       字段    引用数  去重URL  存在  缺失  受限  失败  无效  空值")
    total = empty_counters()
    for dataset in DATASETS:
        for field in FIELDS:
            values = summary[dataset][field]
            for key in total:
                total[key] += values[key]
            print(
                f"{dataset:12} {field:5} {values['references']:>7} {values['unique_urls']:>8}"
                f" {values['exists']:>5} {values['missing']:>5} {values['restricted']:>5}"
                f" {values['failed']:>5} {values['invalid']:>5} {values['empty']:>5}"
            )
    print("-" * 96)
    print(
        f"合计                 {total['references']:>7} {total['unique_urls']:>8}"
        f" {total['exists']:>5} {total['missing']:>5} {total['restricted']:>5}"
        f" {total['failed']:>5} {total['invalid']:>5} {total['empty']:>5}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="并发检查 music_hq/music_sq 的音频、封面和歌词 URL。")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR, help="JSONL 资料目录。")
    parser.add_argument("--workers", type=int, default=20, help="并发请求数，默认 20。")
    parser.add_argument("--timeout", type=float, default=8.0, help="单个请求超时秒数，默认 8。")
    parser.add_argument("--max-records", type=int, default=0, help="每个资料集最多检查多少条记录；0 表示全部。")
    parser.add_argument("--report", type=Path, help="写入包含每条引用结果的完整 JSON 报告。")
    parser.add_argument("--strict", action="store_true", help="将受限和网络失败也作为非零退出状态。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.workers < 1 or args.timeout <= 0 or args.max_records < 0:
        print("workers、timeout 和 max-records 必须为有效的正数（max-records 可为 0）。", file=sys.stderr)
        return 2

    try:
        references = list(iter_references(args.data_dir.resolve(), args.max_records))
    except (OSError, ValueError) as error:
        print(f"无法读取资料：{error}", file=sys.stderr)
        return 2

    summary = summary_template()
    url_references: dict[str, list[Reference]] = defaultdict(list)
    details: list[dict[str, Any]] = []
    for reference in references:
        counters = summary[reference.dataset][reference.field]
        counters["references"] += 1
        if not reference.original_url:
            counters["empty"] += 1
            details.append({**asdict(reference), "result": "empty", "method": None, "status": None, "detail": "字段为空", "elapsed_ms": 0})
        elif not reference.request_url:
            counters["invalid"] += 1
            details.append({**asdict(reference), "result": "invalid", "method": None, "status": None, "detail": "不是有效 HTTP(S) URL", "elapsed_ms": 0})
        else:
            url_references[reference.request_url].append(reference)

    # Deduplicate network work, but keep a result for every JSONL reference.
    probes: dict[str, Probe] = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(probe_url, url, args.timeout): url for url in url_references}
        for future in concurrent.futures.as_completed(futures):
            url = futures[future]
            try:
                probes[url] = future.result()
            except Exception as error:  # A single worker must not abort the audit.
                probes[url] = Probe("failed", "internal", None, str(error), 0)

    for request_url, grouped in url_references.items():
        probe = probes[request_url]
        for reference in grouped:
            summary[reference.dataset][reference.field][probe.result] += 1
            details.append({**asdict(reference), **asdict(probe)})

    # A URL can be shared by several records.  Count it once within each
    # dataset/field combination, not once globally.
    for request_url, grouped in url_references.items():
        seen_pairs: set[tuple[str, str]] = set()
        for reference in grouped:
            pair = (reference.dataset, reference.field)
            if pair not in seen_pairs:
                summary[pair[0]][pair[1]]["unique_urls"] += 1
                seen_pairs.add(pair)

    render_summary(summary)
    result_counts = Counter(detail["result"] for detail in details)
    print(f"\n已检查 {len(url_references)} 个去重 HTTP(S) URL；Range GET 回退用于 HEAD 返回 403、405 或 501 的站点。")
    print("结果：" + "；".join(f"{key} {value}" for key, value in sorted(result_counts.items())))

    if args.report:
        payload = {
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "data_dir": str(args.data_dir.resolve()),
            "options": {"workers": args.workers, "timeout": args.timeout, "max_records": args.max_records},
            "summary": summary,
            "references": sorted(details, key=lambda item: (item["dataset"], item["line"], item["field"])),
        }
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"完整 JSON 报告：{args.report}")

    failures = result_counts["missing"] + result_counts["invalid"]
    if args.strict:
        failures += result_counts["restricted"] + result_counts["failed"]
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
