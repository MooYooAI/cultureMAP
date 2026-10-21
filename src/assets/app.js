// 지도+목록 화면. 데이터는 빌드 때 만든 data/events.json 하나만 읽는다(앱으로 확장할 때도 같은 JSON을 쓰면 된다).
import { filterEvents, sortEvents, todayInSeoul, hasLocation, formatRange, periodRange, addDays, CATEGORIES } from './lib/events.js';
import { renderCard, esc, eventPath, placeLabel, landingPath, listHeading } from './lib/render.js';
import { REGIONS, REGION_BY_SLUG } from './lib/regions.js';
import { loadWeather, describe, outingTip } from './lib/weather.js';
import { addBaseTiles } from './lib/tiles.js';
import { pickHot, renderHot } from './lib/hot.js';

const root = document.body.dataset.root || './';
const presetRegion = document.body.dataset.presetRegion || '';
// 검색어 맞춤 페이지(서울 축제, 이번 주말 등)는 종류·기간이 미리 골라진 채로 열린다.
const presetCategory = document.body.dataset.presetCategory || '';
const presetPeriod = document.body.dataset.presetPeriod || 'all';
// 추천 키워드 페이지(#가을꽃 등)는 키워드를 유지한 채 화면 안에서 지역·기간·종류를 고른다.
const presetTag = document.body.dataset.presetTag || '';
const hasPreset = Boolean(presetRegion || presetCategory || presetPeriod !== 'all') && !presetTag;
const $ = (sel) => document.querySelector(sel);

const today = todayInSeoul();
const state = readState();
let events = [];
let hot = [];
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
    category: p.has('cat') ? (p.get('cat') === 'all' ? '' : p.get('cat')) : presetCategory,
    period: p.get('period') || presetPeriod,
    tag: presetTag,
    freeOnly: p.get('free') === '1',
    view: p.get('view') === 'map' ? 'map' : 'list',
  };
}

