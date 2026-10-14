// 지도+목록 화면. 데이터는 빌드 때 만든 data/events.json 하나만 읽는다(앱으로 확장할 때도 같은 JSON을 쓰면 된다).
import { filterEvents, sortEvents, todayInSeoul, hasLocation, formatRange, CATEGORIES } from './lib/events.js';
import { renderCard, esc, eventPath, placeLabel } from './lib/render.js';
import { REGION_BY_SLUG } from './lib/regions.js';
import { addBaseTiles } from './lib/tiles.js';

const root = document.body.dataset.root || './';
const presetRegion = document.body.dataset.presetRegion || '';
const $ = (sel) => document.querySelector(sel);

const today = todayInSeoul();
const state = readState();
let events = [];
let origin = null;
let map = null;
let cluster = null;
const markers = new Map();

function readState() {
  const p = new URLSearchParams(location.search);
  return {
    q: p.get('q') || '',
    region: presetRegion || p.get('region') || '',
    category: p.get('cat') || '',
    period: p.get('period') || 'all',
    freeOnly: p.get('free') === '1',
    view: p.get('view') === 'map' ? 'map' : 'list',
  };
}

function writeState() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.region && !presetRegion) p.set('region', state.region);
  if (state.category) p.set('cat', state.category);
  if (state.period !== 'all') p.set('period', state.period);
  if (state.freeOnly) p.set('free', '1');
  if (state.view === 'map') p.set('view', 'map');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function syncControls() {
  $('#q').value = state.q;
  $('#region').value = state.region;
  $('#free').checked = state.freeOnly;
  for (const [id, key] of [['#period', 'period'], ['#category', 'category']]) {
    for (const b of document.querySelectorAll(`${id} .chip`)) {
      b.setAttribute('aria-pressed', String(b.dataset.value === (state[key] || '')));
    }
  }
  setView(state.view, false);
}

function current() {
  return sortEvents(filterEvents(events, state, today), today, origin);
}

function render({ fit = false } = {}) {
  const list = current();
  const place = state.region ? REGION_BY_SLUG[state.region]?.name : '전국';
  $('#heading').textContent = `${place} 축제·공연·전시 일정`;
  $('#count').textContent = `${list.length}개 행사${origin ? ' · 가까운 순' : ''}`;
  $('#list').innerHTML = list.map((e) => renderCard(e, { root, today, origin })).join('');
  $('#empty').hidden = list.length > 0;
  renderMarkers(list, fit);
  writeState();
}

// ---- 지도 ----

function ensureMap() {
  if (map || !window.L) return map;
  const t = window.SITE_TILES;
  map = L.map('map', { zoomControl: true, attributionControl: true }).setView([36.3, 127.8], 7);
  addBaseTiles(map, t);
  cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    iconCreateFunction: (c) =>
      L.divIcon({ className: 'pin-wrap', html: `<span class="bubble">${c.getChildCount()}</span>`, iconSize: [44, 44] }),
  });
  map.addLayer(cluster);
  map.on('zoomstart', unhighlight);
  return map;
}

const PIN_EMOJI = { festival: '🎉', performance: '🎭', exhibition: '🖼️', event: '🎈' };

function markerIcon(e) {
  return L.divIcon({
    className: 'pin-wrap',
    html: `<span class="pin pin-${e.category}${e.isFree ? ' pin-free' : ''}" aria-hidden="true"><span class="pin-emoji">${PIN_EMOJI[e.category] || '📍'}</span></span>`,
    iconSize: [40, 46],
    iconAnchor: [20, 44],
    popupAnchor: [0, -40],
  });
}

function popupHtml(e) {
  return `<div class="popup">
  <span class="badge cat-${e.category}">${esc(CATEGORIES[e.category])}</span>${e.isFree ? ' <span class="badge free">무료</span>' : ''}
  <strong><a href="${root}${eventPath(e)}">${esc(e.title)}</a></strong>
  <span>${esc(formatRange(e.startDate, e.endDate))}</span>
  <span>${esc(placeLabel(e))}</span>
</div>`;
}

function renderMarkers(list, fit) {
  if (!ensureMap()) return;
  unhighlight();
  cluster.clearLayers();
  markers.clear();
  for (const e of list.filter(hasLocation)) {
    const m = L.marker([e.lat, e.lng], { icon: markerIcon(e), title: e.title }).bindPopup(popupHtml(e));
    markers.set(e.id, m);
    cluster.addLayer(m);
  }
  if (fit) fitMap(list);
}

// 모바일 목록 보기에서는 지도가 숨어 있어 크기가 0이다. 그때는 지도를 열 때 맞춘다.
let pendingFit = null;
function fitMap(list) {
  if (!map.getContainer().offsetWidth) {
    pendingFit = list;
    return;
  }
  pendingFit = null;
  const located = list.filter(hasLocation);
  if (origin) {
    map.setView([origin.lat, origin.lng], 10);
  } else if (located.length) {
    // 넓은 화면에서는 목록·광고 패널이 지도 위에 떠 있으므로, 그 아래로 표시가 숨지 않게 비워 둔다(styles.css의 --map-inset-*).
    const css = getComputedStyle(map.getContainer());
    const inset = (side) => parseFloat(css.getPropertyValue(`--map-inset-${side}`)) || 30;
    map.fitBounds(L.latLngBounds(located.map((e) => [e.lat, e.lng])), {
      paddingTopLeft: [inset('left'), 30],
      paddingBottomRight: [inset('right'), 30],
      maxZoom: 12,
    });
  } else if (state.region) {
    const r = REGION_BY_SLUG[state.region];
    map.setView([r.lat, r.lng], 9);
  }
}

