// 정적 사이트 빌드: 데이터 수집 → dist/ 에 HTML·JSON·사이트맵 생성.
// 사용: npm run build   (API 키 환경변수가 없으면 샘플 데이터 사용)
import { mkdir, rm, writeFile, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import config from '../site.config.mjs';
import { loadAllEvents } from './sources/index.mjs';
import { loadHotFestivals } from './trends.mjs';
import { appPage, eventPage, notFoundPage } from './templates.mjs';
import { todayInSeoul, sortEvents, filterEvents } from '../src/assets/lib/events.js';
import { REGIONS } from '../src/assets/lib/regions.js';
import { eventPath } from '../src/assets/lib/render.js';
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
  // 지금 많이 찾는 축제(네이버 검색어 트렌드). 키가 없으면 빈 목록이라 화면에서 줄이 숨는다.
  const hot = await loadHotFestivals({ events, today, env, ...(fetchImpl ? { fetchImpl } : {}) });
  if (hot.length) sources.push('trend');
  // 샘플 데이터로 만든 사이트는 검색엔진에 올리지 않는다(가짜 일정이 검색에 잡히지 않게).
  const noindex = sources.includes('sample');
  const upcoming = sortEvents(filterEvents(events, {}, today), today);

  await rm(DIST, { recursive: true, force: true });
  await cp(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'), { recursive: true });
  await copyVendor();

  await write(
    'data/events.json',
    JSON.stringify({ generatedAt: new Date().toISOString(), today, sources, events, hot }),
  );

  await write('index.html', appPage({ root: './', path: '', events: upcoming, hot: pickHot(hot, events, { today }), today, sources, noindex }));
  for (const r of REGIONS) {
    const list = upcoming.filter((e) => e.region === r.slug);
    await write(
      `region/${r.slug}/index.html`,
      appPage({
        root: '../../',
        path: `region/${r.slug}/`,
        region: r.slug,
        events: list,
        hot: pickHot(hot, events, { region: r.slug, today }),
        today,
        sources,
        noindex,
      }),
    );
  }
  for (const e of events) {
    const related = upcoming.filter((x) => x.region === e.region && x.id !== e.id).slice(0, 6);
    await write(`${eventPath(e)}index.html`, eventPage({ e, related, today, sources, noindex }));
  }

  const siteRoot = new URL(config.siteUrl + '/').pathname;
  await write('404.html', notFoundPage({ sources, siteRoot }));

  const urls = ['', ...REGIONS.map((r) => `region/${r.slug}/`), ...events.map(eventPath)];
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
        short_name: '공연지도',
        description: config.description,
        lang: 'ko',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#fff7fb',
        theme_color: '#ff7eb3',
        icons: [{ src: 'assets/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      null,
      2,
    ),
  );
  await write('.nojekyll', '');

  console.log(`[build] ${events.length}개 행사, 출처: ${sources.join(', ')}${noindex ? ' (noindex)' : ''} → dist/`);
  return { events, sources, noindex, hot };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
