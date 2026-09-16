/**
 * 단위 변환 및 표시 포맷.
 *
 * 앱 내부의 금액 단위는 **만원**으로 통일한다. (원 단위는 부동소수 오차가 커지고,
 * 국내 개발사업 수지표의 관행 단위가 만원/백만원이기 때문)
 * 면적의 내부 단위는 **㎡**, 단가의 입력 단위는 **만원/평** 이다.
 */

/** 1평 = 400/121 ㎡ ≈ 3.3057851239669 */
export const M2_PER_PYEONG = 400 / 121;

/** 1억원 = 10,000 만원 */
export const MANWON_PER_EOK = 10_000;

export function m2ToPyeong(m2: number): number {
  return m2 / M2_PER_PYEONG;
}

export function pyeongToM2(pyeong: number): number {
  return pyeong * M2_PER_PYEONG;
}

/** 만원 → 억원 */
export function manwonToEok(manwon: number): number {
  return manwon / MANWON_PER_EOK;
}

/** NaN/Infinity/음수 입력 방어. 계산 엔진 진입부에서 사용. */
export function safeNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 백분율(%) → 배율. 25 → 0.25 */
export function pct(percent: number): number {
  return safeNumber(percent) / 100;
}

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });

/** 만원 단위 금액을 천단위 구분기호로. 예: 1234567 → "1,234,567" */
export function fmtManwon(manwon: number, digits = 0): string {
  return nf(digits, digits).format(safeNumber(manwon));
}

/** 만원 단위 금액을 억원으로. 예: 123456 → "12.35억원" */
export function fmtEok(manwon: number, digits = 2): string {
  return `${nf(digits, digits).format(manwonToEok(safeNumber(manwon)))}억원`;
}

/** 면적. 예: 3305.79 → "3,305.79㎡" */
export function fmtM2(m2: number, digits = 2): string {
  return `${nf(digits, digits).format(safeNumber(m2))}㎡`;
}

/** 면적(평). 예: 1000 → "1,000.00평" */
export function fmtPyeong(m2: number, digits = 2): string {
  return `${nf(digits, digits).format(m2ToPyeong(safeNumber(m2)))}평`;
}

/** 비율(0.1234) → "12.34%" */
export function fmtRatio(ratio: number, digits = 2): string {
  const n = safeNumber(ratio);
  if (!Number.isFinite(n)) return "-";
  return `${nf(digits, digits).format(n * 100)}%`;
}

/** 이미 백분율인 값(12.34) → "12.34%" */
export function fmtPercent(percent: number, digits = 2): string {
  return `${nf(digits, digits).format(safeNumber(percent))}%`;
}
