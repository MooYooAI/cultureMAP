// 한국문화정보원 한눈에보는문화정보 - 기간별 조회. 전시와 공공 문화시설 행사·공연.
// 키: 공공데이터포털 "한국문화정보원_한눈에보는문화정보조회서비스" 활용신청 → 환경변수 CULTURE_KEY.
// 엔드포인트 주소와 필드명은 공개 문서 기준 추정이므로 키 발급 후 실제 응답으로 확인하고,
// 다르면 CULTURE_URL 환경변수나 아래 mapItem만 고치면 된다.
import { ymd, num, cleanText, fetchText, parseXmlItems, isFreeText } from './common.mjs';
import { regionFromText } from '../../src/assets/lib/regions.js';

export const name = 'culture';
export const envKey = 'CULTURE_KEY';

const BASE = process.env.CULTURE_URL || 'https://apis.data.go.kr/B553457/cultureinfo/period2';

function categoryFromRealm(realm) {
  const r = String(realm || '');
  if (/전시|미술/.test(r)) return 'exhibition';
  if (/축제/.test(r)) return 'festival';
  if (/연극|뮤지컬|음악|콘서트|국악|무용|오페라|공연/.test(r)) return 'performance';
  return 'event';
}

export function mapItem(it) {
  const startDate = ymd(it.startDate);
  const endDate = ymd(it.endDate) || startDate;
  const region = regionFromText(it.area);
  if (!startDate || !region) return null;
  const price = cleanText(it.price);
  return {
    id: `culture-${it.seq}`,
    title: cleanText(it.title),
    category: categoryFromRealm(it.realmName),
    region,
    city: cleanText(it.sigungu),
    venue: cleanText(it.place),
    address: '',
    lat: num(it.gpsY),
    lng: num(it.gpsX),
    startDate,
    endDate,
    time: '',
    price,
    isFree: isFreeText(price),
    description: '',
    url: it.url || null,
    image: it.thumbnail ? { url: it.thumbnail.replace(/^http:/, 'https:'), license: 'poster' } : null,
    source: { name, id: String(it.seq), url: null },
  };
}

export async function load({ key, from, to }) {
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const params = new URLSearchParams({
      serviceKey: key,
      from: from.replace(/-/g, ''),
      to: to.replace(/-/g, ''),
      PageNo: String(page),
      numOfrows: '100',
    });
    const items = parseXmlItems(await fetchText(`${BASE}?${params}`), 'item');
    out.push(...items.map(mapItem).filter(Boolean));
    if (items.length < 100) break;
  }
  return out;
}
