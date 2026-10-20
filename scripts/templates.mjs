// 빌드 때 만드는 HTML 페이지 템플릿. root는 페이지 위치에서 사이트 맨 위까지의 상대 경로('./', '../../').
import config from '../site.config.mjs';
import { esc, renderCard, eventPath, placeLabel } from '../src/assets/lib/render.js';
import { CATEGORIES, PERIODS, formatRange, hasLocation, eventStatus } from '../src/assets/lib/events.js';
import { REGIONS, REGION_BY_SLUG } from '../src/assets/lib/regions.js';
import { renderHot } from '../src/assets/lib/hot.js';

function abs(path) {
  return `${config.siteUrl}/${path}`;
}

export function layout({ root, path, title, description, body, head = '', scripts = '', noindex, sources, bodyAttrs = '' }) {
  const fullTitle = title === config.siteName ? title : `${title} | ${config.siteName}`;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<link rel="canonical" href="${esc(abs(path))}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(abs(path))}">
<meta property="og:locale" content="ko_KR">
<meta name="theme-color" content="#ff7eb3">
${config.verification?.naver ? `<meta name="naver-site-verification" content="${esc(config.verification.naver)}">\n` : ''}<link rel="icon" href="${root}assets/icon.svg" type="image/svg+xml">
<link rel="manifest" href="${root}manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap">
<link rel="stylesheet" href="${root}assets/styles.css">
${head}
</head>
<body data-root="${root}" ${bodyAttrs}>
<a class="skip" href="#main">본문 바로가기</a>
${sources.includes('sample') ? '<p class="sample-note">미리보기: 지금은 샘플 데이터예요. 날짜와 내용은 실제와 다를 수 있어요.</p>\n' : ''}<header class="topbar">
  <a class="brand" href="${root}"><img src="${root}assets/icon.svg" alt="" width="28" height="28"><span>${esc(config.siteName)}</span></a>
  <span class="tagline">${esc(config.tagline)}</span>
</header>
${body}
${footer({ root, sources })}
${scripts}
</body>
</html>
`;
}

function footer({ root, sources }) {
  const notes = sources.map((s) => config.attributions[s]).filter(Boolean);
  return `<footer class="footer">
  <nav aria-label="지역별 행사">
    <h2>지역별 축제·공연</h2>
    <ul class="region-links">${REGIONS.map((r) => `<li><a href="${root}region/${r.slug}/">${esc(r.name)}</a></li>`).join('')}</ul>
  </nav>
  ${notes.map((n) => `<p class="attribution">${esc(n)}</p>`).join('\n  ')}
  <p class="attribution">지도: &copy; OpenStreetMap contributors</p>
  <p class="attribution">날씨: <a href="https://open-meteo.com/" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)</p>
