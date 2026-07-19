import assert from 'node:assert/strict';
import test from 'node:test';
import { compactQualityName, dashManifestXML, isBvid, parseOptions, qualityName } from '../server.mjs';

test('只接受完整 BVID', () => {
  assert.equal(isBvid('BV1Gd4y1q7Vs'), true);
  assert.equal(isBvid('BV1Gd4y1q7V'), false);
  assert.equal(isBvid('https://www.bilibili.com/video/BV1Gd4y1q7Vs'), false);
});

test('画质标签反映 B 站实际 quality 值', () => {
  assert.equal(qualityName(80), '1080P');
  assert.equal(qualityName(64), '720P');
});

test('本地服务默认绑定回环地址并限制开发来源', () => {
  const options = parseOptions([]);
  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, 19180);
  assert.deepEqual(options.allowedOrigins, ['http://localhost:3000', 'http://127.0.0.1:3000']);
});

test('DASH 清单保留独立视频和音频 Range 信息', () => {
  const video = { bandwidth: 5000000, codecs: 'avc1.640033', width: 2560, height: 1440, segment_base: { initialization: '0-1000', index_range: '1001-1800' } };
  const audio = { bandwidth: 192000, codecs: 'mp4a.40.2', segment_base: { initialization: '0-900', index_range: '901-1500' } };
  const mpd = dashManifestXML('11111111-1111-4111-8111-111111111111', 120, video, audio);
  assert.match(mpd, /mpeg:dash/);
  assert.match(mpd, /\.\.\/media\/11111111-1111-4111-8111-111111111111\/video/);
  assert.match(mpd, /indexRange="1001-1800"/);
  assert.match(mpd, /codecs="mp4a\.40\.2"/);
  assert.equal(compactQualityName({ display_desc: '2K' }, video, 120), '2K');
  assert.equal(compactQualityName({}, { height: 1080 }, 116), '1080P60');
});
