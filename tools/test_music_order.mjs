import assert from 'node:assert/strict';
import test from 'node:test';

import {
  reconcileMusicTagOrders,
  sortMusicRecords,
} from '../netlify/functions/console.mjs';

test('歌单顺序保留已有次序，并将新增成员按 MID 追加', () => {
  const tags = [{tag_id: 2, tag_order: 1, tag_name: '默认', music_order: [3, 1]}];
  const music = [
    {mid: 1, list: [2]},
    {mid: 2, list: [2]},
    {mid: 3, list: [2]},
    {mid: 4, list: [3]},
  ];
  const reconciled = reconcileMusicTagOrders(tags, music);
  assert.deepEqual(reconciled[0].music_order, [3, 1, 2]);
});

test('控制台可在歌单顺序与 MID 顺序之间切换', () => {
  const records = [{mid: 3}, {mid: 1}, {mid: 2}];
  assert.deepEqual(
    sortMusicRecords(records, 'list_order', [2, 3, 1]).map((record) => record.mid),
    [2, 3, 1],
  );
  assert.deepEqual(
    sortMusicRecords(records, 'id', [2, 3, 1]).map((record) => record.mid),
    [1, 2, 3],
  );
});
