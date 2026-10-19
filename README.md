# 지역문화공연지도

전국 축제·공연·전시 일정을 지도와 목록으로 보여 주는 정적 웹사이트입니다. 서버 없이 Cloudflare Pages(https://festanow.com)에 올라가고, 하루 두 번 데이터를 새로 모아 다시 배포합니다.

## 무엇이 있나

- **첫 화면**: 지역(17개 시·도), 기간(오늘·이번 주말·7일 안·이번 달), 종류(축제·공연·전시·행사), 무료만, 검색어로 거르기. 모바일은 목록/지도 전환, 넓은 화면은 나란히 보기. 조건은 주소(`?period=weekend&cat=festival`)에 남아 그대로 공유됩니다.
- **내 주변 순**: 브라우저 위치로 가까운 행사부터 정렬.
- **지역별 페이지** `region/<slug>/`: "서울 축제·공연·전시 일정" 같은 검색어로 들어오도록 지역마다 따로 만든 페이지.
- **행사 상세 페이지** `events/<id>/`: 기간·장소·요금, 카카오맵 길찾기, 네이버 지도, 공유, 같은 지역 다른 행사. 검색엔진용 구조화 데이터(schema.org Event) 포함.
- 사이트맵, 앱 설치용 manifest, 404 페이지.

## 실행

```bash
npm install
npm test          # 테스트
npm run build     # dist/ 생성 (API 키가 없으면 샘플 데이터)
npm run serve     # http://localhost:8080/
```

## 데이터

화면은 빌드 때 만든 `dist/data/events.json` 하나만 읽습니다. 나중에 앱을 만들어도 같은 JSON을 쓰면 됩니다.

수집은 `scripts/sources/`에서 합니다. 환경변수에 키가 있는 출처만 쓰고, 하나도 없으면 `data/sample-events.json`(샘플)을 씁니다.

| 출처 | 파일 | 환경변수 | 다루는 것 |
|---|---|---|---|
| 한국관광공사 TourAPI | `tourapi.mjs` | `TOURAPI_KEY` | 지역 축제·행사 (좌표·사진) |
| KOPIS 공연예술통합전산망 | `kopis.mjs` | `KOPIS_KEY` | 예매 공연 (목록엔 좌표 없음) |
| 문화포털 한눈에보는문화정보 | `culture.mjs` | `CULTURE_KEY` | 전시·공공 문화행사 |

- 제목+장소+시작일이 같은 행사는 하나로 합칩니다(`dedupeEvents`).
- 형식이 맞지 않는 행사는 빼고 빌드 로그에 사유를 남깁니다(`scripts/validate.mjs`). 한 출처가 실패해도 나머지로 배포합니다.
- 각 출처의 응답 필드는 공개 문서 기준이라, 키를 받은 뒤 실제 응답으로 한 번 확인해야 합니다(각 파일 `mapItem`).
- 출처표시 문구는 `site.config.mjs`에 있고, 실제로 쓰인 출처만 페이지 하단에 나옵니다. TourAPI 사진(공공누리 제3유형)은 자르지 않고 원본 비율로 보여 줍니다.
- 새 출처는 같은 모양(`name`, `envKey`, `load`, `mapItem`)의 파일을 만들어 `scripts/sources/index.mjs`의 `SOURCES`에 넣으면 됩니다.

정규화된 행사 형태는 `scripts/sources/common.mjs` 맨 위 주석에 있습니다.

### 지금 많이 찾는 축제

`scripts/trends.mjs`가 진행 중이거나 30일 안에 시작하는 축제마다 다음(카카오) 블로그 검색을 최신순으로 읽어, 최근 7일 동안 올라온 글(제목·요약에 축제 이름이 들어간 것) 수를 세어 `data/events.json`의 `hot`에 넣습니다. 목록 위에 1~10위가 나오고, 지역을 고르면 그 지역 것만 보입니다.

- 키: developers.kakao.com → 앱 만들기 → "REST API 키"를 `KAKAO_REST_KEY` 시크릿으로 넣습니다(카드 등록 없음). 없거나 호출이 실패하면 그 줄만 숨고 빌드는 계속됩니다.
- 축제 하나에 50개씩 최대 6번 읽습니다(대부분 1번). 블로그 검색 하루 한도는 30,000건이고, 다음 검색은 유료 요금표에 없어 넘으면 호출만 막힙니다.
- "김치축제"처럼 흔한 이름은 다른 지역 같은 이름 축제의 검색량이 섞일 수 있습니다.

## 배포 (Cloudflare Pages)

1. Cloudflare **Workers 및 Pages**에 직접 업로드(Direct Upload) 방식의 Pages 프로젝트 `culturemap`을 만들고, 사용자 설정 도메인에 `festanow.com`, `www.festanow.com`을 연결합니다.
2. Cloudflare API 토큰(권한: 계정 / Cloudflare Pages / 편집)과 계정 ID를 저장소 **Settings → Secrets and variables → Actions**에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`로 넣습니다.
3. `main`에 병합하면 `.github/workflows/deploy.yml`이 테스트·빌드 후 Cloudflare에 올립니다. 매일 06시·18시(한국 시간)에도 다시 빌드합니다.
4. API 키는 같은 곳에 `TOURAPI_KEY`, `KOPIS_KEY`, `CULTURE_KEY`(인기 축제는 `KAKAO_REST_KEY`)로 넣습니다. 코드나 저장소에는 넣지 마세요.
5. 사이트 주소는 `site.config.mjs`의 기본값(`https://festanow.com`)을 쓰고, 바꾸려면 Actions 변수 `SITE_URL`을 설정합니다.

샘플 데이터로 빌드한 사이트는 검색엔진에 올라가지 않도록 `noindex`가 붙습니다. 실제 데이터로 바뀌면 자동으로 빠집니다. 그때 구글 서치 콘솔과 네이버 서치어드바이저에 `sitemap.xml`을 등록하세요.

## 앞으로

- 지도 타일: 지금은 OpenStreetMap 공용 타일입니다. 방문자가 늘면 VWorld·카카오 등 키가 있는 타일로 바꾸세요(`site.config.mjs`의 `tiles`).
- KOPIS 공연 좌표: 공연시설 상세 API로 채우면 지도에도 나옵니다.
