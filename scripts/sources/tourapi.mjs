// 한국관광공사 TourAPI 국문 관광정보 서비스 - 행사정보조회(searchFestival2). 지역 축제·행사.
// 키: 공공데이터포털 "한국관광공사_국문 관광정보 서비스_GW" 활용신청 → 환경변수 TOURAPI_KEY (디코딩된 키).
// 응답 필드는 공개 문서 기준이며, 키 발급 후 실제 응답으로 한 번 확인할 것.
// 사진 대부분이 공공누리 제3유형(변경금지)이라 화면에서 자르지 않고 원본 비율로 보여 준다(image.license = 'kogl-3').
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ymd, num, cleanText, fetchText, isFreeText } from './common.mjs';
import { regionFromTourAreaCode, regionFromText } from '../../src/assets/lib/regions.js';

export const name = 'tourapi';
export const envKey = 'TOURAPI_KEY';

const BASE = process.env.TOURAPI_URL || 'https://apis.data.go.kr/B551011/KorService2/searchFestival2';
const DETAIL = process.env.TOURAPI_DETAIL_URL || 'https://apis.data.go.kr/B551011/KorService2/detailIntro2';
// 목록에는 시간·요금이 없어 행사마다 소개정보(detailIntro2)를 한 번 더 부른다.
// 하루 호출 한도(개발 키 1,000건)를 넘지 않도록 받은 결과는 파일에 저장해 두고(CI에서는 actions/cache로 이어 감),
// 빌드 한 번에 새로 부르는 건수를 DETAIL_BUDGET으로 묶는다. 다 못 받은 행사는 다음 빌드에서 이어 받는다.
const DETAIL_CACHE = process.env.TOURAPI_DETAIL_CACHE || '.cache/tourapi-detail.json';
const DETAIL_BUDGET = Number(process.env.TOURAPI_DETAIL_BUDGET || 300);
const DETAIL_MAX_AGE_DAYS = 7;

export function mapItem(it) {
  const startDate = ymd(it.eventstartdate);
  const endDate = ymd(it.eventenddate) || startDate;
  const address = [it.addr1, it.addr2].filter(Boolean).join(' ').trim();
  const region = regionFromTourAreaCode(it.areacode) || regionFromText(it.addr1);
  if (!startDate || !region) return null;
  const city = (it.addr1 || '').split(/\s+/)[1] || '';
  return {
    id: `tourapi-${it.contentid}`,
    title: cleanText(it.title),
    category: 'festival',
    region,
    city,
    venue: cleanText(it.addr2) || city || address,
    address,
    lat: num(it.mapy),
    lng: num(it.mapx),
    startDate,
    endDate,
    time: '',
    price: '',
    isFree: false,
    description: '',
    url: null,
    image: it.firstimage ? { url: it.firstimage.replace(/^http:/, 'https:'), license: 'kogl-3' } : null,
    source: { name, id: String(it.contentid), url: null },
  };
}

// 소개정보의 여러 줄 문자열(<br>로 나뉨)을 한 줄로 합친다.
function oneLine(raw) {
  return cleanText(raw).split(/\n+/).map((x) => x.trim()).filter(Boolean).join(' / ');
}

export function mapDetail(it) {
  return { time: oneLine(it?.playtime), price: oneLine(it?.usetimefestival) };
}

async function readCache(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

export async function addDetails(events, { key, cacheFile = DETAIL_CACHE, budget = DETAIL_BUDGET, now = Date.now(), log = console } = {}) {
  const cache = await readCache(cacheFile);
  const fresh = (c) => c && now - c.at < DETAIL_MAX_AGE_DAYS * 864e5;
  // 캐시에 없는 행사부터, 그다음 오래된 순으로 새로 받는다.
  const todo = events
    .filter((e) => !fresh(cache[e.source.id]))
    .sort((a, b) => (cache[a.source.id]?.at || 0) - (cache[b.source.id]?.at || 0))
    .slice(0, budget);
  let failed = 0;
  let got = 0;
  for (const e of todo) {
    const params = new URLSearchParams({
      serviceKey: key,
      MobileOS: 'ETC',
      MobileApp: 'jiyeok-culture-map',
      _type: 'json',
      contentId: e.source.id,
      contentTypeId: '15',
    });
    try {
      const res = JSON.parse(await fetchText(`${DETAIL}?${params}`))?.response;
      if (res?.header?.resultCode !== '0000') throw new Error(res?.header?.resultMsg || '응답 형식이 다름');
      const raw = res.body?.items?.item;
      cache[e.source.id] = { ...mapDetail(Array.isArray(raw) ? raw[0] : raw), at: now };
      got++;
    } catch (err) {
      // 한도 초과 등으로 실패하면 이번 빌드는 여기까지 받고, 나머지는 다음 빌드에서 받는다.
      failed++;
      if (failed === 1) log.warn(`[data] tourapi 소개정보 조회 실패: ${err.message}`);
      if (failed >= 5) break;
    }
  }
  for (const e of events) {
    const d = cache[e.source.id];
    if (!d) continue;
    if (d.time) e.time = d.time;
    if (d.price) Object.assign(e, { price: d.price, isFree: isFreeText(d.price) });
  }
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cache));
  log.log(`[data] tourapi 소개정보: ${got}건 새로 받음, ${events.filter((e) => cache[e.source.id]).length}/${events.length}건 보유`);
  return events;
}

export async function load({ key, from, log = console }) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      serviceKey: key,
      MobileOS: 'ETC',
      MobileApp: 'jiyeok-culture-map',
      _type: 'json',
      arrange: 'A',
      numOfRows: '100',
      pageNo: String(page),
      eventStartDate: from.replace(/-/g, ''),
    });
    const body = JSON.parse(await fetchText(`${BASE}?${params}`))?.response?.body;
    const raw = body?.items?.item || [];
    const items = Array.isArray(raw) ? raw : [raw];
    out.push(...items.map(mapItem).filter(Boolean));
    if (!items.length || page * 100 >= Number(body?.totalCount || 0)) break;
  }
  return addDetails(out, { key, log });
}
