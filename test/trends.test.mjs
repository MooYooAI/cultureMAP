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

test('최근 7일 블로그 글 수로 순위를 매긴다', async () => {
  const events = [fest('a', '제3회 가나 축제', '2026-10-10', '2026-10-20'), fest('b', '다라축제', '2026-10-15', '2026-10-25'), fest('c', '마바 축제', '2026-10-16', '2026-10-26')];
  const post = (title, postdate) => ({ title, description: '', postdate });
  // 가나 축제: 최근 글 150개(두 쪽) + 오래된 글. 다라축제: 최근 2개 중 하나는 이름이 없는 글. 마바 축제: 오래된 글만.
  const pages = {
    '가나 축제': [
      Array.from({ length: 100 }, () => post('<b>가나</b> 축제 다녀옴', '20261017')),
      [...Array.from({ length: 50 }, () => post('가나축제 후기', '20261012')), post('가나 축제', '20261001')],
    ],
    다라축제: [[post('다라 축제 일정', '20261016'), post('주말 나들이', '20261015'), post('다라축제', '20260901')]],
    '마바 축제': [[post('마바 축제', '20260920')]],
  };
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const u = new URL(url);
    calls.push(u.searchParams.get('query'));
    assert.equal(opts.headers['X-Naver-Client-Id'], 'id');
    assert.equal(u.searchParams.get('sort'), 'date');
    const page = (Number(u.searchParams.get('start')) - 1) / 100;
    return { ok: true, json: async () => ({ items: pages[u.searchParams.get('query')][page] || [] }) };
  };
  const hot = await loadHotFestivals({ events, today: '2026-10-18', env: { NAVER_CLIENT_ID: 'id', NAVER_CLIENT_SECRET: 's' }, fetchImpl, log: quiet });
  assert.deepEqual(hot, [{ id: 'a', score: 150 }, { id: 'b', score: 1 }]);
  assert.deepEqual(calls, ['가나 축제', '가나 축제', '다라축제', '마바 축제']);
});

test('API가 실패하면 빈 목록(빌드는 계속)', async () => {
  const events = [fest('a', '가 축제', '2026-10-10', '2026-10-20')];
  const fetchImpl = async () => ({ ok: false, status: 429, statusText: 'Too Many Requests' });
  const hot = await loadHotFestivals({ events, today: '2026-10-18', env: { NAVER_CLIENT_ID: 'i', NAVER_CLIENT_SECRET: 'k' }, fetchImpl, log: quiet });
  assert.deepEqual(hot, []);
});

test('지역별로 거르고 끝난 축제는 뺀다', () => {
  const events = [fest('a', '가', '2026-10-10', '2026-10-20', 'busan'), fest('b', '나', '2026-10-01', '2026-10-05'), fest('c', '다', '2026-10-10', '2026-10-20')];
  const hot = [{ id: 'a', score: 100 }, { id: 'b', score: 80 }, { id: 'c', score: 50 }];
  assert.deepEqual(pickHot(hot, events, { today: '2026-10-18' }).map((e) => e.id), ['a', 'c']);
  assert.deepEqual(pickHot(hot, events, { region: 'seoul', today: '2026-10-18' }).map((e) => e.id), ['c']);
  assert.match(renderHot(pickHot(hot, events, { today: '2026-10-18' }), { today: '2026-10-18' }), /hot-rank">2</);
});
