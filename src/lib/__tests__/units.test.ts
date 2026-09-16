import { describe, expect, it } from "vitest";

import {
  M2_PER_PYEONG,
  MANWON_PER_EOK,
  fmtEok,
  fmtPercent,
  fmtRatio,
  m2ToPyeong,
  manwonToEok,
  pct,
  pyeongToM2,
  safeNumber,
} from "../units";

describe("단위 환산", () => {
  it("1평은 400/121 ㎡ (≈3.3058)", () => {
    expect(M2_PER_PYEONG).toBeCloseTo(3.3057851239669, 12);
    expect(M2_PER_PYEONG * 121).toBeCloseTo(400, 10);
  });

  it("㎡ ↔ 평 왕복 변환은 값을 보존한다", () => {
    for (const m2 of [0, 1, 33.058, 5000, 123456.789]) {
      expect(pyeongToM2(m2ToPyeong(m2))).toBeCloseTo(m2, 9);
    }
  });

  it("3.3058㎡ 는 약 1평", () => {
    expect(m2ToPyeong(M2_PER_PYEONG)).toBeCloseTo(1, 12);
  });

  it("1억원은 10,000만원", () => {
    expect(MANWON_PER_EOK).toBe(10_000);
    expect(manwonToEok(123_456)).toBeCloseTo(12.3456, 10);
  });

  it("백분율을 배율로 바꾼다", () => {
    expect(pct(0)).toBe(0);
    expect(pct(4.6)).toBeCloseTo(0.046, 12);
    expect(pct(250)).toBeCloseTo(2.5, 12);
  });
});

describe("입력 방어", () => {
  it("숫자가 아닌 값은 fallback 으로 대체한다", () => {
    expect(safeNumber(NaN)).toBe(0);
    expect(safeNumber(Infinity)).toBe(0);
    expect(safeNumber(-Infinity)).toBe(0);
    expect(safeNumber("abc")).toBe(0);
    expect(safeNumber(undefined)).toBe(0);
    expect(safeNumber(null)).toBe(0); // Number(null) === 0
    expect(safeNumber("12.5")).toBe(12.5);
    expect(safeNumber(NaN, 7)).toBe(7);
  });
});

describe("표시 포맷", () => {
  it("만원을 억원으로 표기한다", () => {
    expect(fmtEok(123_456)).toBe("12.35억원");
    expect(fmtEok(0)).toBe("0.00억원");
  });

  it("비율과 백분율을 구분해 표기한다", () => {
    expect(fmtRatio(0.1234)).toBe("12.34%");
    expect(fmtPercent(12.34)).toBe("12.34%");
  });
});
