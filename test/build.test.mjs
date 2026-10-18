import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { build } from '../scripts/build.mjs';

const read = (p) => readFile(new URL(`../dist/${p}`, import.meta.url), 'utf8');

test('빌드 결과물', async () => {
  const origWarn = console.warn;
  const origLog = console.log;
  console.warn = console.log = () => {};
  let result;
  try {
    result = await build({ today: '2026-10-13' });
  } finally {
    console.warn = origWarn;
    console.log = origLog;
  }
  const index = await read('index.html');
  assert.match(index, /<h1 id="heading">전국 축제·공연·전시 일정<\/h1>/);
  assert.match(index, /class="card"/, '검색엔진용으로 목록을 미리 그려 둔다');
  assert.match(index, /noindex/, '샘플 데이터는 검색 제외');
  assert.doesNotMatch(index, /서울세계불꽃축제/, '끝난 행사는 첫 화면 목록에서 빠진다');
  assert.match(index, /<section id="hot" class="hot"[^>]*hidden>/, '검색량 키가 없으면 인기 축제 줄을 숨긴다');
  assert.match(index, /<div class="filter-bar">[\s\S]*id="period"[\s\S]*id="category"[\s\S]*id="free"/);

  const seoul = await read('region/seoul/index.html');
  assert.match(seoul, /서울 축제·공연·전시 일정/);
  assert.match(seoul, /data-preset-region="seoul"/);
  assert.match(seoul, /href="\.\.\/\.\.\/assets\/styles\.css"/);

  const ev = result.events.find((e) => e.title === '진주남강유등축제');
  const page = await read(`events/${ev.id}/index.html`);
  assert.match(page, /"@type":"Festival"/);
  assert.match(page, /map\.kakao\.com\/link\/to\//);

  const data = JSON.parse(await read('data/events.json'));
  assert.equal(data.events.length, result.events.length);
  assert.match(await read('sitemap.xml'), /region\/jeju\//);
  await access(new URL('../dist/assets/vendor/leaflet/leaflet.js', import.meta.url));
  await access(new URL('../dist/404.html', import.meta.url));
});
