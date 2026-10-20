import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tourapi from '../scripts/sources/tourapi.mjs';
import * as kopis from '../scripts/sources/kopis.mjs';
import * as culture from '../scripts/sources/culture.mjs';
import { parseXmlItems, dedupeEvents, isFreeText, cleanText } from '../scripts/sources/common.mjs';
import { validateEvents } from '../scripts/validate.mjs';
import { loadAllEvents } from '../scripts/sources/index.mjs';

const quiet = { log() {}, warn() {}, error() {} };

test('TourAPI 행사 → 정규화', () => {
  const e = tourapi.mapItem({
    contentid: '123', title: '진주남강유등축제', addr1: '경상남도 진주시 남강로 626', addr2: '(본성동)', areacode: '36',
    mapx: '128.079', mapy: '35.188', eventstartdate: '20261010', eventenddate: '20261025', firstimage: 'http://tong.visitkorea.or.kr/a.jpg',
  });
  assert.equal(e.id, 'tourapi-123');
  assert.equal(e.region, 'gyeongnam');
  assert.equal(e.city, '진주시');
  assert.equal(e.lat, 35.188);
  assert.equal(e.endDate, '2026-10-25');
  assert.deepEqual(e.image, { url: 'https://tong.visitkorea.or.kr/a.jpg', license: 'kogl-3' });
  assert.equal(validateEvents([e]).errors.length, 0);
});

test('KOPIS XML → 정규화 (좌표 없음)', () => {
  const xml = `<?xml version="1.0"?><dbs><db><mt20id>PF1</mt20id><prfnm><![CDATA[뮤지컬 <예시>]]></prfnm><prfpdfrom>2026.10.01</prfpdfrom><prfpdto>2026.11.30</prfpdto><fcltynm>세종문화회관</fcltynm><poster>http://www.kopis.or.kr/p.gif</poster><area>서울특별시</area><genrenm>뮤지컬</genrenm></db></dbs>`;
  const [e] = parseXmlItems(xml, 'db').map(kopis.mapItem);
  assert.equal(e.title, '뮤지컬 <예시>');
  assert.equal(e.region, 'seoul');
  assert.equal(e.lat, null);
  assert.equal(e.startDate, '2026-10-01');
  assert.equal(validateEvents([e]).errors.length, 0);
});

test('문화포털 → 정규화, 장르로 종류 결정', () => {
  const e = culture.mapItem({ seq: '9', title: '특별전', startDate: '20260915', endDate: '20270110', place: '국립중앙박물관', realmName: '전시', area: '서울', gpsX: '126.98', gpsY: '37.52', price: '무료' });
  assert.equal(e.category, 'exhibition');
  assert.equal(e.isFree, true);
  assert.equal(validateEvents([e]).errors.length, 0);
});

test('무료 판정', () => {
  assert.equal(isFreeText('무료'), true);
  assert.equal(isFreeText('무료(일부 유료 10,000원)'), false);
  assert.equal(isFreeText('전석 30,000원'), false);
});

test('중복 제거: 제목·장소·시작일이 같으면 합치고 좌표를 채운다', () => {
  const a = { title: '뮤지컬 예시', venue: '세종문화회관', startDate: '2026-10-01', lat: null, lng: null, image: null };
  const b = { title: '뮤지컬  예시', venue: '세종 문화회관', startDate: '2026-10-01', lat: 37.5, lng: 126.9, image: null };
  const out = dedupeEvents([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0].lat, 37.5);
});

test('검증: 잘못된 행사는 빼고 사유를 남긴다', () => {
  const { valid, errors } = validateEvents([
    { id: 'x-1', title: 'ok', category: 'festival', region: 'seoul', startDate: '2026-10-01', endDate: '2026-10-02', lat: null, lng: null },
    { id: 'x-2', title: 'bad', category: 'festival', region: 'mars', startDate: '2026-10-03', endDate: '2026-10-01', lat: 10, lng: 10 },
  ]);
  assert.equal(valid.length, 1);
  assert.match(errors[0], /region.*종료일.*국내 범위/);
});

