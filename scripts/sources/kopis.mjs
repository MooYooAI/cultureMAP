// KOPIS 공연예술통합전산망 - 공연목록 조회(pblprfr). 연극·뮤지컬·클래식·국악·대중음악 등.
// 키: kopis.or.kr OpenAPI 신청 → 환경변수 KOPIS_KEY. 출처표시 필수: "공연예술통합전산망(KOPIS)".
// 목록 응답에는 좌표가 없어 lat/lng가 null이다(목록에는 보이고 지도에는 안 보임).
// 다음 단계: 공연시설 상세(prfplc)의 la/lo로 좌표를 채운다.
import { ymd, cleanText, fetchText, parseXmlItems } from './common.mjs';
import { regionFromText } from '../../src/assets/lib/regions.js';

export const name = 'kopis';
export const envKey = 'KOPIS_KEY';

const BASE = process.env.KOPIS_URL || 'https://www.kopis.or.kr/openApi/restful/pblprfr';

export function mapItem(it) {
  const startDate = ymd(it.prfpdfrom);
  const endDate = ymd(it.prfpdto) || startDate;
  const region = regionFromText(it.area);
  if (!startDate || !region) return null;
  return {
    id: `kopis-${it.mt20id}`,
    title: cleanText(it.prfnm),
    category: 'performance',
    region,
    city: '',
    venue: cleanText(it.fcltynm),
    address: '',
    lat: null,
    lng: null,
    startDate,
    endDate,
    time: '',
    price: '',
    isFree: false,
    description: cleanText(it.genrenm),
    url: `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id=${encodeURIComponent(it.mt20id)}`,
    image: it.poster ? { url: it.poster.replace(/^http:/, 'https:'), license: 'poster' } : null,
    source: { name, id: String(it.mt20id), url: null },
  };
}

export async function load({ key, from, to }) {
  const out = [];
  for (let page = 1; page <= 30; page++) {
    const params = new URLSearchParams({
      service: key,
      stdate: from.replace(/-/g, ''),
      eddate: to.replace(/-/g, ''),
      cpage: String(page),
      rows: '100',
    });
    const items = parseXmlItems(await fetchText(`${BASE}?${params}`), 'db');
    out.push(...items.map(mapItem).filter(Boolean));
    if (items.length < 100) break;
  }
  return out;
}
