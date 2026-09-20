/**
 * 차트 축 계산 — 순수 함수. 값 → 좌표 변환과 눈금만 다룬다.
 * 사업 숫자는 lib/calc.ts · lib/market.ts에서 이미 계산된 것을 쓴다.
 */

/** 값을 화면 좌표로 바꾸는 함수를 만든다 (domain이 한 점이면 가운데로) */
export function linearScale(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

/** 눈금 간격을 1 · 2 · 5 × 10ⁿ 중에서 고른다 */
export function niceStep(span: number, count: number): number {
  if (span <= 0 || count <= 0) return 1;
  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / magnitude;
  const factor = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return factor * magnitude;
}

/** 눈금이 딱 떨어지도록 넓힌 축 범위 */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return min === 0 ? [0, 1] : [Math.min(0, min), Math.max(0, max)];
  const step = niceStep(max - min, count);
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

/** 축 범위 안의 눈금 값 목록 */
export function ticks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const step = niceStep(max - min, count);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step / 1000; v += step) {
    out.push(Math.abs(v) < step / 1000 ? 0 : v);
  }
  return out;
}
