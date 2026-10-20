// 끝난 행사 보관함. 출처 API는 끝난 지 30일이 지난 행사를 더 주지 않으므로, 빌드 때마다 받은 행사를
// .cache/event-archive.json 에 모아 두고(CI에서는 actions/cache로 이어 감) 끝난 뒤에도 상세 페이지를 남긴다.
// 이미 검색에 잡힌 주소가 오류 페이지가 되지 않게 하려는 것이다.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { addDays } from '../src/assets/lib/events.js';

export const ARCHIVE_FILE = process.env.EVENT_ARCHIVE || '.cache/event-archive.json';
// 끝난 뒤 1년까지 보관. Cloudflare Pages 무료 요금제는 배포당 파일 2만 개가 한도라 개수도 묶어 둔다.
export const KEEP_DAYS = 365;
export const MAX_ARCHIVED = 8000;

// 이번에 받은 행사로 보관함을 갱신하고, 상세 페이지를 남길 끝난 행사 목록을 돌려준다.
// 아직 끝나지 않았는데 이번 수집에서 빠진 행사(취소 등)는 페이지를 만들지 않는다.
export function mergeArchive(archive, events, today) {
  const next = { ...archive };
  for (const e of events) next[e.id] = e;
  const cutoff = addDays(today, -KEEP_DAYS);
  const current = new Set(events.map((e) => e.id));
  const kept = Object.values(next)
    .filter((e) => e.endDate >= cutoff)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))
    .slice(0, MAX_ARCHIVED + events.length);
  const archiveOut = Object.fromEntries(kept.map((e) => [e.id, e]));
  const ended = kept.filter((e) => !current.has(e.id) && e.endDate < today).slice(0, MAX_ARCHIVED);
  return { archive: archiveOut, ended };
}

export async function readArchive(file = ARCHIVE_FILE) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

export async function writeArchive(archive, file = ARCHIVE_FILE) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(archive));
}
