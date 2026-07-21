#!/usr/bin/env python3
"""Tests for static media data validation."""

from __future__ import annotations

import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from validate_media_data import Dataset, Report, validate_music_orders  # noqa: E402


def dataset(name: str, records: list[dict[str, object]]) -> Dataset:
    prepared = []
    for line, record in enumerate(records, start=2):
        prepared.append({**record, '_validation_line': line})
    return Dataset(name, {}, prepared, Path(f'/tmp/{name}.0.jsonl'))


class MusicOrderValidationTests(unittest.TestCase):
    def validate(
        self,
        order: object,
        hq_records: list[dict[str, object]],
        sq_records: list[dict[str, object]] | None = None,
    ) -> Report:
        report = Report()
        tags = dataset('music_tag', [{'tag_id': 2, 'music_order': order}])
        hq = dataset('music_hq', hq_records)
        sq = dataset('music_sq', hq_records if sq_records is None else sq_records)
        validate_music_orders(report, tags, hq, sq)
        return report

    def test_accepts_every_member_once_in_custom_order(self) -> None:
        records = [
            {'mid': 10, 'list': [1, 2]},
            {'mid': 11, 'list': [2]},
        ]
        report = self.validate([11, 10], records)
        self.assertEqual(report.count('error'), 0)

    def test_requires_music_order_array(self) -> None:
        report = self.validate(None, [{'mid': 10, 'list': [2]}])
        self.assertEqual([item.code for item in report.findings], ['invalid-music-order'])

    def test_rejects_non_integer_duplicate_nonmember_and_missing_mid(self) -> None:
        records = [
            {'mid': 10, 'list': [2]},
            {'mid': 11, 'list': [2]},
        ]
        report = self.validate([10, 10, '11', True, 99], records)
        codes = {item.code for item in report.findings}
        self.assertEqual(
            codes,
            {
                'invalid-music-order-mid',
                'duplicate-music-order-mid',
                'music-order-nonmember',
                'music-order-missing-member',
            },
        )

    def test_checks_order_against_hq_and_sq_memberships(self) -> None:
        hq = [
            {'mid': 10, 'list': [2]},
            {'mid': 11, 'list': [2]},
        ]
        sq = [
            {'mid': 10, 'list': [2]},
            {'mid': 11, 'list': [3]},
        ]
        report = self.validate([10, 11], hq, sq)
        findings = [item for item in report.findings if item.code == 'music-order-nonmember']
        self.assertEqual(len(findings), 1)
        self.assertIn('SQ mid', findings[0].message)


if __name__ == '__main__':
    unittest.main()
