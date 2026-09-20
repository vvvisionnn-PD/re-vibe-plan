/**
 * 화면 표시용 포맷터 — 계산에는 쓰지 않는다.
 */

/** 값이 없을 때 표시하는 문구 */
export const NO_DATA = "자료 없음";

/**
 * 숫자에 천단위 콤마를 넣는다. null이면 "자료 없음"을 돌려준다.
 * maxDigits는 소수점 이하 최대 자릿수다.
 * fixed가 true이면 소수 자릿수를 maxDigits로 고정한다 (450 → "450.0").
 */
export function formatNumber(value: number | null, maxDigits = 2, fixed = false): string {
  if (value === null || !Number.isFinite(value)) return NO_DATA;
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: maxDigits,
    minimumFractionDigits: fixed ? maxDigits : 0,
  });
}

/** 음수이면 true — 화면에서 빨간색 표시 여부를 정할 때 쓴다 */
export function isNegative(value: number | null): boolean {
  return value !== null && value < 0;
}
