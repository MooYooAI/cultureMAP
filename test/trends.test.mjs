import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchKeyword, hotCandidates, loadHotFestivals } from '../scripts/trends.mjs';
import { pickHot, renderHot } from '../src/assets/lib/hot.js';

const quiet = { log() {}, error() {}, warn() {} };
const fest = (id, title, startDate, endDate, region = 'seoul') => ({ id, title, category: 'festival', region, startDate, endDate });

test('축제 이름에서 검색어 만들기', () => {
  assert.equal(searchKeyword('제25회 안동국제탈춤페스티벌 2026'), '안동국제탈춤페스티벌');
  assert.equal(searchKeyword('2026 진주남강유등축제(진주성 일원)'), '진주남강유등축제');
  assert.equal(searchKeyword('[서울] 빛초롱 축제'), '빛초롱 축제');
});

test('후보: 진행 중이거나 30일 안에 시작하는 축제, 같은 검색어는 하나만', () => {
  const events = [
    fest('a', '가 축제', '2026-10-10', '2026-10-20'),
    fest('b', '나 축제', '2026-12-01', '2026-12-02'),
    fest('c', '다 축제', '2026-10-01', '2026-10-05'),
    fest('d', '2026 가 축제', '2026-10-15', '2026-10-25'),
    { ...fest('e', '라 공연', '2026-10-10', '2026-10-20'), category: 'performance' },
  ];
  assert.deepEqual(hotCandidates(events, '2026-10-18').map((c) => c.id), ['a']);
});

test('키가 없으면 부르지 않는다', async () => {
  const hot = await loadHotFestivals({ events: [], today: '2026-10-18', env: {}, fetchImpl: () => assert.fail(), log: quiet });
  assert.deepEqual(hot, []);
});

test('요청마다 기준 축제를 넣어 점수를 이어 붙인다', async () => {
  // 실제 검색량(가상): 1번이 가장 많고, 7번은 1번의 2배.
  const volume = { f1: 50, f2: 10, f3: 5, f4: 0, f5: 20, f6: 30, f7: 100, f8: 1, f9: 0 };
  const events = Object.keys(volume).map((id, i) => fest(id, `${id} 축제`, '2026-10-10', `2026-10-2${i}`));
  const bodies = [];
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    bodies.push(body);
    assert.equal(opts.headers['X-NCP-APIGW-API-KEY-ID'], 'id');
    assert.equal(body.startDate, '2026-10-11');
    assert.equal(body.endDate, '2026-10-17');
    assert.ok(body.keywordGroups.length <= 5);
    const max = Math.max(...body.keywordGroups.map((g) => volume[g.groupName]));
    return {
      ok: true,
      json: async () => ({
        results: body.keywordGroups.map((g) => ({ title: g.groupName, data: [{ ratio: (volume[g.groupName] / max) * 100 }] })),
      }),
    };
  };
  const hot = await loadHotFestivals({ events, today: '2026-10-18', env: { NAVER_API_KEY_ID: 'id', NAVER_API_KEY: 'k' }, fetchImpl, log: quiet });
  assert.equal(bodies.length, 2); // 첫 요청 5개, 다음 요청은 기준 + 4개
  assert.ok(bodies.slice(1).every((b) => b.keywordGroups[0].groupName === 'f1'));
  assert.deepEqual(hot.map((h) => h.id), ['f7', 'f1', 'f6', 'f5', 'f2', 'f3', 'f8']);
  assert.equal(hot[0].score, 100);
  assert.equal(hot[1].score, 50);
});

test('API가 실패하면 빈 목록(빌드는 계속)', async () => {
  const events = [fest('a', '가 축제', '2026-10-10', '2026-10-20')];
  const fetchImpl = async () => ({ ok: false, status: 429, statusText: 'Too Many Requests' });
  const hot = await loadHotFestivals({ events, today: '2026-10-18', env: { NAVER_API_KEY_ID: 'i', NAVER_API_KEY: 'k' }, fetchImpl, log: quiet });
  assert.deepEqual(hot, []);
});

test('지역별로 거르고 끝난 축제는 뺀다', () => {
  const events = [fest('a', '가', '2026-10-10', '2026-10-20', 'busan'), fest('b', '나', '2026-10-01', '2026-10-05'), fest('c', '다', '2026-10-10', '2026-10-20')];
  const hot = [{ id: 'a', score: 100 }, { id: 'b', score: 80 }, { id: 'c', score: 50 }];
  assert.deepEqual(pickHot(hot, events, { today: '2026-10-18' }).map((e) => e.id), ['a', 'c']);
  assert.deepEqual(pickHot(hot, events, { region: 'seoul', today: '2026-10-18' }).map((e) => e.id), ['c']);
  assert.match(renderHot(pickHot(hot, events, { today: '2026-10-18' }), { today: '2026-10-18' }), /hot-rank">2</);
});
