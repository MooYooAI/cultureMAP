// 브라우저와 빌드 스크립트(Node)가 함께 쓰는 순수 함수 모음.
// 날짜는 모두 'YYYY-MM-DD' 문자열(한국 시간 기준)로 다룬다. 문자열 비교로 앞뒤를 가릴 수 있다.

export const CATEGORIES = {
  festival: '축제',
  performance: '공연',
  exhibition: '전시',
  event: '행사·체험',
};

export const PERIODS = {
  all: '전체',
  today: '오늘',
  weekend: '이번 주말',
  week: '7일 안',
  month: '이번 달',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function todayInSeoul(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now);
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setUTCDate(d.getUTCDate() + n);
  return toKey(d);
}

export function daysBetween(fromKey, toKeyStr) {
  return Math.round((parseKey(toKeyStr) - parseKey(fromKey)) / 86400000);
}

// 기간 필터를 [from, to] 범위로 바꾼다. 'all'이면 null.
export function periodRange(period, today) {
  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'weekend': {
      const dow = parseKey(today).getUTCDay();
      if (dow === 0) return { from: today, to: today };
      const sat = addDays(today, 6 - dow);
      return { from: dow === 6 ? today : sat, to: addDays(sat, 1) };
    }
    case 'week':
      return { from: today, to: addDays(today, 6) };
    case 'month': {
      const d = parseKey(today);
      const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
      return { from: today, to: toKey(last) };
    }
    default:
      return null;
  }
}

// 월별 페이지(11월 축제)의 기간: 그 달 1일~말일. 이번 달보다 앞선 달은 다음 해로 본다.
export function monthRange(month, today) {
  const [y, m] = today.split('-').map(Number);
  const year = month >= m ? y : y + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { year, from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
}

function normalizeText(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '');
}

export function filterEvents(events, filters = {}, today = todayInSeoul()) {
  const { region = '', city = '', category = '', period = 'all', month = 0, q = '', freeOnly = false, tag = '' } = filters;
  const range = periodRange(period, today);
  const mRange = month ? monthRange(month, today) : null;
  const query = normalizeText(q);
  return events.filter((e) => {
    if (e.endDate < today) return false;
    if (region && e.region !== region) return false;
    if (city && e.city !== city) return false;
    if (category && e.category !== category) return false;
    if (freeOnly && !e.isFree) return false;
    if (tag && !(e.tags || []).includes(tag)) return false;
    if (range && (e.startDate > range.to || e.endDate < range.from)) return false;
    if (mRange && (e.startDate > mRange.to || e.endDate < mRange.from)) return false;
    if (query) {
      const hay = normalizeText([e.title, e.venue, e.city, e.address, e.description].join(' '));
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

export function distanceKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function hasLocation(e) {
  return typeof e.lat === 'number' && typeof e.lng === 'number';
}

// 기본 정렬: 진행 중인 행사 먼저(곧 끝나는 순), 그다음 곧 시작하는 순.
// origin(내 위치)이 있으면 가까운 순, 위치 없는 행사는 맨 뒤.
export function sortEvents(events, today = todayInSeoul(), origin = null) {
  const list = [...events];
  if (origin) {
    const dist = (e) => (hasLocation(e) ? distanceKm(origin, e) : Infinity);
    return list.sort((a, b) => dist(a) - dist(b));
  }
  return list.sort((a, b) => {
    const aOn = a.startDate <= today;
    const bOn = b.startDate <= today;
    if (aOn !== bOn) return aOn ? -1 : 1;
    if (aOn) return a.endDate.localeCompare(b.endDate) || a.title.localeCompare(b.title, 'ko');
    return a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title, 'ko');
  });
}

export function eventStatus(e, today = todayInSeoul()) {
  if (e.endDate < today) return { key: 'ended', label: '종료' };
  if (e.startDate <= today) {
    if (e.endDate === today) return { key: 'last', label: '오늘 마지막' };
    return { key: 'ongoing', label: '진행 중' };
  }
  const n = daysBetween(today, e.startDate);
  return { key: 'upcoming', label: n === 1 ? '내일 시작' : `D-${n}` };
}

export function formatDate(key, withYear = false) {
  const d = parseKey(key);
  const md = `${d.getUTCMonth() + 1}.${d.getUTCDate()}`;
  return `${withYear ? d.getUTCFullYear() + '.' : ''}${md}(${WEEKDAYS[d.getUTCDay()]})`;
}

export function formatRange(start, end, withYear = false) {
  if (start === end) return formatDate(start, withYear);
  const crossYear = start.slice(0, 4) !== end.slice(0, 4);
  return `${formatDate(start, withYear || crossYear)} ~ ${formatDate(end, withYear || crossYear)}`;
}
