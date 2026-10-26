import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeArchive, fixText } from '../scripts/archive.mjs';

const ev = (id, startDate, endDate) => ({ id, startDate, endDate, title: id });

test('끝난 행사는 보관함에서 1년 동안 상세 페이지로 남는다', () => {
  const today = '2026-10-20';
  const archive = {
    old: ev('old', '2026-08-01', '2026-08-10'), // 이번 수집에서 빠진 끝난 행사 → 남김
    ancient: ev('ancient', '2025-01-01', '2025-01-05'), // 끝난 지 1년 넘음 → 버림
    cancelled: ev('cancelled', '2026-11-01', '2026-11-05'), // 안 끝났는데 빠짐 → 페이지 없음
  };
  const now = [ev('now', '2026-10-01', '2026-10-30'), ev('recent', '2026-10-01', '2026-10-05')];
  const { archive: next, ended } = mergeArchive(archive, now, today);
  assert.deepEqual(ended.map((e) => e.id), ['old']);
  assert.deepEqual(Object.keys(next).sort(), ['cancelled', 'now', 'old', 'recent']);
});

test('보관함에 남은 덜 풀린 엔티티를 읽을 때 푼다', () => {
  const e = fixText({ id: 'x', title: '&lceil;수요일 콘서트&rfloor;', url: 'https://a.kr/?a=1&amp;b=2' });
  assert.equal(e.title, '⌈수요일 콘서트⌋');
  assert.equal(e.url, 'https://a.kr/?a=1&amp;b=2');
});
