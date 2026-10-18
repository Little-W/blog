import unittest
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tools.upload_pixiv_gallery import diverse_candidates, exclusion_reason, validate_image_bytes


class GalleryImportRulesTests(unittest.TestCase):
    def test_rejects_pixiv_restricted_content_and_r18_tags(self):
        self.assertTrue(exclusion_reason({'id': '1', 'xRestrict': 1}))
        self.assertTrue(exclusion_reason({'id': '2', 'tags': [{'name': 'R-18'}]}))
        self.assertTrue(exclusion_reason({'id': '3', 'tags': [{'name': 'R_18G'}]}))

    def test_rejects_meme_tags_and_user_reported_announcement(self):
        self.assertTrue(exclusion_reason({'id': '4', 'tags': [{'name': '表情包'}]}))
        self.assertTrue(exclusion_reason({'id': '126432381', 'tags': ['猫耳']}))
        self.assertTrue(exclusion_reason({'id': '125257566', 'tags': ['ポンイタチ']}))
        self.assertTrue(exclusion_reason({'id': '119711582', 'tags': ['ポンタイタチ']}))
        self.assertTrue(exclusion_reason({'id': '123518030', 'tags': ['着ぐるみパジャマ']}))
        self.assertTrue(exclusion_reason({'id': '122306089', 'tags': ['ホシノ']}))
        self.assertTrue(exclusion_reason({'id': '125340293', 'tags': ['マイクロビキニ']}))

    def test_rejects_genshin_by_title_or_tag(self):
        self.assertTrue(exclusion_reason({'id': '6', 'title': 'Genshin Impact'}))
        self.assertTrue(exclusion_reason({'id': '7', 'tags': [{'name': '原神'}]}))
        self.assertTrue(exclusion_reason({'id': '8', 'tags': [{'name': 'タイツ越しのパンツ'}]}))

    def test_keeps_regular_illustrations(self):
        self.assertEqual(exclusion_reason({
            'id': '5',
            'title': '猫耳の女の子',
            'tags': [{'name': '猫耳'}, {'name': '女の子'}],
        }), '')

    def test_diversifies_topics_and_does_not_repeat_existing_pixiv_ids(self):
        existing = [{'pixivId': '1', 'author': 'artist', 'tags': ['BlueArchive', '女の子']}]
        candidates = [
            {'id': '1', 'author': 'artist', 'tags': ['BlueArchive', '阿慈谷ヒフミ']},
            {'id': '2', 'author': 'artist', 'tags': ['BlueArchive', '小鳥遊ホシノ']},
            {'id': '3', 'author': 'another', 'tags': ['VOCALOID', '初音ミク']},
            {'id': '4', 'author': 'third', 'tags': ['東方Project', '博麗霊夢']},
        ]
        selected = diverse_candidates(candidates, existing, 2)
        self.assertEqual(len(selected), 2)
        self.assertNotIn('1', {item['id'] for item in selected})
        self.assertEqual(len({item['author'] for item in selected}), 2)

    def test_image_validation_rejects_truncated_uploads(self):
        output = BytesIO()
        Image.new('RGB', (32, 32), (180, 110, 220)).save(output, format='JPEG')
        complete = output.getvalue()
        self.assertIsNone(validate_image_bytes(complete))
        with self.assertRaisesRegex(RuntimeError, '不完整'):
            validate_image_bytes(complete[:-20])



if __name__ == '__main__':
    unittest.main()
