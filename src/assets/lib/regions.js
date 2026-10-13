// 전국 17개 시·도. slug는 URL(/region/<slug>/)과 데이터의 region 필드에 쓰인다.
export const REGIONS = [
  { slug: 'seoul', name: '서울', fullName: '서울특별시', lat: 37.5665, lng: 126.978, tourAreaCode: '1' },
  { slug: 'busan', name: '부산', fullName: '부산광역시', lat: 35.1796, lng: 129.0756, tourAreaCode: '6' },
  { slug: 'daegu', name: '대구', fullName: '대구광역시', lat: 35.8714, lng: 128.6014, tourAreaCode: '4' },
  { slug: 'incheon', name: '인천', fullName: '인천광역시', lat: 37.4563, lng: 126.7052, tourAreaCode: '2' },
  { slug: 'gwangju', name: '광주', fullName: '광주광역시', lat: 35.1595, lng: 126.8526, tourAreaCode: '5' },
  { slug: 'daejeon', name: '대전', fullName: '대전광역시', lat: 36.3504, lng: 127.3845, tourAreaCode: '3' },
  { slug: 'ulsan', name: '울산', fullName: '울산광역시', lat: 35.5384, lng: 129.3114, tourAreaCode: '7' },
  { slug: 'sejong', name: '세종', fullName: '세종특별자치시', lat: 36.48, lng: 127.289, tourAreaCode: '8' },
  { slug: 'gyeonggi', name: '경기', fullName: '경기도', lat: 37.4138, lng: 127.5183, tourAreaCode: '31' },
  { slug: 'gangwon', name: '강원', fullName: '강원특별자치도', lat: 37.8228, lng: 128.1555, tourAreaCode: '32' },
  { slug: 'chungbuk', name: '충북', fullName: '충청북도', lat: 36.8, lng: 127.7, tourAreaCode: '33' },
  { slug: 'chungnam', name: '충남', fullName: '충청남도', lat: 36.5184, lng: 126.8, tourAreaCode: '34' },
  { slug: 'jeonbuk', name: '전북', fullName: '전북특별자치도', lat: 35.7175, lng: 127.153, tourAreaCode: '37' },
  { slug: 'jeonnam', name: '전남', fullName: '전라남도', lat: 34.8679, lng: 126.991, tourAreaCode: '38' },
  { slug: 'gyeongbuk', name: '경북', fullName: '경상북도', lat: 36.4919, lng: 128.8889, tourAreaCode: '35' },
  { slug: 'gyeongnam', name: '경남', fullName: '경상남도', lat: 35.4606, lng: 128.2132, tourAreaCode: '36' },
  { slug: 'jeju', name: '제주', fullName: '제주특별자치도', lat: 33.4996, lng: 126.5312, tourAreaCode: '39' },
];

export const REGION_BY_SLUG = Object.fromEntries(REGIONS.map((r) => [r.slug, r]));

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
