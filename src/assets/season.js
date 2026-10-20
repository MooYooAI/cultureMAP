// 한국 계절(서울 기준 달)에 맞춰 배경에 떨어지는 것들을 띄운다: 봄 벚꽃잎, 여름 반딧불, 가을 낙엽, 겨울 눈.
// ?season=winter 처럼 주소에 붙이면 미리 볼 수 있다. 움직임 줄이기 설정이면 띄우지 않는다.
(() => {
  const month = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(new Date()));
  const byMonth = month >= 3 && month <= 5 ? 'spring' : month <= 8 && month >= 6 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter';
  const asked = new URLSearchParams(location.search).get('season');
  const season = ['spring', 'summer', 'autumn', 'winter'].includes(asked) ? asked : byMonth;
  document.body.dataset.season = season;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const LEAF = 'M12 1C6 6 3 12 6 18c1.6 3 4 4 6 5 2-1 4.4-2 6-5 3-6 0-12-6-17zM12 4v18';
  const GINKGO = 'M12 23v-8M12 15C5 15 1 9 2 4c3 1.5 6.5 2 10 2s7-.5 10-2c1 5-3 11-10 11zM12 6v9';
  const PETAL = 'M12 2c5 3 7 9 5 14-1 3-3 5-5 6-2-1-4-3-5-6-2-5 0-11 5-14zM12 2l-1.2 3h2.4z';
  const shapes = {
    autumn: [[LEAF, '#e8572a'], [LEAF, '#c2410c'], [GINKGO, '#f5b72f'], [LEAF, '#f08a2c'], [GINKGO, '#e9a21d'], [LEAF, '#b8321a']],
    spring: [[PETAL, '#f9b4cb'], [PETAL, '#f7a1bd'], [PETAL, '#fcd2df']],
  };
  const svg = ([d, c]) => `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="${d}" fill="${c}" stroke="rgba(0,0,0,.12)" stroke-width=".6" stroke-linejoin="round"/></svg>`;

  const count = innerWidth < 700 ? 10 : 18;
  const layer = document.createElement('div');
  layer.className = 'season-layer';
  layer.setAttribute('aria-hidden', 'true');
  const rand = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'sp';
    const dur = season === 'summer' ? rand(9, 16) : season === 'winter' ? rand(10, 20) : rand(11, 19);
    const size = season === 'winter' ? rand(5, 11) : season === 'summer' ? rand(4, 8) : rand(18, 30);
    p.style.cssText = `--x:${rand(0, 100).toFixed(1)}vw;--d:${dur.toFixed(1)}s;--delay:${(-rand(0, dur)).toFixed(1)}s;--s:${size.toFixed(0)}px;--sway:${rand(20, 70).toFixed(0)}px;--sd:${rand(2.5, 5).toFixed(1)}s;--r:${rand(240, 720).toFixed(0)}deg`;
    const inner = document.createElement('i');
    const list = shapes[season];
    if (list) inner.innerHTML = svg(list[i % list.length]);
    p.append(inner);
    layer.append(p);
  }
  document.body.prepend(layer);
})();
