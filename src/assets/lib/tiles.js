// 지도 바탕 타일. 기본 타일이 하나도 안 불러와지면 예비 타일로 바꾼다.
export function addBaseTiles(map, t = window.SITE_TILES) {
  const make = (c) => L.tileLayer(c.url, { maxZoom: c.maxZoom, attribution: c.attribution, subdomains: c.subdomains || 'abc' });
  const primary = make(t).addTo(map);
  if (!t.fallback) return;
  let loaded = 0;
  let failed = 0;
  primary.on('tileload', () => loaded++);
  primary.on('tileerror', () => {
    failed++;
    if (loaded === 0 && failed >= 4) {
      map.removeLayer(primary);
      make(t.fallback).addTo(map);
      map.getContainer().classList.add('tiles-fallback');
    }
  });
}