</footer>`;
}

function chips(id, label, entries, allLabel) {
  const items = allLabel ? [['', allLabel], ...entries] : entries;
  return `<div class="chips" role="group" aria-label="${label}" id="${id}">${items
    .map(([v, t], i) => `<button type="button" class="chip" data-value="${v}" aria-pressed="${i === 0}">${esc(t)}</button>`)
    .join('')}</div>`;
}

// 첫 화면과 지역별 페이지가 같이 쓰는 지도+목록 화면.
export function appPage({ root, path, region, events, hot = [], today, sources, noindex }) {
  const r = region ? REGION_BY_SLUG[region] : null;
  const place = r ? r.name : '전국';
  const heading = `${place} 축제·공연·전시 일정`;
  const description = r
    ? `${r.fullName}에서 열리는 축제, 공연, 전시 일정을 지도와 목록으로 확인하세요. 이번 주말 ${r.name}에서 갈 만한 행사, 무료 행사도 찾을 수 있어요.`
    : config.description;
  const list = events.slice(0, 60).map((e) => renderCard(e, { root, today })).join('\n');
  // 검색창 옆에 기간·종류 버튼을 한 줄로 둔다(좁은 화면에서는 버튼 줄이 옆으로 넘어간다).
  const body = `<section class="filters" aria-label="검색 조건">
  <div class="search-row">
    <input type="search" id="q" placeholder="행사 이름, 장소로 검색" aria-label="행사 검색" enterkeyhint="search" autocomplete="off">
    <select id="region" aria-label="지역">
      <option value="">전국</option>
      ${REGIONS.map((x) => `<option value="${x.slug}"${x.slug === region ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}
    </select>
  </div>
  <div class="filter-bar">
    ${chips('period', '기간', Object.entries(PERIODS))}
    <span class="filter-sep" aria-hidden="true"></span>
    ${chips('category', '종류', Object.entries(CATEGORIES), '모든 종류')}
    <span class="filter-sep" aria-hidden="true"></span>
    <span class="filter-extra">
      <label class="toggle"><input type="checkbox" id="free"> 무료만</label>
      <button type="button" id="near" class="link-btn">📍 내 주변 순으로</button>
    </span>
  </div>
</section>
<div class="view-toggle" role="tablist" aria-label="보기 방식">
  <button type="button" role="tab" data-view="list" aria-selected="true">목록</button>
  <button type="button" role="tab" data-view="map" aria-selected="false">지도</button>
</div>
<main id="main" class="layout" data-view="list">
  <section class="list-pane" aria-labelledby="heading">
    <h1 id="heading">${esc(heading)}</h1>
    <p id="count" class="count" aria-live="polite">${events.length}개 행사</p>
    <section id="hot" class="hot" aria-labelledby="hot-title"${hot.length ? '' : ' hidden'}>
      <header class="hot-head"><h2 id="hot-title">🔥 지금 많이 찾는 축제</h2><span class="hot-sub">블로그 글 수 · 최근 7일</span></header>
      <ol id="hot-list" class="hot-list">${renderHot(hot, { root, today })}</ol>
    </section>
    <div id="wx-strip" class="wx-strip" hidden></div>
    <ul id="list" class="cards">
${list}
    </ul>
    <div id="empty" class="empty" hidden>
      <p>조건에 맞는 행사가 없어요.</p>
      <button type="button" id="reset" class="btn">조건 초기화</button>
    </div>
  </section>
  <section class="map-pane" aria-label="행사 지도">
    <div id="map"></div>
  </section>
  <aside class="ad-pane" aria-label="날씨와 광고">
    <section id="wx" class="wx-card" aria-label="날씨 예보" hidden></section>
    <div class="ad-slot ad-tall"><span class="ad-label">AD</span><p>광고 배너 자리<br><small>300 × 600</small></p></div>
    <div class="ad-slot ad-square"><span class="ad-label">AD</span><p>광고 배너 자리<br><small>300 × 250</small></p></div>
  </aside>
</main>`;
  const head = `<link rel="stylesheet" href="${root}assets/vendor/leaflet/leaflet.css">
<link rel="stylesheet" href="${root}assets/vendor/leaflet/MarkerCluster.css">
<link rel="stylesheet" href="${root}assets/vendor/leaflet/MarkerCluster.Default.css">
<link rel="preload" href="${root}data/events.json" as="fetch" crossorigin>
<script type="application/ld+json">${jsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.siteName,
    url: abs(''),
  })}</script>`;
  const scripts = `<script>window.SITE_TILES=${JSON.stringify(config.tiles)}</script>
<script src="${root}assets/vendor/leaflet/leaflet.js" defer></script>
<script src="${root}assets/vendor/leaflet/leaflet.markercluster.js" defer></script>
<script type="module" src="${root}assets/app.js"></script>`;
  return layout({
    root,
    path,
    title: r ? heading : config.siteName,
    description,
    body,
    head,
    scripts,
    noindex,
    sources,
    bodyAttrs: `data-page="app" data-preset-region="${region || ''}"`,
  });
}

function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function eventJsonLd(e) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': e.category === 'festival' ? 'Festival' : e.category === 'exhibition' ? 'ExhibitionEvent' : 'Event',
    name: e.title,
    startDate: e.startDate,
    endDate: e.endDate,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    isAccessibleForFree: !!e.isFree,
    location: {
      '@type': 'Place',
      name: e.venue,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'KR',
        addressRegion: REGION_BY_SLUG[e.region].fullName,
        ...(e.city ? { addressLocality: e.city } : {}),
        ...(e.address ? { streetAddress: e.address } : {}),
      },
      ...(hasLocation(e) ? { geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lng } } : {}),
    },
  };
  if (e.description) ld.description = e.description;
  if (e.image?.url) ld.image = [e.image.url];
  if (e.url) ld.url = e.url;
  return jsonLd(ld);
}

