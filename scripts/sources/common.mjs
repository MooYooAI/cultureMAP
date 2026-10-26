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

// HTML 4 이름 엔티티 전부와 제목에 자주 나오는 HTML 5 괄호·기호(이름 16진수코드 짝).
// 출처가 「」 대신 &lceil;·&rfloor; 같은 기호를 엔티티로 보내는 일이 있어, 몇 개만 알면 화면에 코드가 그대로 나온다.
const ENTITY_TABLE =
  'AElig c6 Aacute c1 Acirc c2 Agrave c0 Alpha 391 Aring c5 Atilde c3 Auml c4 Beta 392 Ccedil c7 ' +
  'CenterDot b7 Chi 3a7 Dagger 2021 Delta 394 ETH d0 Eacute c9 Ecirc ca Egrave c8 Epsilon 395 Eta 397 ' +
  'Euml cb Gamma 393 Hat 5e Iacute cd Icirc ce Igrave cc Iota 399 Iuml cf Kappa 39a Lambda 39b ' +
  'LeftAngleBracket 27e8 Mu 39c Ntilde d1 Nu 39d OElig 152 Oacute d3 Ocirc d4 Ograve d2 Omega 3a9 ' +
  'Omicron 39f Oslash d8 Otilde d5 Ouml d6 Phi 3a6 Pi 3a0 Prime 2033 Psi 3a8 Rho 3a1 RightAngleBracket 27e9 ' +
  'Scaron 160 Sigma 3a3 THORN de Tau 3a4 Theta 398 Uacute da Ucirc db Ugrave d9 Upsilon 3a5 Uuml dc Xi 39e ' +
  'Yacute dd Yuml 178 ZeroWidthSpace 200b Zeta 396 aacute e1 acirc e2 acute b4 aelig e6 agrave e0 ' +
  'alefsym 2135 alpha 3b1 amp 26 and 2227 ang 2220 apos 27 aring e5 ast 2a asymp 2248 atilde e3 auml e4 ' +
  'bdquo 201e beta 3b2 bigcirc 25ef bigstar 2605 brvbar a6 bsol 5c bull 2022 cap 2229 ccedil e7 cedil b8 ' +
  'cent a2 centerdot b7 check 2713 chi 3c7 cir 25cb circ 2c6 clubs 2663 colon 3a comma 2c commat 40 ' +
  'cong 2245 copy a9 copysr 2117 crarr 21b5 cross 2717 cup 222a curren a4 dArr 21d3 dagger 2020 darr 2193 ' +
  'dash 2010 deg b0 delta 3b4 diams 2666 divide f7 dollar 24 dtri 25bf eacute e9 ecirc ea egrave e8 ' +
  'empty 2205 emsp 2003 ensp 2002 epsilon 3b5 equals 3d equiv 2261 eta 3b7 eth f0 euml eb euro 20ac excl 21 ' +
  'exist 2203 female 2640 fnof 192 forall 2200 frac12 bd frac14 bc frac34 be frasl 2044 gamma 3b3 ge 2265 ' +
  'grave 60 gt 3e hArr 21d4 harr 2194 hearts 2665 hellip 2026 horbar 2015 hyphen 2010 iacute ed icirc ee ' +
  'iexcl a1 igrave ec image 2111 infin 221e int 222b iota 3b9 iquest bf isin 2208 iuml ef kappa 3ba ' +
  'lArr 21d0 lambda 3bb lang 27e8 langle 27e8 laquo ab larr 2190 lbbrk 2772 lbrace 7b lbrack 5b lceil 2308 ' +
  'lcub 7b ldquo 201c le 2264 lfloor 230a loang 27ec lobrk 27e6 lopar 2985 lowast 2217 lowbar 5f loz 25ca ' +
  'lpar 28 lrm 200e lsaquo 2039 lsqb 5b lsquo 2018 lt 3c ltri 25c3 macr af male 2642 mdash 2014 micro b5 ' +
  'middot b7 minus 2212 mu 3bc nabla 2207 nbsp a0 ndash 2013 ne 2260 ni 220b not ac notin 2209 nsub 2284 ' +
  'ntilde f1 nu 3bd num 23 oacute f3 ocirc f4 oelig 153 ograve f2 oline 203e omega 3c9 omicron 3bf ' +
  'oplus 2295 or 2228 ordf aa ordm ba oslash f8 otilde f5 otimes 2297 ouml f6 para b6 part 2202 percnt 25 ' +
  'period 2e permil 2030 perp 22a5 phi 3c6 phone 260e pi 3c0 piv 3d6 plus 2b plusmn b1 pound a3 prime 2032 ' +
  'prod 220f prop 221d psi 3c8 quest 3f quot 22 rArr 21d2 radic 221a rang 27e9 rangle 27e9 raquo bb ' +
  'rarr 2192 rbbrk 2773 rbrace 7d rbrack 5d rceil 2309 rcub 7d rdquo 201d real 211c reg ae rfloor 230b ' +
  'rho 3c1 rlm 200f roang 27ed robrk 27e7 ropar 2986 rpar 29 rsaquo 203a rsqb 5d rsquo 2019 rtri 25b9 ' +
  'sbquo 201a scaron 161 sdot 22c5 sect a7 semi 3b shy ad sigma 3c3 sigmaf 3c2 sim 223c sol 2f spades 2660 ' +
  'squ 25a1 square 25a1 star 2606 starf 2605 sub 2282 sube 2286 sum 2211 sung 266a sup 2283 sup1 b9 sup2 b2 ' +
  'sup3 b3 supe 2287 szlig df tau 3c4 there4 2234 theta 3b8 thetasym 3d1 thinsp 2009 thorn fe tilde 2dc ' +
  'times d7 trade 2122 uArr 21d1 uacute fa uarr 2191 ucirc fb ugrave f9 uml a8 upsih 3d2 upsilon 3c5 ' +
  'utri 25b5 uuml fc verbar 7c vert 7c weierp 2118 xdtri 25bd xi 3be xutri 25b3 yacute fd yen a5 yuml ff ' +
  'zeta 3b6 zwj 200d zwnj 200c';

