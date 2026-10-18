// 출처별 어댑터가 함께 쓰는 도우미.
//
// 모든 어댑터는 아래 "정규화된 행사" 형태로 돌려준다. 화면은 이 형태만 안다.
// {
//   id: 'tourapi-123456',            // 출처 접두어 + 원본 id (URL에 쓰임)
//   title, category,                  // category: festival | performance | exhibition | event
//   region,                           // 시·도 slug (src/assets/lib/regions.js)
//   city, venue, address,             // 시군구, 장소명, 주소 (모르면 '')
//   lat, lng,                         // 숫자 또는 null (KOPIS 목록에는 좌표가 없다)
//   startDate, endDate,               // 'YYYY-MM-DD'
//   time, price, description,         // 표시용 문자열 (모르면 '')
//   isFree,                           // boolean
//   url,                              // 공식/예매 링크 또는 null
//   image: { url, license } | null,   // license: 'kogl-1' | 'kogl-3' | 'poster'
//   source: { name, id, url }         // name: tourapi | kopis | culture | sample
// }

export function ymd(raw) {
  // 20261017, 2026.10.17, 2026-10-17 → 2026-10-17
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

export function num(raw) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

// 알려진 HTML 태그만 지운다. 공연 제목의 <레미제라블> 같은 꺾쇠는 남겨야 한다.
export function cleanText(raw) {
  const noTags = String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|span|b|strong|a|div|font|i|em|u|img)\b[^>]*>/gi, '');
  return decodeEntities(noTags).replace(/[ \t]+/g, ' ').trim();
}

const NAMED = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&', nbsp: ' ', ndash: '–', mdash: '—', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };

// 공공데이터 응답은 "&amp;lt;"처럼 두 번 이스케이프된 경우가 있어, 더 바뀌지 않을 때까지 여러 번 푼다.
export function decodeEntities(s) {
  let prev;
  let out = String(s);
  for (let i = 0; i < 3 && out !== prev; i++) {
    prev = out;
    out = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, name) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
      }
      return NAMED[name.toLowerCase()] ?? m;
    });
  }
  return out;
}

export function isFreeText(price) {
  return /무료|free/i.test(String(price || '')) && !/[1-9][0-9,]*\s*원/.test(String(price || ''));
}

// KOPIS·문화포털은 XML로 응답한다. 응답이 평평한 레코드 목록이라 의존성 없이 간단히 읽는다.
export function parseXmlItems(xml, tag) {
  const items = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml))) {
    const obj = {};
    const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let f;
    while ((f = fieldRe.exec(m[1]))) {
      obj[f[1]] = f[2].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim();
    }
    items.push(obj);
  }
  return items;
}

export async function fetchText(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json, application/xml, text/xml' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.replace(/(serviceKey|service)=[^&]+/i, '$1=***')}`);
  return res.text();
}

// 같은 공연이 KOPIS와 문화포털에 함께 나올 수 있다. 제목+장소+시작일이 같으면 하나로 합친다.
// 먼저 들어온 쪽을 남기되, 비어 있는 좌표·이미지는 뒤쪽 것으로 채운다.
export function dedupeEvents(events) {
  const key = (e) => [e.title, e.venue].map((s) => String(s).replace(/[\s()[\]<>「」『』·\-]/g, '').toLowerCase()).join('|') + '|' + e.startDate;
  const map = new Map();
  for (const e of events) {
    const k = key(e);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, e);
      continue;
    }
    if (prev.lat == null && e.lat != null) Object.assign(prev, { lat: e.lat, lng: e.lng });
    if (!prev.image && e.image) prev.image = e.image;
    if (!prev.url && e.url) prev.url = e.url;
  }
  return [...map.values()];
}
