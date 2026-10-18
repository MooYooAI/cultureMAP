// 목록 카드 HTML. 빌드 때 미리 그려 넣는 목록(검색엔진용)과 브라우저 화면이 같은 함수를 쓴다.
import { CATEGORIES, eventStatus, formatRange, distanceKm, hasLocation } from './events.js';
import { REGION_BY_SLUG } from './regions.js';

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
  return `<li class="card" data-id="${esc(e.id)}" data-cat="${esc(e.category)}">
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
