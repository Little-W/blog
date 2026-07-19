import assert from 'node:assert/strict';
import test from 'node:test';
import { compactQualityName, dashManifest, isBvid } from '../src/worker.js';

test('Worker 只接受完整 BVID', () => {
  assert.equal(isBvid('BV1Gd4y1q7Vs'), true);
  assert.equal(isBvid('BV1Gd4y1q7V'), false);
});

test('画质菜单保留官方的 1080P60、2K 与 4K 标记', () => {
  assert.equal(compactQualityName({ display_desc: '1080P', superscript: '60帧' }, {}, 116), '1080P60');
  assert.equal(compactQualityName({ display_desc: '2K' }, {}, 120), '2K');
  assert.equal(compactQualityName({ display_desc: '4K' }, {}, 120), '4K');
});

test('DASH 清单包含独立视频、音频轨道和 Range 索引', () => {
  const playback = {
    duration: 120,
    audio: { url: 'https://audio.invalid/audio.m4s?x=1', codecs: 'mp4a.40.2', bandwidth: 192000, segmentBase: { initialization: '0-900', indexRange: '901-1500' } },
    tracks: {
      116: { url: 'https://video.invalid/video.m4s?x=1&y=2', codecs: 'avc1.640033', bandwidth: 5000000, width: 1920, height: 1080, frameRate: '60', segmentBase: { initialization: '0-1000', indexRange: '1001-1800' } }
    }
  };
  const mpd = dashManifest(playback, '116');
  assert.match(mpd, /video\.m4s\?x=1&amp;y=2/);
  assert.match(mpd, /indexRange="1001-1800"/);
  assert.match(mpd, /codecs="mp4a\.40\.2"/);
});
