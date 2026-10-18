// "지금 많이 찾는 축제": 네이버 데이터랩 검색어 트렌드(NAVER API HUB)로 축제 이름의 최근 7일 검색량을 비교한다.
// 키: 네이버 클라우드 콘솔 → NAVER API HUB → Application 등록 → "검색어 트렌드" 선택
//      → 환경변수 NAVER_API_KEY_ID(Client ID), NAVER_API_KEY(Client Secret). 키가 없으면 이 기능은 꺼진다.
// 한도: 월 50,000건(검색어 트렌드). 한 번 빌드에 최대 MAX_CANDIDATES / 4 번 호출, 하루 두 번 빌드.
//
// 검색어 트렌드 값(ratio)은 "한 요청 안에서 가장 큰 값을 100으로 둔 상대값"이라 요청끼리 바로 비교할 수 없다.
// 그래서 첫 요청에서 가장 많이 검색된 축제를 기준(anchor)으로 정하고, 이후 요청마다 기준을 같이 넣어 4개씩 비교한 뒤
// 기준 대비 배율로 점수를 이어 붙인다.
import { addDays } from '../src/assets/lib/events.js';

const URL_DEFAULT = 'https://naverapihub.apigw.ntruss.com/search-trend/v1/search';
export const MAX_CANDIDATES = 300;
export const HOT_SIZE = 10;

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

function groupOf(c) {
  // 띄어쓰기 없이 검색하는 경우도 같은 묶음으로 센다.
  const compact = c.keyword.replace(/\s+/g, '');
  return { groupName: c.id, keywords: compact === c.keyword ? [c.keyword] : [c.keyword, compact] };
}

async function query({ groups, startDate, endDate, keyId, key, url, fetchImpl }) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NCP-APIGW-API-KEY-ID': keyId,
      'X-NCP-APIGW-API-KEY': key,
    },
    body: JSON.stringify({ startDate, endDate, timeUnit: 'date', keywordGroups: groups }),
  });
  if (!res.ok) throw new Error(`검색어 트렌드 ${res.status} ${res.statusText}`);
  const json = await res.json();
  const sums = {};
  for (const r of json.results || []) sums[r.title] = (r.data || []).reduce((s, d) => s + (Number(d.ratio) || 0), 0);
  return sums;
}

// 돌려주는 값: [{ id, score }] 점수 큰 순. score는 1위를 100으로 둔 상대 검색량.
export async function loadHotFestivals({ events, today, env = process.env, fetchImpl = fetch, log = console }) {
  const keyId = env.NAVER_API_KEY_ID;
  const key = env.NAVER_API_KEY;
  if (!keyId || !key) return [];
  const url = env.NAVER_TREND_URL || URL_DEFAULT;
  // 데이터랩은 전날까지 집계된다. 최근 7일(어제까지)을 본다.
  const startDate = addDays(today, -7);
  const endDate = addDays(today, -1);
  const ask = (cands) => query({ groups: cands.map(groupOf), startDate, endDate, keyId, key, url, fetchImpl });

  const pending = hotCandidates(events, today);
  const scores = {};
  let anchor = null; // { cand, score }
  try {
    while (pending.length) {
      const batch = pending.splice(0, anchor ? 4 : 5);
      const sums = await ask(anchor ? [anchor.cand, ...batch] : batch);
      if (!anchor) {
        const best = batch.reduce((a, c) => ((sums[c.id] || 0) > (sums[a.id] || 0) ? c : a), batch[0]);
        if (!(sums[best.id] > 0)) continue; // 아무도 검색되지 않은 묶음은 기준이 될 수 없다.
        anchor = { cand: best, score: sums[best.id] };
        for (const c of batch) scores[c.id] = sums[c.id] || 0;
        continue;
      }
      const base = sums[anchor.cand.id];
      if (!(base > 0)) continue;
      for (const c of batch) scores[c.id] = ((sums[c.id] || 0) / base) * anchor.score;
    }
  } catch (err) {
    // 검색량을 못 받아도 사이트는 계속 갱신한다(이번 빌드에서는 인기 축제 줄만 빠진다).
    log.error(`[trend] 실패: ${err.message}`);
    return [];
  }
  const ranked = Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] || 1;
  const hot = ranked.map(([id, s]) => ({ id, score: Math.round((s / top) * 1000) / 10 }));
  log.log(`[trend] 후보 ${Object.keys(scores).length}개 중 검색된 축제 ${hot.length}개`);
  return hot;
}
