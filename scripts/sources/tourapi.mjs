// 한국관광공사 TourAPI 국문 관광정보 서비스 - 행사정보조회(searchFestival2). 지역 축제·행사.
// 키: 공공데이터포털 "한국관광공사_국문 관광정보 서비스_GW" 활용신청 → 환경변수 TOURAPI_KEY (디코딩된 키).
// 응답 필드는 공개 문서 기준이며, 키 발급 후 실제 응답으로 한 번 확인할 것.
// 사진 대부분이 공공누리 제3유형(변경금지)이라 화면에서 자르지 않고 원본 비율로 보여 준다(image.license = 'kogl-3').
import { ymd, num, cleanText, fetchText } from './common.mjs';
import { regionFromTourAreaCode, regionFromText } from '../../src/assets/lib/regions.js';

export const name = 'tourapi';
export const envKey = 'TOURAPI_KEY';

const BASE = process.env.TOURAPI_URL || 'https://apis.data.go.kr/B551011/KorService2/searchFestival2';

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

export async function load({ key, from }) {
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
  return out;
}