export function eventPage({ e, related, today, sources, noindex }) {
  const root = '../../';
  const r = REGION_BY_SLUG[e.region];
  const status = eventStatus(e, today);
  const dateText = formatRange(e.startDate, e.endDate, true);
  const description = `${dateText} ${placeLabel(e)}. ${e.description || `${r.name}에서 열리는 ${CATEGORIES[e.category]} 정보와 위치를 확인하세요.`}`;
  const mapQuery = encodeURIComponent(`${e.venue} ${e.address || r.name}`.trim());
  const kakao = hasLocation(e)
    ? `https://map.kakao.com/link/to/${encodeURIComponent(e.venue || e.title)},${e.lat},${e.lng}`
    : `https://map.kakao.com/?q=${mapQuery}`;
  const naver = `https://map.naver.com/p/search/${mapQuery}`;
  const rows = [
    ['기간', dateText],
    ['시간', e.time],
    ['장소', e.venue],
    ['주소', e.address],
    ['요금', e.price || (e.isFree ? '무료' : '')],
  ].filter(([, v]) => v);
  const image = e.image?.url
    ? `<figure class="event-image"><img src="${esc(e.image.url)}" alt="${esc(e.title)} 대표 이미지" decoding="async"></figure>`
    : '';
  const body = `<main id="main" class="event">
  <nav class="crumbs" aria-label="위치"><a href="${root}">전국</a> › <a href="${root}region/${r.slug}/">${esc(r.name)}</a></nav>
  <article>
    <div class="card-tags"><span class="badge cat-${esc(e.category)}">${esc(CATEGORIES[e.category])}</span><span class="badge status-${status.key}" data-start="${e.startDate}" data-end="${e.endDate}" id="status">${esc(status.label)}</span>${e.isFree ? '<span class="badge free">무료</span>' : ''}</div>
    <h1>${esc(e.title)}</h1>
    ${image}
    <dl class="info">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${e.description ? `<p class="desc">${esc(e.description)}</p>` : ''}
    <div class="actions">
      <a class="btn primary" href="${esc(kakao)}" target="_blank" rel="noopener">카카오맵 길찾기</a>
      <a class="btn" href="${esc(naver)}" target="_blank" rel="noopener">네이버 지도</a>
      ${e.url ? `<a class="btn" href="${esc(e.url)}" target="_blank" rel="noopener">공식·예매 정보</a>` : ''}
      <button type="button" class="btn" id="share">공유하기</button>
    </div>
    ${hasLocation(e) ? `<div id="mini-map" class="mini-map" data-lat="${e.lat}" data-lng="${e.lng}" data-title="${esc(e.title)}"></div>` : ''}
    <p class="note">일정과 요금은 주최 측 사정으로 바뀔 수 있어요. 방문 전에 공식 안내를 확인하세요.</p>
  </article>
  ${
    related.length
      ? `<section class="related"><h2>${esc(r.name)}의 다른 행사</h2><ul class="cards">${related
          .map((x) => renderCard(x, { root, today }))
          .join('\n')}</ul></section>`
      : ''
  }
</main>`;
  const head = hasLocation(e)
    ? `<link rel="stylesheet" href="${root}assets/vendor/leaflet/leaflet.css">\n<script type="application/ld+json">${eventJsonLd(e)}</script>`
    : `<script type="application/ld+json">${eventJsonLd(e)}</script>`;
  const scripts = `<script>window.SITE_TILES=${JSON.stringify(config.tiles)}</script>
${hasLocation(e) ? `<script src="${root}assets/vendor/leaflet/leaflet.js" defer></script>\n` : ''}<script type="module" src="${root}assets/event.js"></script>`;
  return layout({
    root,
    path: eventPath(e),
    title: `${e.title} (${dateText})`,
    description,
    body,
    head,
    scripts,
    noindex,
    sources,
    bodyAttrs: 'data-page="event"',
  });
}

export function notFoundPage({ sources, siteRoot }) {
  // 404.html은 어느 경로에서든 보이므로 절대 경로를 쓴다.
  return layout({
    root: siteRoot,
    path: '404.html',
    title: '페이지를 찾을 수 없어요',
    description: config.description,
    body: `<main id="main" class="event"><h1>페이지를 찾을 수 없어요</h1><p>행사가 끝나 정보가 내려갔을 수 있어요.</p><p><a class="btn primary" href="${siteRoot}">전체 행사 보기</a></p></main>`,
    noindex: true,
    sources,
  });
}