const NAMED = {};
{
  const parts = ENTITY_TABLE.trim().split(/\s+/);
  for (let i = 0; i < parts.length; i += 2) NAMED[parts[i]] = String.fromCodePoint(parseInt(parts[i + 1], 16));
  NAMED.nbsp = ' '; // 줄 바꿈 안 되는 공백도 보통 공백으로
}

// 공공데이터 응답은 "&amp;lt;"처럼 두 번 이스케이프된 경우가 있어, 더 바뀌지 않을 때까지 여러 번 푼다.
export function decodeEntities(s) {
  let prev;
  let out = String(s);
  for (let i = 0; i < 3 && out !== prev; i++) {
    prev = out;
    out = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, name) => {
      if (name[0] === '#') {
        const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
      }
      // 엔티티 이름은 대소문자를 가린다(&rArr; ⇒, &rarr; →). 맞는 게 없으면 소문자로 한 번 더 찾는다.
      return NAMED[name] ?? NAMED[name.toLowerCase()] ?? m;
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

// 공공데이터포털(apis.data.go.kr)은 가끔 접속 자체가 10초 동안 안 되다가 곧 풀린다.
// 접속 실패(fetch failed)와 5xx는 잠시 쉬었다가 두 번 더 시도한다. 4xx(키·한도 문제)는 바로 실패.
export const RETRY_DELAYS = [3000, 10000];

export async function fetchText(url, { delays = RETRY_DELAYS } = {}) {
  const masked = url.replace(/(serviceKey|service)=[^&]+/i, '$1=***');
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { Accept: 'application/json, application/xml, text/xml' } });
    } catch (err) {
      if (attempt >= delays.length) throw err;
      await sleep(delays[attempt]);
      continue;
    }
    if (res.ok) return res.text();
    if (res.status < 500 || attempt >= delays.length) throw new Error(`${res.status} ${res.statusText} for ${masked}`);
    await sleep(delays[attempt]);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
