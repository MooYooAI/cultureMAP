// 지도+목록 화면. 데이터는 빌드 때 만든 data/events.json 하나만 읽는다(앱으로 확장할 때도 같은 JSON을 쓰면 된다).
import { filterEvents, sortEvents, todayInSeoul, hasLocation, formatRange, periodRange, distanceKm, CATEGORIES } from './lib/events.js';
import { renderCard, esc, eventPath, placeLabel } from './lib/render.js';
import { REGIONS, REGION_BY_SLUG } from './lib/regions.js';
import { loadWeather, describe, outingTip } from './lib/weather.js';
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
let weather = null;

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
  $('#list').innerHTML = list.map((e) => renderCard(e, { root, today, origin, wx: wxChip(e) })).join('');
  $('#empty').hidden = list.length > 0;
  renderMarkers(list, fit);
  renderMapWeather();
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
  map.on('moveend', renderMapWeather);
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
    map.fitBounds(L.latLngBounds(located.map((e) => [e.lat, e.lng])), { padding: [30, 30], maxZoom: 12 });
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

// ---- 날씨: 일정 카드마다 가는 날 날씨, 지도 위에는 보고 있는 지역의 주말 날씨 ----

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dowOf = (key) => DOW[new Date(`${key}T00:00:00Z`).getUTCDay()];

// 갈 수 있는 첫날: 오늘·시작일·고른 기간의 첫날 중 가장 늦은 날. 예보(16일) 밖이면 표시하지 않는다.
function visitDay(e) {
  const from = periodRange(state.period, today)?.from || today;
  return [today, from, e.startDate].sort().pop();
}

function wxChip(e) {
  const date = visitDay(e);
  if (!weather || date > e.endDate) return '';
  const d = weather[e.region]?.days[date];
  if (!d) return '';
  const { icon, label } = describe(d.code);
  const when = date === today ? '오늘' : dowOf(date);
  const wet = d.rain >= 50 ? ' is-wet' : '';
  return `<span class="wx-tag${wet}" title="${when} ${label}, ${d.max}° / ${d.min}°${d.rain == null ? '' : `, 비 ${d.rain}%`}">${when} ${icon} ${d.max}°</span>`;
}

// 지역을 골랐으면 그 지역, 지도를 확대해 보고 있으면 가운데와 가장 가까운 시·도, 전국을 보고 있으면 내 위치 근처(없으면 서울).
function mapRegion() {
  if (state.region) return { r: REGION_BY_SLUG[state.region], hint: false };
  const near = (p) => REGIONS.reduce((a, b) => (distanceKm(p, b) < distanceKm(p, a) ? b : a));
  if (map && map.getZoom() >= 9) {
    const c = map.getCenter();
    return { r: near({ lat: c.lat, lng: c.lng }), hint: false };
  }
  return { r: origin ? near(origin) : REGION_BY_SLUG.seoul, hint: true };
}

function renderMapWeather() {
  const box = $('#wx-map');
  if (!weather) return;
  const { r, hint } = mapRegion();
  const w = weather[r.slug];
  const wk = periodRange('weekend', today);
  const keys = [...new Set([today, wk.from, wk.to])].filter((k) => w?.days[k]);
  if (!keys.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  // 한마디는 주말 중 비 올 확률이 높은 날 기준(주말 예보가 없으면 오늘)
  const wkDays = [wk.from, wk.to].map((k) => w.days[k]).filter(Boolean);
  const focus = wkDays.sort((a, b) => (b.rain ?? 0) - (a.rain ?? 0))[0] || w.days[today];
  box.innerHTML = `<p class="wx-map-title">🌈 ${r.name} 나들이 날씨</p>
<ol>${keys
    .map((k) => {
      const d = w.days[k];
      const { icon, label } = describe(d.code);
      const isWk = k >= wk.from && k <= wk.to;
      return `<li class="${isWk ? 'is-weekend' : ''}"><span class="wx-map-day">${k === today ? '오늘' : `${dowOf(k)}요일`}</span><span class="wx-map-ico" title="${label}">${icon}</span><b>${d.max}°</b><small>${d.min}°</small>${d.rain >= 30 ? `<small class="wx-map-rain">☔ ${d.rain}%</small>` : ''}</li>`;
    })
    .join('')}</ol>
<p class="wx-map-tip">${outingTip(focus)}</p>${hint ? '<p class="wx-map-hint">지도를 확대하면 그 지역 날씨로 바뀌어요</p>' : ''}`;
}

async function initWeather() {
  try {
    weather = await loadWeather();
  } catch {
    return; // 날씨를 못 받아도 행사 화면은 그대로 둔다.
  }
  if (events.length) render();
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
  initWeather();
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
