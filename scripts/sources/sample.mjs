// 샘플 데이터. API 키가 하나도 없을 때 쓴다. 날짜는 예시이며 실제 일정과 다를 수 있다.
import { readFile } from 'node:fs/promises';

export const name = 'sample';

export async function load() {
  const url = new URL('../../data/sample-events.json', import.meta.url);
  return JSON.parse(await readFile(url, 'utf8'));
}
