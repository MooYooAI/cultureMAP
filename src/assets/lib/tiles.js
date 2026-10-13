// 지도 바탕 타일. 기본 타일이 오류를 내거나 3초 안에 한 장도 안 뜨면 예비 타일로 바꾼다.
// 한 번 예비 타일로 바뀐 브라우저는 다음 방문부터 바로 예비 타일을 쓴다.
const KEY = 'tiles-fallback';
const WAIT_MS = 3000;

function remember() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)
  }
}

function remembered() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function addBaseTiles(map, t = window.SITE_TILES) {
  const make = (c) => L.tileLayer(c.url, { maxZoom: c.maxZoom, attribution: c.attribution, subdomains: c.subdomains || 'abc' });
  const useFallback = () => {
    map.getContainer().classList.add('tiles-fallback');
    return make(t.fallback).addTo(map);
  };
  if (t.fallback && remembered()) return useFallback();
  const primary = make(t).addTo(map);
  if (!t.fallback) return primary;

  let loaded = 0;
  let failed = 0;
  let switched = false;
  const switchOver = () => {
    if (switched || loaded > 0) return;
    switched = true;
    clearTimeout(timer);
    map.removeLayer(primary);
    remember();
    useFallback();
  };
  const timer = setTimeout(switchOver, WAIT_MS);
  primary.on('tileload', () => {
    loaded++;
    clearTimeout(timer);
  });
  primary.on('tileerror', () => {
    if (++failed >= 4) switchOver();
  });
  return primary;
}
