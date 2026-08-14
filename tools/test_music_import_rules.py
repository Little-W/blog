#!/usr/bin/env python3
"""Small self-checks for music import rules."""

from __future__ import annotations

import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from import_new_music import (  # noqa: E402
    canonicalize_album_covers,
    canonicalize_album_names,
    should_exclude_track,
    sort_tracks_by_album,
)
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

    def test_album_sort_uses_track_number(self) -> None:
        later = Track(
            source=Path('/tmp/later.flac'),
            source_relative=Path('EGOIST/later.flac'),
            title='Later',
            artist='EGOIST',
            album='Album',
            cover=None,
            lyrics=None,
            track_number=2,
        )
        earlier = Track(
            source=Path('/tmp/earlier.flac'),
            source_relative=Path('EGOIST/earlier.flac'),
            title='Earlier',
            artist='EGOIST',
            album='Album',
            cover=None,
            lyrics=None,
            track_number=1,
        )
        self.assertEqual([item.title for item in sort_tracks_by_album([later, earlier])], ['Earlier', 'Later'])

    def test_egoist_album_sort_uses_supplied_release_order(self) -> None:
        early = Track(
            source=Path('/tmp/early.flac'),
            source_relative=Path('EGOIST/early.flac'),
            title='Early',
            artist='EGOIST',
            album='Departures ~あなたにおくるアイの歌~',
            cover=None,
            lyrics=None,
            track_number=1,
        )
        late = Track(
            source=Path('/tmp/late.flac'),
            source_relative=Path('EGOIST/late.flac'),
            title='Late',
            artist='EGOIST',
            album='1,000,000 TIMES',
            cover=None,
            lyrics=None,
            track_number=1,
        )
        self.assertEqual([item.title for item in sort_tracks_by_album([late, early])], ['Early', 'Late'])

    def test_album_alias_and_cover_grouping(self) -> None:
        first = Track(
            source=Path('/tmp/first.flac'),
            source_relative=Path('EGOIST/first.flac'),
            title='First',
            artist='EGOIST',
            album='GREATEST HITS 2011-2017 “ALTER EGO”',
            cover=None,
            lyrics=None,
            embedded_cover_extension='.jpg',
            track_number=1,
        )
        second = Track(
            source=Path('/tmp/second.flac'),
            source_relative=Path('EGOIST/second.flac'),
            title='Second',
            artist='EGOIST',
            album='GREATEST HITS 2011-2017 "ALTER EGO"',
            cover=None,
            lyrics=None,
            embedded_cover_extension='.jpg',
            track_number=2,
        )
        tracks = [first, second]
        canonicalize_album_names(tracks)
        canonicalize_album_covers(tracks)
        self.assertEqual(first.album, second.album)
        self.assertEqual(first.cover_relative(), second.cover_relative())
        self.assertEqual(second.cover_audio_override, first.source)

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
