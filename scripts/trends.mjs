// "지금 많이 찾는 축제": 다음(카카오) 블로그 검색으로 최근 7일 동안 올라온 축제 글 수를 세어 순위를 매긴다.
// 키: developers.kakao.com → 앱 만들기 → 앱 키의 "REST API 키" → 환경변수 KAKAO_REST_KEY.
//      카드 등록 없이 쓰는 무료 API이고, 키가 없으면 이 기능은 꺼진다.
// 한도: 블로그 검색 하루 30,000건. 축제 하나에 최신순 50개씩 최대 MAX_PAGES번 읽는다(대부분 1번).
import { addDays } from '../src/assets/lib/events.js';

const URL_DEFAULT = 'https://dapi.kakao.com/v2/search/blog';
export const MAX_CANDIDATES = 300;
export const MAX_PAGES = 6;
const PAGE = 50;

// "제25회 안동국제탈춤페스티벌 2026 (안동)" → "안동국제탈춤페스티벌"
export function searchKeyword(title) {
  return String(title || '')
    .replace(/\([^)]*\)|\[[^\]]*\]|<[^>]*>|「[^」]*」|『[^』]*』/g, ' ')
    .replace(/제?\s*\d+\s*회/g, ' ')
    .replace(/(19|20)\d{2}\s*년?/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 지금 진행 중이거나 30일 안에 시작하는 축제. 같은 검색어는 하나만 남긴다.
export function hotCandidates(events, today) {
  const until = addDays(today, 30);
  const seen = new Set();
  const out = [];
  const list = events
    .filter((e) => e.category === 'festival' && e.endDate >= today && e.startDate <= until)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (const e of list) {
    const kw = searchKeyword(e.title);
    if (kw.length < 2 || seen.has(kw)) continue;
    seen.add(kw);
    out.push({ id: e.id, keyword: kw });
    if (out.length >= MAX_CANDIDATES) break;
  }
  return out;
}

const compact = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, '');

// 최신순으로 읽어 기간 안의 글만 센다. 제목·요약에 축제 이름(띄어쓰기 무시)이 들어간 글만 친다.
async function countRecent({ keyword, since, key, url, fetchImpl }) {
  const name = compact(keyword);
  let count = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({ query: keyword, sort: 'recency', size: String(PAGE), page: String(page) });
    const res = await fetchImpl(`${url}?${params}`, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) throw new Error(`블로그 검색 ${res.status} ${res.statusText}`);
    const body = await res.json();
    const docs = body.documents || [];
    let older = false;
    for (const d of docs) {
      // datetime: '2026-10-17T12:30:00.000+09:00'
      if (String(d.datetime || '').slice(0, 10) < since) {
        older = true;
        break;
      }
      if (compact(d.title).includes(name) || compact(d.contents).includes(name)) count++;
    }
    if (older || body.meta?.is_end || docs.length < PAGE) break;
  }
  return count;
}

// 돌려주는 값: [{ id, score }] 글 많은 순. score는 최근 7일 블로그 글 수.
export async function loadHotFestivals({ events, today, env = process.env, fetchImpl = fetch, log = console }) {
  const key = env.KAKAO_REST_KEY;
  if (!key) return [];
  const url = env.KAKAO_BLOG_URL || URL_DEFAULT;
  const since = addDays(today, -7);
  const scores = [];
  try {
    for (const c of hotCandidates(events, today)) {
      const n = await countRecent({ keyword: c.keyword, since, key, url, fetchImpl });
      if (n > 0) scores.push({ id: c.id, score: n });
    }
  } catch (err) {
    // 글 수를 못 받아도 사이트는 계속 갱신한다(이번 빌드에서는 인기 축제 줄만 빠진다).
    log.error(`[trend] 실패: ${err.message}`);
    return [];
  }
  scores.sort((a, b) => b.score - a.score);
  log.log(`[trend] 최근 블로그 글이 있는 축제 ${scores.length}개`);
  return scores;
}

// ---- 한국관광공사 '대한민국 구석구석 축제'(kfes) 첫 화면의 "사람들이 많이 본 축제" 순위 ----
// 공개 API가 없어 공개된 첫 화면 HTML에서 순위 목록만 읽는다. 화면 구조가 바뀌어 못 읽으면 빈 목록을 돌려주고,
// 그때는 블로그 글 수 순위만 쓴다.
const KFES_URL = 'https://korean.visitkorea.or.kr/kfes/main/main.do';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const textOf = (html) =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

// "많이 본 축제" 제목 뒤에 나오는 축제 상세 링크를 순서대로 최대 10개. [{ rank, name }]
export function parseKfesRanking(html) {
  const at = String(html || '').indexOf('많이 본 축제');
  if (at < 0) return [];
  const out = [];
  const seen = new Set();
  for (const m of html.slice(at).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const id = m[1].match(UUID)?.[0];
    if (!id || seen.has(id)) continue;
    // 링크 안의 순위 숫자·메달 그림은 빼고 축제 이름만 남긴다.
    const name = textOf(m[2]).replace(/^\d+\s*/, '').replace(/\s*\.{3}$|…$/, '');
    if (!name) continue;
    seen.add(id);
    out.push({ rank: out.length + 1, name });
    if (out.length >= 10) break;
  }
  return out;
}

const key = (s) => searchKeyword(s).replace(/\s+/g, '');

// kfes 축제 이름을 우리 행사와 맞춘다. 같은 이름 → 한쪽이 다른 쪽을 품는 이름(4글자 이상) 순으로 찾는다.
// 화면에서 잘린 이름("세계문화유산 화순 고인…")도 앞부분으로 맞춘다.
export function matchKfes(ranking, events, today) {
  const list = events.filter((e) => e.category === 'festival' && e.endDate >= today);
  const used = new Set();
  const out = [];
  for (const r of ranking) {
    const k = key(r.name);
    if (k.length < 2) continue;
    const ok = (e) => !used.has(e.id);
    const hit =
      list.find((e) => ok(e) && key(e.title) === k) ||
      (k.length >= 4 && list.find((e) => ok(e) && (key(e.title).includes(k) || k.includes(key(e.title)) || key(e.title).startsWith(k))));
    if (!hit) continue;
    used.add(hit.id);
    out.push({ id: hit.id, score: 11 - r.rank, by: 'kfes' });
  }
  return out;
}

export async function loadKfesRanking({ events, today, env = process.env, fetchImpl = fetch, log = console }) {
  try {
    const res = await fetchImpl(env.KFES_URL || KFES_URL, { headers: { 'User-Agent': 'Mozilla/5.0 (festanow.com)' } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const ranking = parseKfesRanking(await res.text());
    const matched = matchKfes(ranking, events, today);
    log.log(`[trend] 관광공사 많이 본 축제 ${ranking.length}개 중 ${matched.length}개 연결: ${ranking.map((r) => r.name).join(', ')}`);
    return matched;
  } catch (err) {
    log.error(`[trend] 관광공사 순위 실패: ${err.message}`);
    return [];
  }
}

// 관광공사 순위를 앞에, 그 뒤로 블로그 글 수 순위(지역 페이지에서 쓸 축제)를 잇는다.
export function mergeHot(kfes, blog) {
  const ids = new Set(kfes.map((h) => h.id));
  return [...kfes, ...blog.filter((h) => !ids.has(h.id)).map((h) => ({ ...h, by: 'blog' }))];
}
