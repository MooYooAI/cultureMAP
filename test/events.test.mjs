import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periodRange, filterEvents, sortEvents, eventStatus, formatRange, todayInSeoul } from '../src/assets/lib/events.js';
import { regionFromText } from '../src/assets/lib/regions.js';

const ev = (id, startDate, endDate, extra = {}) => ({
  id, title: id, category: 'festival', region: 'seoul', venue: '', city: '', address: '', description: '', isFree: false, startDate, endDate, ...extra,
});

test('todayInSeoul은 한국 시간 기준 날짜', () => {
  // UTC 10월 12일 16시 = 한국 10월 13일 새벽 1시
  assert.equal(todayInSeoul(new Date('2026-10-12T16:00:00Z')), '2026-10-13');
});

test('이번 주말 범위', () => {
  assert.deepEqual(periodRange('weekend', '2026-10-13'), { from: '2026-10-17', to: '2026-10-18' }); // 화
  assert.deepEqual(periodRange('weekend', '2026-10-17'), { from: '2026-10-17', to: '2026-10-18' }); // 토
  assert.deepEqual(periodRange('weekend', '2026-10-18'), { from: '2026-10-18', to: '2026-10-18' }); // 일
});

test('이번 달·7일 범위', () => {
  assert.deepEqual(periodRange('month', '2026-02-10'), { from: '2026-02-10', to: '2026-02-28' });
  assert.deepEqual(periodRange('week', '2026-12-29'), { from: '2026-12-29', to: '2027-01-04' });
  assert.equal(periodRange('all', '2026-10-13'), null);
});

test('필터: 끝난 행사 제외, 기간 겹침, 지역·종류·무료·검색', () => {
  const list = [
    ev('ended', '2026-10-01', '2026-10-12'),
    ev('ongoing', '2026-10-01', '2026-10-20', { isFree: true, venue: '청계천 일대' }),
    ev('later', '2026-11-01', '2026-11-03', { region: 'busan', category: 'performance' }),
  ];
  const ids = (f) => filterEvents(list, f, '2026-10-13').map((e) => e.id);
  assert.deepEqual(ids({}), ['ongoing', 'later']);
  assert.deepEqual(ids({ period: 'weekend' }), ['ongoing']);
  assert.deepEqual(ids({ region: 'busan' }), ['later']);
  assert.deepEqual(ids({ category: 'performance' }), ['later']);
  assert.deepEqual(ids({ freeOnly: true }), ['ongoing']);
  assert.deepEqual(ids({ q: '청계 천' }), ['ongoing']);
});

test('정렬: 진행 중 먼저, 그다음 시작일 순 / 내 위치 있으면 가까운 순', () => {
  const list = [
    ev('soon', '2026-10-20', '2026-10-21', { lat: 35.1, lng: 129.0 }),
    ev('on-long', '2026-10-01', '2026-12-01', { lat: 37.5, lng: 127.0 }),
    ev('on-short', '2026-10-10', '2026-10-14'),
  ];
  assert.deepEqual(sortEvents(list, '2026-10-13').map((e) => e.id), ['on-short', 'on-long', 'soon']);
  assert.deepEqual(sortEvents(list, '2026-10-13', { lat: 35.2, lng: 129.1 }).map((e) => e.id), ['soon', 'on-long', 'on-short']);
});

test('상태 표시와 날짜 표기', () => {
  assert.equal(eventStatus(ev('a', '2026-10-14', '2026-10-15'), '2026-10-13').label, '내일 시작');
  assert.equal(eventStatus(ev('a', '2026-10-20', '2026-10-21'), '2026-10-13').label, 'D-7');
  assert.equal(eventStatus(ev('a', '2026-10-01', '2026-10-13'), '2026-10-13').label, '오늘 마지막');
  assert.equal(formatRange('2026-10-17', '2026-10-19'), '10.17(토) ~ 10.19(월)');
  assert.equal(formatRange('2026-11-28', '2027-01-31'), '2026.11.28(토) ~ 2027.1.31(일)');
});

test('지역 표기 → slug', () => {
  assert.equal(regionFromText('서울특별시'), 'seoul');
  assert.equal(regionFromText('강원특별자치도 강릉시'), 'gangwon');
  assert.equal(regionFromText('전라북도'), 'jeonbuk');
  assert.equal(regionFromText('경기 광주시'), 'gyeonggi');
  assert.equal(regionFromText('광주광역시 동구'), 'gwangju');
  assert.equal(regionFromText('경상남도'), 'gyeongnam');
  assert.equal(regionFromText('해외'), null);
});
