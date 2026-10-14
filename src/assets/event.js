// 행사 상세 페이지: 상태 배지를 오늘 기준으로 고치고, 공유 버튼과 작은 지도를 붙인다.
import { eventStatus, todayInSeoul } from './lib/events.js';
import { addBaseTiles } from './lib/tiles.js';

const status = document.getElementById('status');
if (status) {
  const s = eventStatus({ startDate: status.dataset.start, endDate: status.dataset.end }, todayInSeoul());
  status.textContent = s.label;
  status.className = `badge status-${s.key}`;
}

document.getElementById('share')?.addEventListener('click', async (ev) => {
  const data = { title: document.title, url: location.href };
  try {
    if (navigator.share) await navigator.share(data);
    else {
      await navigator.clipboard.writeText(location.href);
      ev.target.textContent = '링크 복사됨';
    }
  } catch {
    // 사용자가 공유를 취소한 경우
  }
});

function miniMap() {
  const el = document.getElementById('mini-map');
  if (!el || !window.L) return;
  const t = window.SITE_TILES;
  const pos = [Number(el.dataset.lat), Number(el.dataset.lng)];
  const map = L.map(el, { scrollWheelZoom: false, dragging: !L.Browser.mobile }).setView(pos, 15);
  addBaseTiles(map, t);
  L.marker(pos, {
    icon: L.divIcon({
      className: 'pin-wrap',
      html: '<span class="pin pin-here"><span class="pin-ico"></span></span>',
      iconSize: [40, 46],
      iconAnchor: [20, 44],
    }),
    title: el.dataset.title,
  }).addTo(map);
}

if (window.L) miniMap();
else window.addEventListener('load', miniMap, { once: true });