// 목록 카드에 마우스를 올리면 지도에서 그 행사 표시(묶여 있으면 묶음 표시)를 통통 튀게 한다.
let highlighted = null;
let highlightedId = null;
function highlight(id) {
  if (id === highlightedId) return;
  unhighlight();
  highlightedId = id;
  const m = markers.get(id);
  if (!m || !map) return;
  const shown = cluster.getVisibleParent(m);
  const el = shown?.getElement();
  if (!el) return;
  el.classList.add('is-hot');
  shown.setZIndexOffset(1000);
  highlighted = shown;
}

function unhighlight() {
  highlightedId = null;
  if (!highlighted) return;
  highlighted.getElement()?.classList.remove('is-hot');
  highlighted.setZIndexOffset(0);
  highlighted = null;
}

function focusEvent(id) {
  const m = markers.get(id);
  if (!m || !map) return;
  setView('map');
  cluster.zoomToShowLayer(m, () => m.openPopup());
}

// 모바일에서는 목록/지도를 탭으로 바꾸고, 넓은 화면에서는 둘 다 보인다.
function setView(view, rerender = true) {
  state.view = view;
  $('#main').dataset.view = view;
  for (const b of document.querySelectorAll('.view-toggle [data-view]')) {
    b.setAttribute('aria-selected', String(b.dataset.view === view));
  }
  if (view === 'map' && map) {
    map.invalidateSize();
    if (pendingFit) fitMap(pendingFit);
  }
  if (rerender) writeState();
}

// ---- 이벤트 연결 ----

function bindChips(id, key) {
  $(id).addEventListener('click', (ev) => {
    const b = ev.target.closest('.chip');
    if (!b) return;
    state[key] = b.dataset.value;
    syncControls();
    render({ fit: true });
  });
}

function bind() {
  let timer;
  $('#q').addEventListener('input', (ev) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.q = ev.target.value.trim();
      render({ fit: true });
    }, 150);
  });
  $('#region').addEventListener('change', (ev) => {
    // 지역별 페이지에서는 해당 지역 페이지로 이동해 주소(검색 노출용)를 유지한다.
    if (presetRegion) {
      const slug = ev.target.value;
      location.href = slug ? `${root}region/${slug}/` : root;
      return;
    }
    state.region = ev.target.value;
    render({ fit: true });
  });
  $('#free').addEventListener('change', (ev) => {
    state.freeOnly = ev.target.checked;
    render({ fit: true });
  });
  bindChips('#period', 'period');
  bindChips('#category', 'category');
  for (const b of document.querySelectorAll('.view-toggle [data-view]')) {
    b.addEventListener('click', () => setView(b.dataset.view));
  }
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { q: '', category: '', period: 'all', freeOnly: false, region: presetRegion });
    syncControls();
    render({ fit: true });
  });
  $('#near').addEventListener('click', locate);
  const list = $('#list');
  const hoverTarget = (ev) => ev.target.closest('.card')?.dataset.id;
  list.addEventListener('mouseover', (ev) => {
    const id = hoverTarget(ev);
    if (id) highlight(id);
  });
  list.addEventListener('mouseleave', unhighlight);
  list.addEventListener('focusin', (ev) => {
    const id = hoverTarget(ev);
    if (id) highlight(id);
  });
  list.addEventListener('focusout', unhighlight);
  $('#list').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.map-btn');
    if (btn) focusEvent(btn.closest('.card').dataset.id);
  });
}

function locate() {
  const btn = $('#near');
  if (origin) {
    origin = null;
    btn.textContent = '📍 내 주변 순으로';
    btn.setAttribute('aria-pressed', 'false');
    render({ fit: true });
    return;
  }
  if (!navigator.geolocation) {
    alert('이 브라우저에서는 위치를 사용할 수 없어요.');
    return;
  }
  btn.textContent = '📍 위치 찾는 중…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      btn.textContent = '📍 가까운 순 해제';
      btn.setAttribute('aria-pressed', 'true');
      render({ fit: true });
    },
    () => {
      btn.textContent = '📍 내 주변 순으로';
      alert('위치를 가져오지 못했어요. 브라우저의 위치 권한을 확인해 주세요.');
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
  );
}

async function init() {
  syncControls();
  bind();
  try {
    const res = await fetch(`${root}data/events.json`);
    events = (await res.json()).events;
  } catch {
    $('#count').textContent = '행사 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
    return;
  }
  // Leaflet(defer)은 이 모듈보다 먼저 실행되지만, 혹시 늦게 오면 load 후에 지도를 그린다.
  if (window.L) render({ fit: true });
  else window.addEventListener('load', () => render({ fit: true }), { once: true });
}

init();
