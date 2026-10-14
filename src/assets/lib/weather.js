// 날씨 예보: Open-Meteo(키 없이 쓰는 무료 예보 API, 출처 표시 CC BY 4.0).
// 17개 시·도 대표 좌표의 16일 예보를 요청 한 번으로 받고, 1시간 동안 브라우저에 저장해 둔다.
// 나중에 기상청 단기예보(공공데이터포털)로 바꾸려면 forecastUrl/parseForecast만 바꾸면 된다.
import { REGIONS } from './regions.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const CACHE_KEY = 'weather:v1';
const TTL = 60 * 60 * 1000;
export const FORECAST_DAYS = 16;

export function forecastUrl(regions = REGIONS) {
  const p = new URLSearchParams({
    latitude: regions.map((r) => r.lat).join(','),
    longitude: regions.map((r) => r.lng).join(','),
    current: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Asia/Seoul',
    forecast_days: String(FORECAST_DAYS),
  });
  return `${API}?${p}`;
}

// 응답(좌표가 여러 개면 배열) → { seoul: { now: { temp, code }, days: { 'YYYY-MM-DD': { code, max, min, rain } } }, ... }
export function parseForecast(json, regions = REGIONS) {
  const list = Array.isArray(json) ? json : [json];
  const out = {};
  regions.forEach((r, i) => {
    const f = list[i];
    if (!f?.daily?.time) return;
    const d = f.daily;
    const days = {};
    d.time.forEach((date, j) => {
      days[date] = {
        code: d.weather_code[j],
        max: Math.round(d.temperature_2m_max[j]),
        min: Math.round(d.temperature_2m_min[j]),
        rain: d.precipitation_probability_max?.[j] ?? null,
      };
    });
    out[r.slug] = {
      now: f.current ? { temp: Math.round(f.current.temperature_2m), code: f.current.weather_code } : null,
      days,
    };
  });
  return out;
}

// WMO 날씨 코드 → 아이콘과 짧은 설명
export function describe(code) {
  if (code === 0) return { icon: '☀️', label: '맑음' };
  if (code === 1) return { icon: '🌤️', label: '대체로 맑음' };
  if (code === 2) return { icon: '⛅', label: '구름 조금' };
  if (code === 3) return { icon: '☁️', label: '흐림' };
  if (code === 45 || code === 48) return { icon: '🌫️', label: '안개' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: '이슬비' };
  if (code >= 61 && code <= 67) return { icon: '🌧️', label: '비' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '🌨️', label: '눈' };
  if (code >= 80 && code <= 82) return { icon: '🌦️', label: '소나기' };
  if (code >= 95) return { icon: '⛈️', label: '뇌우' };
  return { icon: '🌡️', label: '' };
}

// 나들이 한마디: 궂은 날씨가 먼저, 그다음 기온.
export function outingTip(day) {
  if (!day) return '';
  const c = day.code;
  if (c >= 95) return '⚡ 야외 행사는 공지를 확인하세요';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return '⛄ 눈 소식, 미끄럼 조심하세요';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || day.rain >= 60) return '☔ 우산 챙기세요';
  if (day.max >= 30) return '🥤 더워요, 물 챙기세요';
  if (day.min <= 3) return '🧣 쌀쌀해요, 따뜻하게 입으세요';
  if (day.rain >= 30) return '🌂 작은 우산 있으면 좋아요';
  return '😊 나들이하기 좋아요';
}

export async function loadWeather({ fetchImpl = fetch, storage = safeStorage(), now = Date.now() } = {}) {
  try {
    const cached = JSON.parse(storage?.getItem(CACHE_KEY) || 'null');
    if (cached && now - cached.at < TTL) return cached.data;
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)는 매번 받는다.
  }
  const res = await fetchImpl(forecastUrl());
  if (!res.ok) throw new Error(`weather ${res.status}`);
  const data = parseForecast(await res.json());
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify({ at: now, data }));
  } catch {
    // 저장 실패는 무시
  }
  return data;
}

function safeStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
