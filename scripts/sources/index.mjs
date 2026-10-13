// 데이터 계층 입구. 빌드는 이 파일의 loadAllEvents()만 부른다.
// 환경변수에 키가 있는 출처만 수집하고, 키가 하나도 없으면 샘플 데이터를 쓴다.
// 새 출처를 추가하려면 같은 모양(name, envKey, load, mapItem)의 파일을 만들고 SOURCES에 넣으면 된다.
import * as tourapi from './tourapi.mjs';
import * as kopis from './kopis.mjs';
import * as culture from './culture.mjs';
import * as sample from './sample.mjs';
import { dedupeEvents } from './common.mjs';
import { validateEvents } from '../validate.mjs';
import { addDays } from '../../src/assets/lib/events.js';

// 순서가 중복 제거 때 우선순위다(앞쪽 정보가 남는다).
export const SOURCES = [tourapi, kopis, culture];

export async function loadAllEvents({ today, env = process.env, log = console }) {
  const from = addDays(today, -30);
  const to = addDays(today, 120);
  const active = SOURCES.filter((s) => env[s.envKey]);
  let events = [];
  const used = [];

  if (active.length === 0) {
    log.warn('[data] API 키가 없어 샘플 데이터로 빌드합니다.');
    events = await sample.load();
    used.push(sample.name);
  } else {
    for (const s of active) {
      try {
        const got = await s.load({ key: env[s.envKey], from, to });
        log.log(`[data] ${s.name}: ${got.length}건`);
        events.push(...got);
        used.push(s.name);
      } catch (err) {
        // 한 출처가 실패해도 나머지로 사이트는 계속 갱신한다.
        log.error(`[data] ${s.name} 수집 실패: ${err.message}`);
      }
    }
    if (used.length === 0) throw new Error('모든 데이터 출처 수집에 실패했습니다.');
  }

  const { valid, errors } = validateEvents(dedupeEvents(events));
  for (const e of errors.slice(0, 20)) log.warn(`[data] 제외: ${e}`);
  if (errors.length > 20) log.warn(`[data] ...외 ${errors.length - 20}건 제외`);

  // 끝난 지 30일이 넘은 행사는 뺀다(상세 페이지는 잠시 남겨 검색 유입을 살린다).
  return { events: valid.filter((e) => e.endDate >= from), sources: used };
}
