// 추천 축제 키워드. 한국관광공사 '대한민국 구석구석 축제'(kfes)의 추천 키워드처럼 계절에 맞는 주제로 행사를 묶는다.
// kfes 키워드 자료는 공개 API로 나와 있지 않아, 행사 제목·소개글의 낱말로 직접 분류한다.
// months가 있는 키워드는 그 달에만 첫 화면에 보인다(페이지는 1년 내내 있다).
export const KEYWORDS = [
  { slug: 'spring-flower', name: '봄꽃', months: [3, 4, 5], re: /벚꽃|진달래|철쭉|유채|튤립|매화|산수유|봄꽃|목련|수선화/ },
  { slug: 'water', name: '물놀이', months: [6, 7, 8], re: /물놀이|해수욕|머드|워터|물축제|물총|해변|계곡|비치/ },
  { slug: 'autumn-flower', name: '가을꽃', months: [9, 10, 11], re: /국화|코스모스|억새|핑크뮬리|구절초|가을꽃|단풍|메밀꽃|댑싸리|갈대/ },
  { slug: 'reading', name: '독서', months: [9, 10, 11], re: /독서|북\s?페스|책|도서관|문학|시인/ },
  { slug: 'winter', name: '눈꽃·얼음', months: [12, 1, 2], re: /눈꽃|얼음|빙어|송어|산천어|눈썰매|겨울|스케이트|빙벽/ },
  { slug: 'christmas', name: '크리스마스', months: [11, 12], re: /크리스마스|성탄|산타|트리\s?축제/ },
  { slug: 'outing', name: '나들이', re: /나들이|소풍|피크닉|가족|어린이|정원|수목원|공원|숲|둘레길|걷기|캠핑/ },
  { slug: 'night-view', name: '야경', re: /야경|야행|불빛|빛\s?축제|등\s?축제|유등|불꽃|달빛|별빛|조명|미디어\s?파사드|야간|일루미|드론\s?쇼/ },
  { slug: 'food', name: '먹거리', re: /먹거리|음식|미식|푸드|맛축제|김밥|빵|사과|한우|대하|전어|김치|막걸리|와인|맥주|커피|젓갈|꽃게|인삼|고추|쌀|딸기|포도|수박|참외|한과|국수|떡볶이|굴축제|홍시|곶감|송이|약초|녹차|차\s?문화/ },
  { slug: 'history', name: '역사탐방', re: /역사|읍성|문화유산|세계유산|고인돌|왕릉|성곽|유적|향교|서원|민속|선사|사적|고분|산성|문화재|백제|신라|가야|고려|조선|궁궐|한옥/ },
];
export const KEYWORD_BY_SLUG = Object.fromEntries(KEYWORDS.map((k) => [k.slug, k]));

// 행사 하나가 어느 키워드에 들어가는지. 제목에 걸리면 확실하고, 소개글은 앞부분만 본다(뒤쪽 부대행사 소개에 휩쓸리지 않게).
export function eventKeywords(e) {
  const text = `${e.title || ''} ${String(e.description || '').slice(0, 200)}`;
  return KEYWORDS.filter((k) => k.re.test(text)).map((k) => k.slug);
}

// 이번 달 첫 화면에 보일 키워드: 계절 키워드를 앞에, 행사가 하나라도 있는 것만.
export function seasonalKeywords(events, today) {
  const month = Number(today.slice(5, 7));
  const count = (slug) => events.filter((e) => (e.tags || []).includes(slug)).length;
  return KEYWORDS.filter((k) => !k.months || k.months.includes(month))
    .sort((a, b) => Number(Boolean(b.months)) - Number(Boolean(a.months)))
    .map((k) => ({ ...k, count: count(k.slug) }))
    .filter((k) => k.count > 0);
}
