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

export function renderCard(e, { root = './', today, origin = null } = {}) {
  const status = eventStatus(e, today);
  const dist =
    origin && hasLocation(e) ? `<span class="dist">${distanceKm(origin, e).toFixed(1)}km</span>` : '';
  const free = e.isFree ? '<span class="badge free">무료</span>' : '';
  const noMap = hasLocation(e) ? '' : '<span class="badge muted">지도 위치 없음</span>';
  const thumb = e.image?.url
    ? `<img class="thumb" src="${esc(e.image.url)}" alt="" loading="lazy" decoding="async">`
    : `<div class="thumb thumb-${esc(e.category)}" aria-hidden="true"></div>`;
  return `<li class="card" data-id="${esc(e.id)}">
  ${thumb}
  <div class="card-body">
    <div class="card-tags"><span class="badge cat-${esc(e.category)}">${esc(CATEGORIES[e.category] || '')}</span><span class="badge status-${status.key}">${esc(status.label)}</span>${free}${noMap}${dist}</div>
    <h2 class="card-title"><a href="${root}${eventPath(e)}">${esc(e.title)}</a></h2>
    <p class="card-date">${esc(formatRange(e.startDate, e.endDate))}${e.time ? ` · ${esc(e.time)}` : ''}</p>
    <p class="card-place">${esc(placeLabel(e))}</p>
  </div>
  ${hasLocation(e) ? `<button type="button" class="map-btn" aria-label="${esc(e.title)} 지도에서 보기">지도</button>` : ''}
</li>`;
}
