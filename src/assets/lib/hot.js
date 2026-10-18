// "지금 많이 찾는 축제" 줄. 빌드 때 미리 그려 넣는 HTML과 브라우저 화면이 같은 함수를 쓴다.
// hot: 빌드가 events.json에 넣어 둔 [{ id, score }] (score = 최근 7일 네이버 블로그 글 수).
import { eventStatus, formatRange } from './events.js';
import { REGION_BY_SLUG } from './regions.js';
import { esc, eventPath } from './render.js';

export const HOT_LIMIT = 10;

export function pickHot(hot, events, { region = '', today } = {}) {
  const byId = new Map(events.map((e) => [e.id, e]));
  return (hot || [])
    .map((h) => byId.get(h.id))
    .filter((e) => e && e.endDate >= today && (!region || e.region === region))
    .slice(0, HOT_LIMIT);
}

export function renderHot(list, { root = './', today } = {}) {
  return list
    .map((e, i) => {
      const status = eventStatus(e, today);
      return `<li><a class="hot-item" href="${root}${eventPath(e)}"><span class="hot-rank">${i + 1}</span><span class="hot-body"><span class="hot-title">${esc(e.title)}</span><span class="hot-meta"><b class="hot-status status-${status.key}">${esc(status.label)}</b> ${esc(REGION_BY_SLUG[e.region]?.name || '')} · ${esc(formatRange(e.startDate, e.endDate))}</span></span></a></li>`;
    })
    .join('');
}
