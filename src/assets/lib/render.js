// 목록 카드 HTML. 빌드 때 미리 그려 넣는 목록(검색엔진용)과 브라우저 화면이 같은 함수를 쓴다.
import { KEYWORD_BY_SLUG } from './keywords.js';
import { CATEGORIES, eventStatus, formatRange, distanceKm, hasLocation } from './events.js';
import { REGION_BY_SLUG, cityLabel } from './regions.js';

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function eventPath(e) {
  return `events/${encodeURIComponent(e.id)}/`;
}

export function placeLabel(e) {
  const region = REGION_BY_SLUG[e.region]?.name || '';
  const city = e.city && e.city !== region ? ` ${e.city}` : '';
  return `${region}${city} · ${e.venue}`;
}

// 카드의 기간은 한 줄에 들어가야 한다. 해를 넘기는 기간은 요일을 빼고 연도를 두 자리로 줄인다(26.11.28 ~ 27.1.31).
function cardRange(e) {
  if (e.startDate.slice(0, 4) === e.endDate.slice(0, 4)) return formatRange(e.startDate, e.endDate);
  const short = (iso) => iso.slice(2).split('-').map(Number).join('.');
  return `${short(e.startDate)} ~ ${short(e.endDate)}`;
}

// 티켓 왼쪽 날짜 칸: 시작 전이면 시작일, 진행 중이면 마지막 날을 크게 보여 준다.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function ticketStub(e, status) {
  const upcoming = status.key === 'upcoming';
  const [y, m, d] = (upcoming ? e.startDate : e.endDate).split('-').map(Number);
  const dow = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `<div class="stub" aria-hidden="true"><span class="stub-m">${m}월</span><span class="stub-d">${d}</span><span class="stub-w">${dow} ${upcoming ? '시작' : '마감'}</span></div>`;
}

export function renderCard(e, { root = './', today, origin = null } = {}) {
  const status = eventStatus(e, today);
  const dist =
    origin && hasLocation(e) ? `<span class="dist">${distanceKm(origin, e).toFixed(1)}km</span>` : '';
  const free = e.isFree ? '<span class="badge free">무료</span>' : '';
  const noMap = hasLocation(e) ? '' : '<span class="badge muted">지도 위치 없음</span>';
  // 사진은 카드 오른쪽 높이를 꽉 채운다. 공공누리 제3유형(변경금지) 사진은 자르지 않고, 남는 자리는 같은 사진을 흐리게 깔아 메운다.
  const photo = e.image?.url
    ? `<div class="photo" style="--img:url(&quot;${esc(e.image.url.replace(/"/g, '%22'))}&quot;)"><img src="${esc(e.image.url)}" alt="" loading="lazy" decoding="async"></div>`
    : `<div class="photo photo-none thumb-${esc(e.category)}" aria-hidden="true"></div>`;
  const mapBtn = hasLocation(e)
    ? `<button type="button" class="map-btn" aria-label="${esc(e.title)} 지도에서 보기">지도</button>`
    : '';
  return `<li class="card" data-id="${esc(e.id)}" data-cat="${esc(e.category)}" data-status="${status.key}">
  <div class="stub-col">${ticketStub(e, status)}${mapBtn}</div>
  <div class="card-body">
    <div class="card-tags"><span class="badge cat-${esc(e.category)}">${esc(CATEGORIES[e.category] || '')}</span><span class="badge status-${status.key}">${esc(status.label)}</span>${free}${noMap}${dist}</div>
    <h2 class="card-title"><a href="${root}${eventPath(e)}">${esc(e.title)}</a></h2>
    <p class="card-date"><span class="card-range">${esc(cardRange(e))}</span>${e.time ? ` · ${esc(e.time)}` : ''}</p>
    <p class="card-place">${esc(placeLabel(e))}</p>
  </div>
  ${photo}
</li>`;
}

// 검색어 맞춤 목록 페이지 주소. 지역·종류·기간 조합마다 빌드가 같은 주소로 페이지를 만든다.
// (지역+시군구, 지역+월, 지역+종류, 지역+이번 주말, 월, 종류, 이번 주말, 이번 달, 내 주변, 지역만, 전국)
// 시군구 이름은 한글 그대로 쓰되 주소에는 %로 바꿔 넣는다(파일 이름은 decodeURI로 되돌린다).
export function landingPath({ region = '', city = '', category = '', period = 'all', month = 0, tag = '', near = false } = {}) {
  if (tag) return `keyword/${tag}/`;
  if (near) return 'nearby/';
  if (region && city) return `region/${region}/${encodeURIComponent(city)}/`;
  if (region && month) return `region/${region}/month/${month}/`;
  if (month) return `month/${month}/`;
  if (region && category) return `region/${region}/${category}/`;
  if (region && period === 'weekend') return `region/${region}/weekend/`;
  if (region) return `region/${region}/`;
  if (category) return `category/${category}/`;
  if (period === 'weekend') return 'weekend/';
  if (period === 'month') return 'this-month/';
  return '';
}

// 목록 제목: "서울 축제 일정", "강원도 이번 주말 축제·공연·전시", "10월 전국 축제·공연·전시 일정", "강릉 축제 일정".
export function listHeading({ region = '', city = '', category = '', period = 'all', month = 0, tag = '', near = false, today }) {
  const regionName = region ? REGION_BY_SLUG[region]?.searchName || '전국' : '전국';
  const place = city && region ? cityLabel(region, city) : regionName;
  if (tag && KEYWORD_BY_SLUG[tag]) return `${place} #${KEYWORD_BY_SLUG[tag].name} 축제·행사`;
  const what = category ? CATEGORIES[category] : '축제·공연·전시';
  if (near && !region) return `내 주변 ${what}`;
  if (month) return `${month}월 ${place} ${what} 일정`;
  switch (period) {
    case 'today':
      return `오늘 ${place} ${what}`;
    case 'weekend':
      return `${place} 이번 주말 ${what}`;
    case 'week':
      return `${place} 7일 안 ${what} 일정`;
    case 'month':
      return `${Number(today.slice(5, 7))}월 ${place} ${what} 일정`;
    default:
      return `${place} ${what} 일정`;
  }
}
