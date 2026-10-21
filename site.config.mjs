// 사이트 전체 설정. 도메인을 연결하면 SITE_URL 환경변수(또는 아래 기본값)만 바꾸면 된다.
export default {
  siteName: '페스타나우',
  // 검색엔진이 같은 사이트로 알아보도록 알려 주는 다른 이름들.
  alternateNames: ['FestaNow', 'festanow', '페스타 나우'],
  tagline: '전국 축제·공연·전시 일정을 지도로 한눈에',
  // 로고 옆(모바일은 아래)에 눈에 띄게 붙는 한마디.
  hook: '이번 주말 어디 가지? 🎉',
  description:
    '지금 전국 곳곳에서 열리는 축제, 공연, 전시 일정을 지역·날짜·종류별로 지도와 목록에서 찾아보세요. 이번 주말 갈 만한 곳, 내 주변 무료 행사까지.',
  // 사이트 주소(끝에 / 없이). 사이트맵·대표 주소(canonical)·404 페이지 경로에 쓰인다.
  siteUrl: (process.env.SITE_URL || 'https://festanow.com').replace(/\/$/, ''),
  // 검색엔진 소유 확인 태그 값(네이버 서치어드바이저). 모든 페이지 <head>에 들어간다.
  verification: {
    naver: '50a4284d33c0363d3093253063cc33695df755e5',
  },
  // 지도 타일: 키 없이 쓰는 OpenStreetMap. 산·숲 색은 styles.css에서 옅게 눌러 단순하게 보이게 한다.
  // (CARTO 타일은 실제 사이트에서 지도 대신 API 키 안내 문구가 떠서 쓰지 않는다.)
  // 트래픽이 커지면 VWorld·카카오 등 키가 있는 타일로 바꾸는 것을 권장(OSM 공용 서버 이용 정책).
  tiles: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  // 출처별 표시 문구. 실제로 쓰인 출처만 페이지 하단에 나온다.
  attributions: {
    sample: '현재 화면의 행사는 샘플 데이터입니다. 날짜와 내용은 예시이며 실제 일정과 다를 수 있습니다.',
    tourapi: '본 저작물은 한국관광공사에서 작성하여 공공누리 제1유형·제3유형으로 개방한 저작물을 이용하였습니다.',
    kopis: '공연 정보 출처: 공연예술통합전산망(KOPIS)',
    culture: '본 저작물은 한국문화정보원에서 작성하여 공공누리 제1유형으로 개방한 저작물을 이용하였습니다.',
    trend: '지금 많이 찾는 축제: 다음 블로그 검색(최근 7일 동안 올라온 글 수, 카카오 검색 API)',
    kfes: '지금 많이 찾는 축제 순위: 한국관광공사 대한민국 구석구석 축제(사람들이 많이 본 축제)',
  },
};
