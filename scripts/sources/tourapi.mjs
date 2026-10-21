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
const COMMON = process.env.TOURAPI_COMMON_URL || 'https://apis.data.go.kr/B551011/KorService2/detailCommon2';
const INFO = process.env.TOURAPI_INFO_URL || 'https://apis.data.go.kr/B551011/KorService2/detailInfo2';
// 목록에는 시간·요금·개요·행사내용이 없어 행사마다 소개정보(detailIntro2: 시간·요금·프로그램),
// 공통정보(detailCommon2: 개요), 반복정보(detailInfo2: '행사내용' — 프로그램·출연진)를 한 번씩 더 부른다.
// 하루 호출 한도(개발 키 1,000건)를 넘지 않도록 받은 결과는 파일에 저장해 두고(CI에서는 actions/cache로 이어 감),
// 빌드 한 번에 새로 부르는 건수를 DETAIL_BUDGET으로 묶는다. 다 못 받은 행사는 다음 빌드에서 이어 받는다.
const DETAIL_CACHE = process.env.TOURAPI_DETAIL_CACHE || '.cache/tourapi-detail.json';
const DETAIL_BUDGET = Number(process.env.TOURAPI_DETAIL_BUDGET || 110); // 행사 하나에 최대 3건씩 부른다
const CACHE_VERSION = 2; // 2: 행사내용(content)·프로그램·부대행사까지 저장
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

// 여러 줄 글: 줄은 살리고 빈 줄은 하나로.
function lines(raw) {
  return cleanText(raw).split(/\n+/).map((x) => x.trim()).filter(Boolean).join('\n');
}

export function mapDetail(it) {
  return { time: oneLine(it?.playtime), price: oneLine(it?.usetimefestival), program: lines(it?.program), subevent: lines(it?.subevent) };
}

// 반복정보에서 '행사내용'(없으면 '프로그램'이 들어간 항목)을 꺼낸다.
export function mapInfo(items) {
  const list = Array.isArray(items) ? items : items ? [items] : [];
  const pick = list.find((x) => /행사\s*내용/.test(x.infoname || '')) || list.find((x) => /프로그램|출연|라인업/.test(x.infoname || ''));
  return lines(pick?.infotext);
}

// 개요: 줄바꿈은 단락으로 살리고, 빈 줄이 여러 개면 하나로 줄인다.
export function mapOverview(it) {
  return lines(it?.overview);
}

async function getItems(url, params) {
  const res = JSON.parse(await fetchText(`${url}?${new URLSearchParams(params)}`))?.response;
  if (res?.header?.resultCode !== '0000') throw new Error(res?.header?.resultMsg || '응답 형식이 다름');
  return res.body?.items?.item;
}

async function getItem(url, params) {
  const raw = await getItems(url, params);
  return Array.isArray(raw) ? raw[0] : raw;
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
  const young = (c) => c && now - c.at < DETAIL_MAX_AGE_DAYS * 864e5;
  // 예전 형식으로 저장된 기록은 새 항목(행사내용 등)을 받으러 다시 부른다(개요는 아직 새것이면 다시 받지 않는다).
  const fresh = (c) => young(c) && c.v === CACHE_VERSION;
  // 캐시에 없는 행사부터, 그다음 오래된 순으로 새로 받는다.
  const todo = events
    .filter((e) => !fresh(cache[e.source.id]))
    .sort((a, b) => (cache[a.source.id]?.at || 0) - (cache[b.source.id]?.at || 0))
    .slice(0, budget);
  let failed = 0;
  let got = 0;
  for (const e of todo) {
    const params = { serviceKey: key, MobileOS: 'ETC', MobileApp: 'jiyeok-culture-map', _type: 'json', contentId: e.source.id };
    try {
      const old = cache[e.source.id];
      const intro = await getItem(DETAIL, { ...params, contentTypeId: '15' });
      const info = await getItems(INFO, { ...params, contentTypeId: '15' });
      const overview = young(old) && 'overview' in old ? old.overview : mapOverview(await getItem(COMMON, params));
      cache[e.source.id] = { ...mapDetail(intro), content: mapInfo(info), overview, at: now, v: CACHE_VERSION };
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
    if (d.overview) e.description = d.overview;
    // 행사내용: 반복정보의 '행사내용'을 먼저, 없으면 소개정보의 프로그램.
    const content = d.content || d.program;
    if (content) e.program = content;
    if (d.subevent) e.subevent = d.subevent;
  }
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cache));
  log.log(`[data] tourapi 소개정보: ${got}건 새로 받음, ${events.filter((e) => cache[e.source.id]).length}/${events.length}건 보유, 시간 있음 ${events.filter((e) => e.time).length}건, 개요 있음 ${events.filter((e) => e.description).length}건, 행사내용 있음 ${events.filter((e) => e.program).length}건`);
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
