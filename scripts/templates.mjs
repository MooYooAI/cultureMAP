// 빌드 때 만드는 HTML 페이지 템플릿. root는 페이지 위치에서 사이트 맨 위까지의 상대 경로('./', '../../').
import config from '../site.config.mjs';
import { esc, renderCard, eventPath, placeLabel, landingPath, listHeading } from '../src/assets/lib/render.js';
import { CATEGORIES, PERIODS, formatRange, hasLocation, eventStatus, periodRange } from '../src/assets/lib/events.js';
import { REGIONS, REGION_BY_SLUG } from '../src/assets/lib/regions.js';
import { renderHot } from '../src/assets/lib/hot.js';

function abs(path) {
  return `${config.siteUrl}/${path}`;
}

// 링크를 카톡·SNS에 공유할 때 보이는 대표 이미지(1200×630). 행사 페이지는 행사 사진이 있으면 그 사진을 쓴다.
const OG_IMAGE = 'assets/og.png';

export function layout({ root, path, title, description, body, head = '', scripts = '', noindex, sources, bodyAttrs = '', image = '', search = false }) {
  const fullTitle = title.startsWith(config.siteName) ? title : `${title} | ${config.siteName}`;
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
<meta property="og:image" content="${esc(image || abs(OG_IMAGE))}">
${image ? '' : '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'}<meta name="twitter:card" content="summary_large_image">
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
  ${search ? '<button type="button" id="search-toggle" class="search-toggle" aria-label="행사 검색" aria-controls="q" aria-expanded="false"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button>' : ''}
  <p class="tagline"><span class="hook">${esc(config.hook)}</span> <span class="tagline-text">${esc(config.tagline)}</span></p>
</header>
${body}
${footer({ root, sources })}
${scripts}
</body>
</html>
`;
}

// 검색엔진이 모든 목록 페이지를 찾아갈 수 있도록 바닥글에 링크를 모아 둔다.
const TOPIC_LINKS = [
  [{ period: 'weekend' }, '이번 주말 축제·공연'],
  [{ period: 'month' }, '이달의 축제·공연·전시'],
  ...Object.entries(CATEGORIES).map(([category, name]) => [{ category }, `전국 ${name}`]),
];

function footer({ root, sources }) {
  const notes = sources.map((s) => config.attributions[s]).filter(Boolean);
  return `<footer class="footer">
  <nav aria-label="테마별 행사">
    <h2>테마별 행사</h2>
    <ul class="region-links">${TOPIC_LINKS.map(([f, t]) => `<li><a href="${root}${landingPath(f)}">${esc(t)}</a></li>`).join('')}</ul>
  </nav>
  <nav aria-label="지역별 행사">
    <h2>지역별 축제·공연</h2>
    <ul class="region-links">${REGIONS.map((r) => `<li><a href="${root}region/${r.slug}/">${esc(r.name)}</a></li>`).join('')}</ul>
  </nav>
  ${notes.map((n) => `<p class="attribution">${esc(n)}</p>`).join('\n  ')}
  <p class="attribution">지도: &copy; OpenStreetMap contributors</p>
  <p class="attribution">날씨: <a href="https://open-meteo.com/" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)</p>
</footer>`;
}

// 지역·기간·종류는 모두 눌러서 고르는 칸(select). 기본값이 아닌 걸 고르면 칸이 분홍으로 바뀐다.
function picker(id, label, items, selected) {
  const value = items.some(([v]) => v === selected) ? selected : items[0][0];
  return `<select id="${id}" aria-label="${label}"${value !== items[0][0] ? ' class="is-set"' : ''}>${items
    .map(([v, t]) => `<option value="${v}"${v === value ? ' selected' : ''}>${esc(t)}</option>`)
    .join('')}</select>`;
}

// 첫 화면과 지역별 페이지가 같이 쓰는 지도+목록 화면.
// region·category·period가 있으면 "서울 축제", "이번 주말"처럼 조건이 미리 걸린 검색어 맞춤 페이지가 된다.
export function appPage({ root, path, region = '', category = '', period = 'all', events, hot = [], today, sources, noindex }) {
  const r = region ? REGION_BY_SLUG[region] : null;
  const heading = listHeading({ region, category, period, today });
  const isHome = !region && !category && period === 'all';
  const description = isHome ? config.description : landingDescription({ r, category, period, today });
  const title = isHome ? `${config.siteName} - ${config.tagline}` : period === 'weekend' ? `${heading} (${weekendLabel(today)})` : heading;
  const list = events.slice(0, 60).map((e) => renderCard(e, { root, today })).join('\n');
  // 검색창 옆에 지역·기간·종류 고르는 칸을 한 줄로 둔다(모바일은 검색창이 접혀 세 칸만 보인다).
  const body = `<section class="filters" aria-label="검색 조건">
  <div class="search-row">
    <input type="search" id="q" placeholder="행사 이름, 장소로 검색" aria-label="행사 검색" enterkeyhint="search" autocomplete="off">
    ${picker('region', '지역', [['', '전국'], ...REGIONS.map((x) => [x.slug, x.name])], region)}
    ${picker('period', '기간', [['all', '전체 기간'], ...Object.entries(PERIODS).filter(([v]) => v !== 'all')], period)}
    ${picker('category', '종류', [['', '모든 종류'], ...Object.entries(CATEGORIES)], category)}
  </div>
