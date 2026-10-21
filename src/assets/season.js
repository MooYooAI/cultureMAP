// 한국 계절(서울 기준 달)에 맞춰 배경 빛깔을 바꾼다(body[data-season]). 떨어지는 낙엽·눈 효과는 휴대폰에서 버벅여 뺐다.
// ?season=winter 처럼 주소에 붙이면 미리 볼 수 있다.
(() => {
  const month = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(new Date()));
  const byMonth = month >= 3 && month <= 5 ? 'spring' : month <= 8 && month >= 6 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  const asked = new URLSearchParams(location.search).get('season');
  const season = ['spring', 'summer', 'autumn', 'winter'].includes(asked) ? asked : byMonth;
  document.body.dataset.season = season;
})();