test('키가 없으면 샘플 데이터, 샘플은 모두 유효', async () => {
  const { events, sources } = await loadAllEvents({ today: '2026-10-13', env: {}, log: quiet });
  assert.deepEqual(sources, ['sample']);
  assert.ok(events.length >= 25);
  const regions = new Set(events.map((e) => e.region));
  assert.equal(regions.size, 17, '17개 시도 모두 샘플이 있어야 함');
});

test('한 출처가 실패해도 다른 출처로 계속', async () => {
  const realLoad = kopis.load;
  const env = { KOPIS_KEY: 'x', TOURAPI_KEY: 'y' };
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('kopis')) return new Response('down', { status: 500 });
    return new Response(JSON.stringify({ response: { body: { totalCount: 1, items: { item: [{ contentid: '1', title: 'T', addr1: '서울특별시 종로구', areacode: '1', mapx: '126.9', mapy: '37.5', eventstartdate: '20261010', eventenddate: '20261020' }] } } } }));
  };
  try {
    const { events, sources } = await loadAllEvents({ today: '2026-10-13', env, log: quiet });
    assert.deepEqual(sources, ['tourapi']);
    assert.equal(events.length, 1);
  } finally {
    globalThis.fetch = origFetch;
  }
  assert.equal(kopis.load, realLoad);
});

test('두 번 이스케이프된 제목도 원래 글자로 푼다', () => {
  assert.equal(cleanText('연극 &amp;lt;그녀를 믿지마세요&amp;gt;'), '연극 <그녀를 믿지마세요>');
  assert.equal(cleanText('&quot;Birth &ndash;Death&quot;'), '"Birth –Death"');
  assert.equal(cleanText('파보 예르비 &amp;amp; 에스토니안'), '파보 예르비 & 에스토니안');
  assert.equal(cleanText('&#39;가을&#x27;'), "'가을'");
  assert.equal(cleanText('A &unknown; B'), 'A &unknown; B');
});

test('관광공사 소개정보로 시간·요금을 채우고, 받은 건 다시 부르지 않는다', async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const cacheFile = join(await mkdtemp(join(tmpdir(), 'tour-')), 'detail.json');
  const ev = (id) => ({ source: { id }, time: '', price: '', isFree: false });
  const origFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    const id = new URL(url).searchParams.get('contentId');
    calls.push(id);
    const item = id === '1' ? { playtime: '10:00~18:00<br>야간 19:00~22:00', usetimefestival: '무료' } : { playtime: '', usetimefestival: '성인 5,000원' };
    return new Response(JSON.stringify({ response: { header: { resultCode: '0000' }, body: { items: { item: [item] } } } }));
  };
  try {
    const a = await tourapi.addDetails([ev('1'), ev('2'), ev('3')], { key: 'k', cacheFile, budget: 2, log: quiet });
    assert.deepEqual(calls, ['1', '2']);
    assert.equal(a[0].time, '10:00~18:00 / 야간 19:00~22:00');
    assert.equal(a[0].isFree, true);
    assert.equal(a[1].price, '성인 5,000원');
    assert.equal(a[2].time, '');
    calls.length = 0;
    const b = await tourapi.addDetails([ev('1'), ev('2'), ev('3')], { key: 'k', cacheFile, budget: 2, log: quiet });
    assert.deepEqual(calls, ['3'], '저장된 행사는 다시 부르지 않음');
    assert.equal(b[0].time, '10:00~18:00 / 야간 19:00~22:00');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('fetchText: 접속 실패와 5xx는 다시 시도하고, 4xx는 바로 실패', async () => {
  const { fetchText } = await import('../scripts/sources/common.mjs');
  const origFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls === 1) throw new TypeError('fetch failed');
      if (calls === 2) return new Response('busy', { status: 503 });
      return new Response('ok');
    };
    assert.equal(await fetchText('https://x/?serviceKey=SECRET', { delays: [0, 0] }), 'ok');
    assert.equal(calls, 3);

    calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response('nope', { status: 401, statusText: 'Unauthorized' });
    };
    await assert.rejects(fetchText('https://x/?serviceKey=SECRET', { delays: [0, 0] }), (err) => !err.message.includes('SECRET'));
    assert.equal(calls, 1);

    globalThis.fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await assert.rejects(fetchText('https://x/', { delays: [0, 0] }), /fetch failed/);
  } finally {
    globalThis.fetch = origFetch;
  }
});
