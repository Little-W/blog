#!/usr/bin/env python3
"""Small self-checks for music import rules."""

from __future__ import annotations

import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_new_music import should_exclude_track  # noqa: E402
from music_library_gui import Track  # noqa: E402


class MusicImportRuleTests(unittest.TestCase):
    def test_root_embedded_cover_names_are_unique(self) -> None:
        first = Track(
            source=Path('/tmp/a.flac'),
            source_relative=Path('first.flac'),
            title='Alpha',
            artist='Artist One',
            album='',
            cover=None,
            lyrics=None,
            embedded_cover_extension='.jpg',
        )
        second = Track(
            source=Path('/tmp/b.flac'),
            source_relative=Path('second.flac'),
            title='Beta',
            artist='Artist Two',
            album='',
            cover=None,
            lyrics=None,
            embedded_cover_extension='.jpg',
        )
        self.assertEqual(first.cover_relative(), Path('Artist One - Alpha.cover.jpg'))
        self.assertEqual(second.cover_relative(), Path('Artist Two - Beta.cover.jpg'))
        self.assertNotEqual(first.cover_relative(), second.cover_relative())

    def test_embedded_cover_names_are_unique_inside_one_source_directory(self) -> None:
        first = Track(
            source=Path('/tmp/a.flac'),
            source_relative=Path('EGOIST/a.flac'),
            title='Same Song (Album A)',
            artist='EGOIST',
            album='Album A',
            cover=None,
            lyrics=None,
            embedded_cover_extension='.jpg',
        )
        second = Track(
            source=Path('/tmp/b.flac'),
            source_relative=Path('EGOIST/b.flac'),
            title='Same Song (Album B)',
            artist='EGOIST',
            album='Album B',
            cover=None,
            lyrics=None,
            embedded_cover_extension='.jpg',
        )
        self.assertNotEqual(first.cover_relative(), second.cover_relative())

    def test_long_sidecar_name_keeps_extension(self) -> None:
        track = Track(
            source=Path('/tmp/a.flac'),
            source_relative=Path('EGOIST/a.flac'),
            title='歌曲' * 80,
            artist='EGOIST',
            album='Album',
            cover=None,
            lyrics=None,
            embedded_cover_extension='.jpg',
        )
        self.assertTrue(track.sidecar_relative(Path(f'{track.display_name}.lrc')).name.endswith('.lrc'))

    def test_forbidden_tracks_are_excluded(self) -> None:
        instrumental = Track(
            source=Path('/tmp/instrumental.flac'),
            source_relative=Path('Song/track.flac'),
            title='Song Title (Instrumental)',
            artist='Singer',
            album='',
            cover=None,
            lyrics=None,
        )
        karaoke = Track(
            source=Path('/tmp/karaoke.flac'),
            source_relative=Path('Song/karaoke.flac'),
            title='Song Title',
            artist='Singer',
            album='カラオケ版',
            cover=None,
            lyrics=None,
        )
        self.assertEqual(should_exclude_track(instrumental), (True, 'Instrumental'))
        self.assertEqual(should_exclude_track(karaoke), (True, 'Karaoke'))


if __name__ == '__main__':
    unittest.main()
