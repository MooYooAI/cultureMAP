// 전국 17개 시·도. slug는 URL(/region/<slug>/)과 데이터의 region 필드에 쓰인다.
// searchName은 사람들이 검색창에 실제로 치는 이름("강원도 축제", "충북 축제")으로, 제목에 쓴다.
export const REGIONS = [
  { slug: 'seoul', searchName: '서울', name: '서울', fullName: '서울특별시', lat: 37.5665, lng: 126.978, tourAreaCode: '1' },
  { slug: 'busan', searchName: '부산', name: '부산', fullName: '부산광역시', lat: 35.1796, lng: 129.0756, tourAreaCode: '6' },
  { slug: 'daegu', searchName: '대구', name: '대구', fullName: '대구광역시', lat: 35.8714, lng: 128.6014, tourAreaCode: '4' },
  { slug: 'incheon', searchName: '인천', name: '인천', fullName: '인천광역시', lat: 37.4563, lng: 126.7052, tourAreaCode: '2' },
  { slug: 'gwangju', searchName: '광주', name: '광주', fullName: '광주광역시', lat: 35.1595, lng: 126.8526, tourAreaCode: '5' },
  { slug: 'daejeon', searchName: '대전', name: '대전', fullName: '대전광역시', lat: 36.3504, lng: 127.3845, tourAreaCode: '3' },
  { slug: 'ulsan', searchName: '울산', name: '울산', fullName: '울산광역시', lat: 35.5384, lng: 129.3114, tourAreaCode: '7' },
  { slug: 'sejong', searchName: '세종', name: '세종', fullName: '세종특별자치시', lat: 36.48, lng: 127.289, tourAreaCode: '8' },
  { slug: 'gyeonggi', searchName: '경기도', name: '경기', fullName: '경기도', lat: 37.4138, lng: 127.5183, tourAreaCode: '31' },
  { slug: 'gangwon', searchName: '강원도', name: '강원', fullName: '강원특별자치도', lat: 37.8228, lng: 128.1555, tourAreaCode: '32' },
  { slug: 'chungbuk', searchName: '충북', name: '충북', fullName: '충청북도', lat: 36.8, lng: 127.7, tourAreaCode: '33' },
  { slug: 'chungnam', searchName: '충남', name: '충남', fullName: '충청남도', lat: 36.5184, lng: 126.8, tourAreaCode: '34' },
  { slug: 'jeonbuk', searchName: '전북', name: '전북', fullName: '전북특별자치도', lat: 35.7175, lng: 127.153, tourAreaCode: '37' },
  { slug: 'jeonnam', searchName: '전남', name: '전남', fullName: '전라남도', lat: 34.8679, lng: 126.991, tourAreaCode: '38' },
  { slug: 'gyeongbuk', searchName: '경북', name: '경북', fullName: '경상북도', lat: 36.4919, lng: 128.8889, tourAreaCode: '35' },
  { slug: 'gyeongnam', searchName: '경남', name: '경남', fullName: '경상남도', lat: 35.4606, lng: 128.2132, tourAreaCode: '36' },
  { slug: 'jeju', searchName: '제주도', name: '제주', fullName: '제주특별자치도', lat: 33.4996, lng: 126.5312, tourAreaCode: '39' },
];

export const REGION_BY_SLUG = Object.fromEntries(REGIONS.map((r) => [r.slug, r]));

// 시·군·구 페이지(/region/<slug>/<시군구>/)를 만들 수 있는 이름인지. 세종은 시 하나라 따로 두지 않는다.
const METRO = new Set(['seoul', 'busan', 'daegu', 'incheon', 'gwangju', 'daejeon', 'ulsan']);
export function isCityName(region, city) {
  return region !== 'sejong' && /^[가-힣]{1,6}(시|군|구)$/.test(city || '');
}

// 시·군·구 제목 이름: 도 지역은 "강릉", "경주"처럼 시·군을 떼고(실제 검색어), 광역시는 "부산 해운대구"처럼 앞에 붙인다.
export function cityLabel(region, city) {
  if (METRO.has(region)) return `${REGION_BY_SLUG[region]?.name || ''} ${city}`.trim();
  return city.length > 2 ? city.slice(0, -1) : city;
}

// 외부 데이터의 지역 표기(서울특별시, 서울, 강원도, 전라북도, 경기 수원시 ...)를 slug로 바꾼다.
const ALIASES = [
  ['seoul', ['서울']],
  ['busan', ['부산']],
  ['daegu', ['대구']],
  ['incheon', ['인천']],
  ['gwangju', ['광주']],
  ['daejeon', ['대전']],
  ['ulsan', ['울산']],
  ['sejong', ['세종']],
  ['gyeonggi', ['경기']],
  ['gangwon', ['강원']],
  ['chungbuk', ['충청북도', '충북']],
  ['chungnam', ['충청남도', '충남']],
  ['jeonbuk', ['전라북도', '전북']],
  ['jeonnam', ['전라남도', '전남']],
  ['gyeongbuk', ['경상북도', '경북']],
  ['gyeongnam', ['경상남도', '경남']],
  ['jeju', ['제주']],
];

export function regionFromText(text) {
  if (!text) return null;
  // "경기 광주시"는 경기로, 맨 앞이 "광주"면 광주광역시로 본다(앞에서부터 비교).
  const t = String(text).trim();
  for (const [slug, words] of ALIASES) {
    if (words.some((w) => t.startsWith(w))) return slug;
  }
  return null;
}

export function regionFromTourAreaCode(code) {
  const r = REGIONS.find((x) => x.tourAreaCode === String(code));
  return r ? r.slug : null;
}