</section>
<div class="view-toggle" role="tablist" aria-label="보기 방식">
  <button type="button" role="tab" data-view="list" aria-selected="true">목록</button>
  <button type="button" role="tab" data-view="map" aria-selected="false">지도</button>
</div>
<main id="main" class="layout" data-view="list">
  <section class="list-pane" aria-labelledby="heading">
    <h1 id="heading"${isHome ? ' class="sr-only"' : ''}>${esc(heading)}</h1>
    <p id="count" class="count" aria-live="polite">${events.length}개 행사</p>
    ${topicNav({ root, region, category, period })}
    <section id="hot" class="hot" aria-labelledby="hot-title"${hot.length ? '' : ' hidden'}>
      <header class="hot-head"><h2 id="hot-title">🔥 지금 많이 찾는 축제</h2><span class="hot-sub">블로그 글 수 · 최근 7일</span></header>
      <ol id="hot-list" class="hot-list">${renderHot(hot, { root, today })}</ol>
    </section>
    <div id="wx-strip" class="wx-strip" hidden></div>
    <div class="filter-extra">
      <label class="toggle"><input type="checkbox" id="free"> 무료만</label>
      <button type="button" id="near" class="near-btn" aria-pressed="false">📍 내 주변 순으로</button>
    </div>
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
    alternateName: config.alternateNames,
    url: abs(''),
  })}</script>`;
  const scripts = `<script>window.SITE_TILES=${JSON.stringify(config.tiles)}</script>
<script src="${root}assets/vendor/leaflet/leaflet.js" defer></script>
<script src="${root}assets/vendor/leaflet/leaflet.markercluster.js" defer></script>
<script type="module" src="${root}assets/app.js"></script>`;
  return layout({
    root,
    path,
    title,
    description,
    body,
    head,
    scripts,
    noindex,
    sources,
    search: true,
    bodyAttrs: `data-page="app" data-preset-region="${region}" data-preset-category="${category}" data-preset-period="${period}"`,
  });
}

function weekendLabel(today) {
  const { from, to } = periodRange('weekend', today);
  return formatRange(from, to);
}

function landingDescription({ r, category, period, today }) {
  const where = r ? `${r.fullName}에서` : '전국에서';
  const what = category ? CATEGORIES[category] : '축제, 공연, 전시';
  const when =
    period === 'weekend'
      ? `이번 주말(${weekendLabel(today)}) `
      : period === 'month'
        ? `${Number(today.slice(5, 7))}월 한 달 동안 `
        : '';
  return `${when}${where} 열리는 ${what} 일정을 지도와 목록으로 확인하세요. 진행 중인 행사, 곧 시작하는 행사, 무료 행사까지 한눈에 볼 수 있어요.`;
}

// 목록 위 바로가기: 지금 페이지와 이웃한 검색어 맞춤 페이지(같은 지역의 종류별, 이번 주말)를 잇는다.
function topicNav({ root, region, category, period }) {
  const r = region ? REGION_BY_SLUG[region] : null;
  const place = r ? r.name : '전국';
  const links = [
    [{ region, period: 'weekend' }, `${place} 이번 주말`],
    ...(r ? [] : [[{ period: 'month' }, '이달의 행사']]),
    ...Object.entries(CATEGORIES).map(([c, name]) => [{ region, category: c }, `${place} ${name}`]),
  ].filter(([f]) => !((f.category || '') === category && (f.period || 'all') === period));
  return `<nav class="topic-links" aria-label="바로가기"><ul>${links
    .map(([f, t]) => `<li><a href="${root}${landingPath(f)}">${esc(t)}</a></li>`)
    .join('')}</ul></nav>`;
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
  const ended = status.key === 'ended';
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
  <nav class="crumbs" aria-label="위치"><a href="${root}">전국</a> › <a href="${root}region/${r.slug}/">${esc(r.name)}</a> › <a href="${root}${landingPath({ region: r.slug, category: e.category })}">${esc(r.name)} ${esc(CATEGORIES[e.category])}</a></nav>
  ${ended ? `<p class="ended-note">이 행사는 끝났어요. 아래에서 ${esc(r.name)}의 다른 행사를 찾아보세요.</p>` : ''}
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
      ? `<section class="related"><h2>${ended ? `지금 ${esc(r.name)}에서 열리는 행사` : `${esc(r.name)}의 다른 행사`}</h2><ul class="cards">${related
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
    image: e.image?.url || '',
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
