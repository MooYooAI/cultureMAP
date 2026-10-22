// 정적 사이트 빌드: 데이터 수집 → dist/ 에 HTML·JSON·사이트맵 생성.
// 사용: npm run build   (API 키 환경변수가 없으면 샘플 데이터 사용)
import { mkdir, rm, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import config from '../site.config.mjs';
import { loadAllEvents } from './sources/index.mjs';
import { KEYWORDS, eventKeywords } from '../src/assets/lib/keywords.js';
import { loadHotFestivals, loadKfesRanking, mergeHot } from './trends.mjs';
import { appPage, eventPage, notFoundPage } from './templates.mjs';
import { todayInSeoul, sortEvents, filterEvents, CATEGORIES } from '../src/assets/lib/events.js';
import { REGIONS, isCityName } from '../src/assets/lib/regions.js';
import { eventPath, landingPath } from '../src/assets/lib/render.js';
import { readArchive, writeArchive, mergeArchive } from './archive.mjs';
import { pickHot } from '../src/assets/lib/hot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

async function write(rel, content) {
  const file = path.join(DIST, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

async function copyVendor() {
  const dest = path.join(DIST, 'assets/vendor/leaflet');
  await mkdir(dest, { recursive: true });
  const nm = path.join(ROOT, 'node_modules');
  await cp(path.join(nm, 'leaflet/dist/leaflet.js'), path.join(dest, 'leaflet.js'));
  await cp(path.join(nm, 'leaflet/dist/leaflet.css'), path.join(dest, 'leaflet.css'));
  await cp(path.join(nm, 'leaflet/dist/images'), path.join(dest, 'images'), { recursive: true });
  for (const f of ['leaflet.markercluster.js', 'MarkerCluster.css', 'MarkerCluster.Default.css']) {
    await cp(path.join(nm, 'leaflet.markercluster/dist', f), path.join(dest, f));
  }
}

export async function build({ today = process.env.BUILD_TODAY || todayInSeoul(), env = process.env, fetchImpl } = {}) {
  const { events, sources } = await loadAllEvents({ today, env });
  for (const e of events) e.tags = eventKeywords(e);
  // 지금 많이 찾는 축제: 한국관광공사 '많이 본 축제' 순위를 앞에, 그 뒤로 최근 7일 블로그 글 수 순위.
  // 둘 다 못 받으면 빈 목록이라 화면에서 줄이 숨는다. 샘플 데이터로 빌드할 때는 관광공사 순위를 읽지 않는다.
  const opts = { events, today, env, ...(fetchImpl ? { fetchImpl } : {}) };
  const kfesHot = sources.includes('sample') ? [] : await loadKfesRanking(opts);
  const kfesIds = new Set(kfesHot.map((h) => h.id));
  const hot = mergeHot(kfesHot, await loadHotFestivals(opts));
  if (kfesHot.length) sources.push('kfes');
  if (hot.length > kfesHot.length) sources.push('trend');
  if (hot.length) {
    const byId = new Map(events.map((e) => [e.id, e]));
    console.log(`[trend] 상위: ${hot.slice(0, 10).map((h) => `${byId.get(h.id)?.title}(${h.score})`).join(', ')}`);
  }
  // 샘플 데이터로 만든 사이트는 검색엔진에 올리지 않는다(가짜 일정이 검색에 잡히지 않게).
  const noindex = sources.includes('sample');
  const upcoming = sortEvents(filterEvents(events, {}, today), today);

  await rm(DIST, { recursive: true, force: true });
  await cp(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'), { recursive: true });
  await copyVendor();

  await write(
    'data/events.json',
    // 화면 검색에는 소개글 앞부분이면 충분하다(긴 소개글은 상세 페이지에만 넣어 파일을 가볍게).
    JSON.stringify({ generatedAt: new Date().toISOString(), today, sources, events: events.map(({ program, subevent, ...e }) => ({ ...e, description: String(e.description || '').slice(0, 120) })), hot }),
  );

  // 끝난 행사도 1년 동안 상세 페이지를 남긴다(샘플 데이터일 때는 보관함을 건드리지 않는다).
  let ended = [];
  if (!noindex) {
    const merged = mergeArchive(await readArchive(), events, today);
    ended = merged.ended;
    await writeArchive(merged.archive);
  }

  // 시·군·구 페이지: 지금 행사와 지난 1년 행사에 나온 이름으로 만든다(행사가 잠시 없어도 주소가 사라지지 않게).
  const citiesByRegion = new Map(REGIONS.map((r) => [r.slug, new Map()]));
  for (const e of [...events, ...ended]) {
    if (!isCityName(e.region, e.city)) continue;
    const m = citiesByRegion.get(e.region);
    if (!m.has(e.city)) m.set(e.city, 0);
  }
  for (const e of upcoming) {
    const m = citiesByRegion.get(e.region);
    if (m?.has(e.city)) m.set(e.city, m.get(e.city) + 1);
  }
  // 바로가기에는 지금 행사가 있는 곳만 많은 순으로.
  const cityLinks = (region) =>
    [...(citiesByRegion.get(region) || [])].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'));

  // 목록 페이지: 전국, 지역별, 그리고 검색어 맞춤 페이지(지역×종류, 지역·전국 이번 주말, 종류별, 이번 달, 월별, 지역×월, 시군구, 내 주변).
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
  // 행사가 하나도 없는 페이지는 링크가 깨지지 않게 만들되 검색에서는 뺀다.
  const listPages = [
    {},
    { period: 'weekend' },
    { period: 'month' },
    { near: true },
    ...MONTHS.map((month) => ({ month })),
    ...Object.keys(CATEGORIES).map((category) => ({ category })),
    ...KEYWORDS.map((k) => ({ tag: k.slug })),
    ...REGIONS.flatMap((r) => [
      { region: r.slug },
      { region: r.slug, period: 'weekend' },
      ...Object.keys(CATEGORIES).map((category) => ({ region: r.slug, category })),
      ...MONTHS.map((month) => ({ region: r.slug, month })),
      ...[...citiesByRegion.get(r.slug).keys()].map((city) => ({ region: r.slug, city })),
    ]),
  ];
  const listUrls = [];
  for (const f of listPages) {
    const p = landingPath(f);
    const list = filterEvents(upcoming, f, today);
    // 내 주변 페이지는 위치를 받기 전까지 전국 목록을 보여 준다. this-month는 월별 페이지가 대표 주소라 사이트맵에서 뺀다.
    const empty = list.length === 0 && p !== '';
    if (!empty && f.period !== 'month') listUrls.push(p);
    await write(
      `${decodeURI(p)}index.html`,
      appPage({
        root: '../'.repeat(p.split('/').filter(Boolean).length) || './',
        path: p,
        ...f,
        events: list,
        cities: f.region && !f.category && !f.month && f.period !== 'weekend' ? cityLinks(f.region) : [],
        keywordEvents: upcoming,
        hot: pickHot(hot, events, { region: f.region || '', today }),
        kfesIds,
        today,
        sources,
        noindex: noindex || empty,
      }),
    );
  }

  for (const e of [...events, ...ended]) {
    const related = upcoming.filter((x) => x.region === e.region && x.id !== e.id).slice(0, 6);
    await write(`${eventPath(e)}index.html`, eventPage({ e, related, today, sources, noindex }));
  }

  const siteRoot = new URL(config.siteUrl + '/').pathname;
  await write('404.html', notFoundPage({ sources, siteRoot }));

  const urls = [...listUrls, ...events.map(eventPath), ...ended.map(eventPath)];
  await write(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map((u) => `  <url><loc>${config.siteUrl}/${u}</loc><lastmod>${today}</lastmod></url>`)
      .join('\n')}\n</urlset>\n`,
  );
  await write(
    'robots.txt',
    noindex ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`,
  );
  await write(
    'manifest.webmanifest',
    JSON.stringify(
      {
        name: config.siteName,
        short_name: config.siteName,
        description: config.description,
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f4f0',
        theme_color: '#f7f4f0',
        icons: [{ src: 'assets/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      null,
      2,
    ),
  );
  await write('.nojekyll', '');

  console.log(`[build] ${events.length}개 행사 + 끝난 행사 ${ended.length}개, 목록 ${listPages.length}쪽, 출처: ${sources.join(', ')}${noindex ? ' (noindex)' : ''} → dist/`);
  return { events, sources, noindex, hot, ended };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