function writeState() {
  const p = new URLSearchParams();
  if (state.q) p.set('q', state.q);
  if (state.region && !presetRegion) p.set('region', state.region);
  if (state.category !== presetCategory) p.set('cat', state.category || 'all');
  if (state.period !== presetPeriod) p.set('period', state.period);
  if (state.freeOnly) p.set('free', '1');
  if (state.view === 'map') p.set('view', 'map');
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function syncControls() {
  $('#q').value = state.q;
  $('#region').value = state.region;
  $('#free').checked = state.freeOnly;
  $('#period').value = state.period;
  $('#category').value = state.category;
  for (const [id, base] of [['#region', ''], ['#period', 'all'], ['#category', '']]) {
    $(id).classList.toggle('is-set', $(id).value !== base);
  }
  setView(state.view, false);
}

function current() {
  return sortEvents(filterEvents(events, state, today), today, origin);
}

function render({ fit = false } = {}) {
  const list = current();
  const heading = listHeading({ ...state, today });
  $('#heading').textContent = heading;
  // 아무 조건 없는 첫 화면 제목은 로고 옆 문구와 겹쳐서 화면에서는 숨긴다(검색엔진용으로는 남김).
  $('#heading').classList.toggle('sr-only', heading === listHeading({ today }));
  $('#count').textContent = `${list.length}개 행사${origin ? ' · 가까운 순' : ''}`;
  $('#list').innerHTML = list.map((e) => renderCard(e, { root, today, origin })).join('');
  $('#empty').hidden = list.length > 0;
  renderMarkers(list, fit);
  renderHotList();
  renderWeather();
  writeState();
}

// ---- 지금 많이 찾는 축제 (지역을 고르면 그 지역 것만) ----

function renderHotList() {
  const list = pickHot(hot, events, { region: state.region, today });
  $('#hot').hidden = list.length === 0;
  $('#hot-list').innerHTML = renderHot(list, { root, today });
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

// ---- 날씨 (오른쪽 배너 자리 + 좁은 화면에서는 목록 위 한 줄) ----
// 지역을 고르면 그 지역의 오늘·7일 예보, 전국이면 시·도별 오늘 날씨를 보여 준다.

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const dowOf = (key) => DOW[new Date(`${key}T00:00:00Z`).getUTCDay()];

function renderWeather() {
  const card = $('#wx');
  const strip = $('#wx-strip');
  if (!weather) return;
  const w = state.region ? weather[state.region] : null;
  const day = w?.days[today];
  if (state.region && !day) {
    card.hidden = strip.hidden = true;
    return;
  }
  card.hidden = strip.hidden = false;
  if (!state.region) {
    const cells = REGIONS.filter((r) => weather[r.slug]?.days[today]).map((r) => {
      const d = weather[r.slug].days[today];
      const { icon, label } = describe(d.code);
      return `<button type="button" class="wx-cell" data-region="${r.slug}" title="${r.name} ${label} ${d.max}° / ${d.min}°"><span>${r.name}</span><span class="wx-ico">${icon}</span><b>${d.max}°</b></button>`;
    });
    card.innerHTML = `<header class="wx-head"><h2>전국 오늘 날씨</h2><span class="wx-sub">낮 최고</span></header>
<div class="wx-grid">${cells.join('')}</div>
<p class="wx-hint">지역을 누르면 그 지역 행사와 주간 예보가 나와요</p>`;
    strip.classList.remove('is-region');
    strip.innerHTML = `<span class="wx-strip-title">오늘 날씨</span>${cells.join('')}`;
    return;
  }
  const name = REGION_BY_SLUG[state.region].name;
  const { icon, label } = describe(day.code);
  const weekend = periodRange('weekend', today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i)).filter((k) => w.days[k]);
  const rain = day.rain == null ? '' : ` · 비 ${day.rain}%`;
  card.innerHTML = `<header class="wx-head"><h2>${esc(name)} 날씨</h2>${w.now ? `<span class="wx-sub">지금 ${w.now.temp}°</span>` : ''}</header>
<div class="wx-today"><span class="wx-big">${icon}</span><div><p class="wx-temp"><b>${day.max}°</b> / ${day.min}°</p><p class="wx-desc">${label}${rain}</p></div></div>
<p class="wx-tip">${outingTip(day)}</p>
<ol class="wx-week">${week
    .map((k, i) => {
      const d = w.days[k];
      const wk = k >= weekend.from && k <= weekend.to;
      return `<li class="${wk ? 'is-weekend' : ''}"><span>${i === 0 ? '오늘' : dowOf(k)}</span><span class="wx-ico">${describe(d.code).icon}</span><b>${d.max}°</b><small>${d.min}°</small></li>`;
    })
    .join('')}</ol>`;
  const sat = w.days[weekend.from];
  const sun = w.days[weekend.to];
  const wkText = weekend.from === today ? '' : sat ? ` <span class="wx-strip-wk">주말 ${describe(sat.code).icon}${sun && weekend.to !== weekend.from ? describe(sun.code).icon : ''}</span>` : '';
  strip.classList.add('is-region');
  strip.innerHTML = `<span class="wx-strip-title">${esc(name)} 오늘</span><span class="wx-strip-main">${icon} <b>${day.max}°</b>/${day.min}°${rain}</span><span class="wx-strip-tip">${outingTip(day)}</span>${wkText}`;
}

async function initWeather() {
  try {
    weather = await loadWeather();
  } catch {
    return; // 날씨를 못 받아도 행사 화면은 그대로 둔다.
  }
  renderWeather();
}

function pickRegion(slug) {
  const sel = $('#region');
  sel.value = slug;
  sel.dispatchEvent(new Event('change'));
}

// ---- 이벤트 연결 ----

function bindPicker(id, key) {
  $(id).addEventListener('change', (ev) => {
    state[key] = ev.target.value;
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
    // 지역·종류별 페이지에서는 같은 종류의 다른 지역 페이지로 이동해 주소(검색 노출용)를 유지한다.
    if (hasPreset) {
      location.href = root + landingPath({ region: ev.target.value, category: presetCategory, period: presetPeriod });
      return;
    }
    state.region = ev.target.value;
    render({ fit: true });
  });
  $('#free').addEventListener('change', (ev) => {
    state.freeOnly = ev.target.checked;
    render({ fit: true });
  });
  bindPicker('#period', 'period');
  bindPicker('#category', 'category');
  for (const b of document.querySelectorAll('.view-toggle [data-view]')) {
    b.addEventListener('click', () => setView(b.dataset.view));
  }
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { q: '', category: presetCategory, period: presetPeriod, freeOnly: false, region: presetRegion });
    syncControls();
    render({ fit: true });
  });
  $('#near').addEventListener('click', locate);
  // 모바일: 로고 오른쪽 돋보기를 누르면 검색창이 펼쳐진다(PC는 검색창이 늘 보인다).
  $('#search-toggle')?.addEventListener('click', () => setSearchOpen(!document.body.classList.contains('search-open')));
  $('#q').addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !state.q) setSearchOpen(false);
  });
  for (const id of ['#wx', '#wx-strip']) {
    $(id).addEventListener('click', (ev) => {
      const cell = ev.target.closest('.wx-cell');
      if (cell) pickRegion(cell.dataset.region);
    });
  }
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

function setSearchOpen(open, focus = true) {
  document.body.classList.toggle('search-open', open);
  $('#search-toggle')?.setAttribute('aria-expanded', String(open));
  if (open && focus) $('#q').focus();
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
  if (state.q) setSearchOpen(true, false);
  bind();
  initWeather();
  try {
    const res = await fetch(`${root}data/events.json`);
    const data = await res.json();
    events = data.events;
    hot = data.hot || [];
  } catch {
    $('#count').textContent = '행사 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
    return;
  }
  // Leaflet(defer)은 이 모듈보다 먼저 실행되지만, 혹시 늦게 오면 load 후에 지도를 그린다.
  if (window.L) render({ fit: true });
  else window.addEventListener('load', () => render({ fit: true }), { once: true });
}

init();
