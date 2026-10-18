// "지금 많이 찾는 축제": 네이버 블로그에 최근 7일 동안 올라온 축제 글 수로 순위를 매긴다.
// 키: developers.naver.com → Application 등록 → 사용 API "검색" 선택
//      → 환경변수 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET. 키가 없으면 이 기능은 꺼진다.
// 한도: 검색 API 하루 25,000건. 축제 하나에 최신순 100개씩 최대 MAX_PAGES번 읽는다(대부분 1번).
import { addDays } from '../src/assets/lib/events.js';

const URL_DEFAULT = 'https://openapi.naver.com/v1/search/blog.json';
export const MAX_CANDIDATES = 300;
export const MAX_PAGES = 3;
const PAGE = 100;

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
async function countRecent({ keyword, since, id, secret, url, fetchImpl }) {
  const name = compact(keyword);
  let count = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ query: keyword, display: String(PAGE), start: String(page * PAGE + 1), sort: 'date' });
    const res = await fetchImpl(`${url}?${params}`, {
      headers: { 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret },
    });
    if (!res.ok) throw new Error(`블로그 검색 ${res.status} ${res.statusText}`);
    const items = (await res.json()).items || [];
    let older = false;
    for (const it of items) {
      if (String(it.postdate || '') < since) {
        older = true;
        break;
      }
      if (compact(it.title).includes(name) || compact(it.description).includes(name)) count++;
    }
    if (older || items.length < PAGE) break;
  }
  return count;
}

// 돌려주는 값: [{ id, score }] 글 많은 순. score는 최근 7일 블로그 글 수.
export async function loadHotFestivals({ events, today, env = process.env, fetchImpl = fetch, log = console }) {
  const id = env.NAVER_CLIENT_ID;
  const secret = env.NAVER_CLIENT_SECRET;
  if (!id || !secret) return [];
  const url = env.NAVER_BLOG_URL || URL_DEFAULT;
  const since = addDays(today, -7).replace(/-/g, '');
  const scores = [];
  try {
    for (const c of hotCandidates(events, today)) {
      const n = await countRecent({ keyword: c.keyword, since, id, secret, url, fetchImpl });
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
