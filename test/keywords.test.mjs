import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventKeywords, seasonalKeywords } from '../src/assets/lib/keywords.js';
import { filterEvents } from '../src/assets/lib/events.js';
import { landingPath, listHeading } from '../src/assets/lib/render.js';

test('행사 제목·소개글로 추천 키워드를 붙인다', () => {
  assert.deepEqual(eventKeywords({ title: '마산가고파국화축제', description: '' }), ['autumn-flower']);
  assert.deepEqual(eventKeywords({ title: '진주남강유등축제', description: '' }), ['night-view']);
  assert.ok(eventKeywords({ title: '문경 사과축제', description: '' }).includes('food'));
  assert.deepEqual(eventKeywords({ title: '어느 공연', description: '' }), []);
});

test('이번 달 키워드는 계절 것을 앞에, 행사가 있는 것만', () => {
  const events = [{ tags: ['autumn-flower'] }, { tags: ['food'] }, { tags: ['water'] }];
  assert.deepEqual(seasonalKeywords(events, '2026-10-21').map((k) => k.slug), ['autumn-flower', 'food']);
});

test('키워드로 거르고, 키워드 페이지 주소와 제목', () => {
  const e = (tags) => ({ startDate: '2026-10-01', endDate: '2026-10-30', region: 'seoul', category: 'festival', tags, title: '', venue: '' });
  assert.equal(filterEvents([e(['food']), e([])], { tag: 'food' }, '2026-10-21').length, 1);
  assert.equal(landingPath({ tag: 'food' }), 'keyword/food/');
  assert.equal(listHeading({ tag: 'food', today: '2026-10-21' }), '전국 #먹거리 축제·행사');
});
