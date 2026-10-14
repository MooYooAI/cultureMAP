import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastUrl, parseForecast, describe, outingTip, loadWeather } from '../src/assets/lib/weather.js';

const regions = [
  { slug: 'seoul', lat: 37.5, lng: 127 },
  { slug: 'busan', lat: 35.1, lng: 129 },
];
const sample = (max) => ({
  current: { temperature_2m: 18.4, weather_code: 1 },
  daily: {
    time: ['2026-10-14', '2026-10-15'],
    weather_code: [0, 61],
    temperature_2m_max: [max, 17.2],
    temperature_2m_min: [9.6, 11],
    precipitation_probability_max: [10, 80],
  },
});

test('지역 좌표를 한 번에 요청한다', () => {
  const url = new URL(forecastUrl(regions));
  assert.equal(url.searchParams.get('latitude'), '37.5,35.1');
  assert.equal(url.searchParams.get('timezone'), 'Asia/Seoul');
});

test('응답을 지역별·날짜별로 정리한다', () => {
  const data = parseForecast([sample(22.6), sample(25)], regions);
  assert.deepEqual(data.seoul.now, { temp: 18, code: 1 });
  assert.deepEqual(data.seoul.days['2026-10-15'], { code: 61, max: 17, min: 11, rain: 80 });
  assert.equal(data.busan.days['2026-10-14'].max, 25);
});

test('날씨 코드와 나들이 한마디', () => {
  assert.equal(describe(0).label, '맑음');
  assert.equal(describe(63).icon, '🌧️');
  assert.match(outingTip({ code: 61, max: 17, min: 11, rain: 80 }), /우산/);
  assert.match(outingTip({ code: 0, max: 22, min: 12, rain: 0 }), /좋아요/);
});

test('1시간 안에는 저장해 둔 예보를 쓴다', async () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return { ok: true, json: async () => Array(17).fill(sample(20)) };
  };
  await loadWeather({ fetchImpl, storage, now: 0 });
  await loadWeather({ fetchImpl, storage, now: 30 * 60 * 1000 });
  assert.equal(calls, 1);
  await loadWeather({ fetchImpl, storage, now: 2 * 60 * 60 * 1000 });
  assert.equal(calls, 2);
});
