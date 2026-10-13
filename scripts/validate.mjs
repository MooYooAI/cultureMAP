import { CATEGORIES } from '../src/assets/lib/events.js';
import { REGION_BY_SLUG } from '../src/assets/lib/regions.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// 화면이 기대하는 형태를 지키지 않는 행사를 걸러낸다. 수집 데이터가 이상해도 빌드는 깨지지 않는다.
export function validateEvents(events) {
  const valid = [];
  const errors = [];
  const ids = new Set();
  for (const e of events) {
    const problems = [];
    if (!e.id || !/^[a-z]+-[\w.-]+$/i.test(e.id)) problems.push('id');
    if (ids.has(e.id)) problems.push('중복 id');
    if (!e.title) problems.push('title');
    if (!CATEGORIES[e.category]) problems.push(`category(${e.category})`);
    if (!REGION_BY_SLUG[e.region]) problems.push(`region(${e.region})`);
    if (!DATE.test(e.startDate || '') || !DATE.test(e.endDate || '')) problems.push('날짜 형식');
    else if (e.endDate < e.startDate) problems.push('종료일이 시작일보다 빠름');
    const hasLat = typeof e.lat === 'number';
    const hasLng = typeof e.lng === 'number';
    if (hasLat !== hasLng) problems.push('좌표 한쪽만 있음');
    if (hasLat && (e.lat < 32 || e.lat > 39 || e.lng < 124 || e.lng > 132)) problems.push('좌표가 국내 범위 밖');
    if (problems.length) {
      errors.push(`${e.id || '(id 없음)'} ${e.title || ''}: ${problems.join(', ')}`);
      continue;
    }
    ids.add(e.id);
    valid.push(e);
  }
  return { valid, errors };
}
