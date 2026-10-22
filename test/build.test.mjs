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
  assert.match(index, /<h1 id="heading">전국 축제·공연·전시 일정<\/h1>/, '첫 화면 제목도 화면에 보인다');
  assert.match(index, /<title>전국 축제 일정 2026 · /);
  assert.match(index, /class="card"/, '검색엔진용으로 목록을 미리 그려 둔다');
  assert.match(index, /noindex/, '샘플 데이터는 검색 제외');
  assert.doesNotMatch(index, /서울세계불꽃축제/, '끝난 행사는 첫 화면 목록에서 빠진다');
  assert.match(index, /<section id="hot" class="hot"[^>]*hidden>/, '검색량 키가 없으면 인기 축제 줄을 숨긴다');
  assert.match(index, /<div class="search-row">[\s\S]*<select id="region"[\s\S]*<select id="period"[\s\S]*<select id="category"/, '지역·기간·종류는 고르는 칸');
  assert.match(index, /id="wx-strip"[^>]*><\/div>\s*<div class="filter-extra">[\s\S]*id="free"[\s\S]*id="near"/, "무료만·내 주변 순은 날씨 줄 아래");
  assert.match(index, /id="search-toggle"/);

  const seoul = await read('region/seoul/index.html');
  assert.match(seoul, /서울 축제·공연·전시 일정/);
  assert.match(seoul, /data-preset-region="seoul"/);
  assert.match(seoul, /href="\.\.\/\.\.\/assets\/styles\.css"/);

  const ev = result.events.find((e) => e.title === '진주남강유등축제');
  const page = await read(`events/${ev.id}/index.html`);
  assert.match(page, /"@type":"Festival"/);
  assert.match(page, /map\.kakao\.com\/link\/to\//);

  assert.match(index, /\| 페스타나우<\/title>/, '사이트 이름은 페스타나우');
  assert.match(index, /property="og:image" content="[^"]*\/assets\/og\.png"/);
  await access(new URL('../dist/assets/og.png', import.meta.url));

  // 검색어 맞춤 목록 페이지
  const seoulFest = await read('region/seoul/festival/index.html');
  assert.match(seoulFest, /<h1 id="heading">서울 축제 일정<\/h1>/);
  assert.match(seoulFest, /data-preset-category="festival"/);
  assert.match(seoulFest, /href="\.\.\/\.\.\/\.\.\/assets\/styles\.css"/);
  assert.match(seoulFest, /<select id="category" aria-label="종류" class="is-set">[\s\S]*?<option value="festival" selected>/);
  const weekend = await read('weekend/index.html');
  assert.match(weekend, /<h1 id="heading">전국 이번 주말 축제·공연·전시<\/h1>/);
  assert.match(weekend, /<title>전국 이번 주말 축제·공연·전시 \(10\.17\(토\) ~ 10\.18\(일\)\)/);
  assert.match(await read('this-month/index.html'), /10월 전국 축제·공연·전시 일정/);
  assert.match(await read('category/exhibition/index.html'), /전국 전시 일정/);
  assert.match(page, /href="\.\.\/\.\.\/region\/gyeongnam\/festival\/"/, '상세 페이지에서 지역×종류 페이지로 이어진다');

  // 검색어별 페이지: 월별, 지역×월, 시군구, 내 주변, 도 이름 제목
  assert.match(seoul, /<title>서울 축제 일정 2026 · 서울특별시/);
  const gangwon = await read('region/gangwon/index.html');
  assert.match(gangwon, /<h1 id="heading">강원도 축제·공연·전시 일정<\/h1>/);
  const nov = await read('month/11/index.html');
  assert.match(nov, /<title>2026년 11월 축제 일정 · /);
  assert.match(nov, /data-preset-month="11"/);
  assert.match(await read('month/1/index.html'), /2027년 1월 축제 일정/, '지난 달은 다음 해로');
  assert.match(await read('this-month/index.html'), /rel="canonical" href="https:\/\/festanow\.com\/month\/10\/"/);
  assert.match(await read('region/gyeongnam/month/10/index.html'), /<h1 id="heading">10월 경남 축제·공연·전시 일정<\/h1>/);
  const jinju = await read('region/gyeongnam/진주시/index.html');
  assert.match(jinju, /<h1 id="heading">진주 축제·공연·전시 일정<\/h1>/);
  assert.match(jinju, /진주남강유등축제/);
  assert.match(await read('region/gyeongnam/index.html'), /href="\.\.\/\.\.\/region\/gyeongnam\/%EC%A7%84%EC%A3%BC%EC%8B%9C\/">진주</, '지역 페이지에서 시군구 페이지로 잇는다');
  const near = await read('nearby/index.html');
  assert.match(near, /<title>내 주변 축제 · /);
  assert.match(near, /data-preset-near="1"/);
  const sitemap = await read('sitemap.xml');
  assert.match(sitemap, /\/month\/11\//);
  assert.match(sitemap, /\/nearby\//);
  assert.match(sitemap, /\/region\/gyeongnam\/%EC%A7%84%EC%A3%BC%EC%8B%9C\//);
  assert.doesNotMatch(sitemap, /this-month/);
  assert.match(sitemap, /\/region\/seoul\/festival\//);
  assert.match(sitemap, /\/weekend\//);

  const data = JSON.parse(await read('data/events.json'));
  assert.equal(data.events.length, result.events.length);
  assert.match(await read('sitemap.xml'), /region\/jeju\//);
  await access(new URL('../dist/assets/vendor/leaflet/leaflet.js', import.meta.url));
  await access(new URL('../dist/404.html', import.meta.url));
});
