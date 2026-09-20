// 검산 테스트 — 실행: npm test (node --test)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bisect,
  cashBreakdown,
  dscr,
  missingInputs,
  repaySentence,
  riskMetrics,
  rowSupplyPyeong,
  emptyHousingType,
  emptyInput,
  endingCash,
  isRepayable,
  ltv,
  parseNumberInput,
  priceThreshold,
  salesRateThreshold,
  salesRevenue,
  sensitivityTable,
  SENSITIVITY_PRICE_OFFSETS,
  SENSITIVITY_RATES,
  summarizeHousing,
  type HousingType,
  type PlanInput,
  type Threshold,
} from "./calc.ts";
import { formatNumber, NO_DATA } from "./format.ts";
import { applyPreset, PRESETS } from "./presets.ts";
import { isFullSidoName, isFullSigunguName } from "./region.ts";

/** 두 수가 오차 tol 안에서 같은지 확인한다 */
function close(actual: number | null, expected: number, tol = 1e-9, msg?: string) {
  assert.notEqual(actual, null, msg);
  assert.ok(Math.abs(actual! - expected) <= tol, `${msg ?? ""} 기대 ${expected}, 실제 ${actual}`);
}

/** 한계선 결과에서 값을 꺼낸다. 값이 아니면 실패 */
function valueOf(t: Threshold): number {
  assert.equal(t.kind, "value");
  return (t as { kind: "value"; value: number }).value;
}

/** 임시 값을 입력값으로 만든다 */
let idSeq = 0;
const preset = (i: 0 | 1 | 2): PlanInput => applyPreset(PRESETS[i].values!, () => `row-${idSeq++}`);

const A = preset(0);
const B = preset(1);
const C = preset(2);

/** 테스트용 주택형 행을 만든다 */
const row = (id: string, supplyPyeong: number | null, units: number | null, exclusiveM2: number | null = null): HousingType => ({
  id,
  name: id,
  exclusiveM2,
  supplyPyeong,
  units,
});

// ─────────────────────────────────────────────
// 샘플 A 손계산 (분양률 100%, 평당가 2,420만원)
//   공급면적  = 25.6 × 200 + 34.6 × 320           = 16,192평 · 520세대
//   분양수입  = 16,192 × 2,420 ÷ 10,000 + 150     = 4,068.464억
//   기말현금  = 4,068.464 × 0.992 − 520 × 0.03 + 175 − 3,815
//            = 4,035.916288 − 15.6 + 175 − 3,815   = 380.316288억
//   DSCR     = 1 + (380.316288 + 400) ÷ (2,450 + 480) = 1.266319...
//   LTV      = 2,450 ÷ 4,068.464                     = 60.219...%
//   분양률 r에 대해: 기말현금 = 4,020.316288·r − 3,640
//     기말현금 0     → r = 3,640 ÷ 4,020.316288       = 90.540...%
//     기말현금 −400  → r = 3,240 ÷ 4,020.316288       = 80.591...%
//   평당가 p에 대해 (r = 100%): 기말현금 = 1.6062464·p − 3,506.8
//     기말현금 0     → p = 3,506.8 ÷ 1.6062464        = 2,183.2만원
//     기말현금 −400  → p = 3,106.8 ÷ 1.6062464        = 1,934.2만원
// ─────────────────────────────────────────────
describe("검산 기준 — 샘플 A가 이 값이어야 통과", () => {
  it("공급면적 16,192.0평 (표 값)", () => {
    const s = summarizeHousing(A.housingTypes);
    close(s.totalSupplyPyeong, 16192);
    assert.equal(s.totalUnits, 520);
  });

  it("기말현금 +380.3억", () => {
    assert.equal(endingCash(A, 1)!.toFixed(1), "380.3");
  });

  it("DSCR 1.27", () => {
    assert.equal(dscr(A, 1)!.toFixed(2), "1.27");
  });

  it("LTV 60.2%", () => {
    assert.equal((ltv(A)! * 100).toFixed(1), "60.2");
  });

  it("기말현금 0: 분양률 90.5% · 평당가 2,183만원", () => {
    assert.equal((valueOf(salesRateThreshold(A, "zero")) * 100).toFixed(1), "90.5");
    assert.equal(Math.round(valueOf(priceThreshold(A, "zero"))), 2183);
  });

  it("상환 한계: 분양률 80.6% · 평당가 1,934만원", () => {
    assert.equal((valueOf(salesRateThreshold(A, "repay")) * 100).toFixed(1), "80.6");
    assert.equal(Math.round(valueOf(priceThreshold(A, "repay"))), 1934);
  });
});

describe("샘플 A 손계산 정밀값", () => {
  it("분양수입 · 기말현금 · DSCR · LTV", () => {
    close(salesRevenue(A, 1), 4068.464);
    close(endingCash(A, 1), 380.316288);
    close(dscr(A, 1), 1 + 780.316288 / 2930);
    close(ltv(A), 2450 / 4068.464);
  });

  it("이분법 한계선 = 손으로 푼 1차식의 해", () => {
    close(valueOf(salesRateThreshold(A, "zero")), 3640 / 4020.316288, 1e-8);
    close(valueOf(salesRateThreshold(A, "repay")), 3240 / 4020.316288, 1e-8);
    close(valueOf(priceThreshold(A, "zero")), 3506.8 / 1.6062464, 1e-6);
    close(valueOf(priceThreshold(A, "repay")), 3106.8 / 1.6062464, 1e-6);
  });

  // 이분법은 x를 1e-9까지 좁힌다. 기말현금 기울기(분양률 1당 약 4,020억)를 곱하면
  // 기말현금 오차는 약 4e-6억(400원)이므로 허용 오차를 1e-5억(1,000원)으로 둔다.
  it("한계선에서 기말현금은 목표값, 상환 한계에서 DSCR은 1", () => {
    close(endingCash(A, valueOf(salesRateThreshold(A, "zero"))), 0, 1e-5);
    close(endingCash(A, 1, valueOf(priceThreshold(A, "repay"))), -400, 1e-5);
    close(dscr(A, valueOf(salesRateThreshold(A, "repay"))), 1, 1e-8);
  });
});

describe("샘플 B · C — 표의 기말현금", () => {
  // B: (24,084 × 2,650 ÷ 10,000 + 180) × 0.992 − 780 × 0.03 + 260 − 6,296.4 = 449.96192
  it("B 기말현금 +450.0억", () => {
    close(endingCash(B, 1), 449.96192);
    assert.equal(endingCash(B, 1)!.toFixed(1), "450.0");
    close(summarizeHousing(B.housingTypes).totalSupplyPyeong, 24084);
  });

  // C: (12,592 × 1,980 ÷ 10,000 + 90) × 0.992 − 380 × 0.03 + 120 − 2,461.2 = 209.950272
  it("C 기말현금 +210.0억", () => {
    close(endingCash(C, 1), 209.950272);
    assert.equal(endingCash(C, 1)!.toFixed(1), "210.0");
    close(summarizeHousing(C.housingTypes).totalSupplyPyeong, 12592);
  });
});

describe("민감도 표", () => {
  const t = sensitivityTable(A)!;

  it("행 = 분양률 75~100%(5%p), 열 = 계획 평당가 −500~+100만원(100만원)", () => {
    assert.equal(t.length, 6);
    assert.deepEqual(SENSITIVITY_RATES, [0.75, 0.8, 0.85, 0.9, 0.95, 1]);
    assert.deepEqual(SENSITIVITY_PRICE_OFFSETS, [-500, -400, -300, -200, -100, 0, 100]);
    assert.deepEqual(t[0].map((c) => c.price), [1920, 2020, 2120, 2220, 2320, 2420, 2520]);
  });

  it("분양률 100% · 계획 평당가 칸 = 기말현금 380.316288", () => {
    close(t[5][5].endingCash, 380.316288);
  });

  // (16,192 × 1,920 ÷ 10,000 + 150) × 0.75 × 0.992 − 520 × 0.75 × 0.03 + 175 − 3,815
  //   = 2,424.594816 − 11.7 − 3,640 = −1,227.105184
  it("분양률 75% · 평당가 1,920만원 칸 (손계산)", () => {
    close(t[0][0].endingCash, -1227.105184, 1e-6);
    assert.equal(t[0][0].repayable, false);
  });

  it("상환 가능 색 구분이 한계선과 맞다 (80.6% · 1,934만원)", () => {
    const planCol = SENSITIVITY_PRICE_OFFSETS.indexOf(0);
    assert.equal(t[1][planCol].repayable, false); // 80% < 80.6%
    assert.equal(t[2][planCol].repayable, true); // 85% ≥ 80.6%
    assert.equal(t[5][0].repayable, false); // 1,920만원 < 1,934만원
    assert.equal(t[5][1].repayable, true); // 2,020만원 ≥ 1,934만원
  });

  it("모든 칸에서 상환 가능 ⇔ DSCR ≥ 1", () => {
    for (const r of t) {
      for (const c of r) {
        assert.equal(c.repayable, dscr(A, c.rate, c.price)! >= 1, `${c.rate} · ${c.price}`);
      }
    }
  });
});

describe("사업수지 내역 (샘플 A 손계산)", () => {
  // 4,068.464 × 0.992 = 4,035.916288 · 520 × 0.03 = 15.6 · 기타유입 175 · 고정비 3,815
  it("항목과 합계", () => {
    const b = cashBreakdown(A)!;
    const amounts = b.lines.map((l) => l.amount);
    close(amounts[0], 4035.916288);
    close(amounts[1], -15.6);
    close(amounts[2], 175);
    close(amounts[3], -3815);
    close(amounts.reduce((a, x) => a + x, 0), 380.316288);
    close(b.endingCash, 380.316288);
    close(b.salesRevenue, 4068.464);
  });

  it("입력이 비면 null", () => {
    assert.equal(cashBreakdown(emptyInput()), null);
  });
});

describe("빈 입력 목록", () => {
  it("샘플 A는 빠진 입력이 없다", () => {
    assert.deepEqual(missingInputs(A, "debt"), []);
  });

  it("빈 폼은 사업수지에 필요한 입력을 모두 알려준다", () => {
    assert.deepEqual(missingInputs(emptyInput(), "cash"), ["주택형(공급면적 · 세대수)", "평당가", "상가", "기타유입", "고정비"]);
    assert.deepEqual(missingInputs({ ...A, subordinated: null }, "cash"), []);
    assert.deepEqual(missingInputs({ ...A, subordinated: null }, "debt"), ["후순위"]);
  });
});

describe("리스크 지표 (샘플 A 손계산)", () => {
  // 상환 한계 분양률 = 3,240 ÷ 4,020.316288 → 여유 = 100% − 80.59% = 19.41%p
  // 상환 한계 평당가 = 3,106.8 ÷ 1.6062464 = 1,934.2 → 여유 = 2,420 − 1,934.2 = 485.8만원 (20.1%)
  // 고정비 증가 여유 = 기말현금 380.316288 + 후순위 400 = 780.316288억
  it("분양률 · 평당가 · 고정비 여유", () => {
    const m = riskMetrics(A);
    close(m.salesRateMarginPt, (1 - 3240 / 4020.316288) * 100, 1e-6);
    close(m.priceMargin, 2420 - 3106.8 / 1.6062464, 1e-6);
    close(m.priceMarginPct, ((2420 - 3106.8 / 1.6062464) / 2420) * 100, 1e-6);
    close(m.costCushion, 780.316288);
  });

  it("고정비를 여유만큼 늘리면 DSCR이 정확히 1", () => {
    close(dscr({ ...A, fixedCost: 3815 + 780.316288 }, 1), 1, 1e-9);
  });
});

describe("민감도 자동 문장", () => {
  it("샘플 A: 한계선 1,934.2만원 · 80.59%를 올림해서 표시", () => {
    assert.equal(repaySentence(A), "평당 1,935만원 / 분양률 80.6% 이상이면 상환 가능");
  });

  it("문장의 값에서는 실제로 상환 가능하다", () => {
    assert.equal(dscr(A, 1, 1935)! >= 1, true);
    assert.equal(dscr(A, 0.806)! >= 1, true);
  });

  it("입력이 비면 자료 없음, 도달할 수 없으면 불가 문장", () => {
    assert.equal(repaySentence(emptyInput()), "자료 없음");
    assert.match(repaySentence({ ...A, fixedCost: 100_000 }), /상환 불가/);
  });
});

describe("빈 입력 · 예외", () => {
  it("처음 입력값은 모두 비어 있고, 모든 지표는 자료 없음", () => {
    const input = emptyInput();
    assert.equal(input.projectName, "");
    assert.deepEqual(input.housingTypes, []);
    for (const key of [
      "pricePerPyeong",
      "retail",
      "otherInflow",
      "fixedCost",
      "seniorPf",
      "seniorPfFinanceCost",
      "subordinated",
    ] as const) {
      assert.equal(input[key], null, key);
    }
    assert.equal(salesRevenue(input, 1), null);
    assert.equal(endingCash(input, 1), null);
    assert.equal(dscr(input, 1), null);
    assert.equal(ltv(input), null);
    assert.equal(salesRateThreshold(input, "zero").kind, "none");
    assert.equal(priceThreshold(input, "repay").kind, "none");
    assert.equal(sensitivityTable(input), null);
  });

  it("값 하나만 비어도 그 값을 쓰는 지표는 자료 없음", () => {
    assert.equal(endingCash({ ...A, fixedCost: null }, 1), null);
    assert.equal(salesRevenue({ ...A, retail: null }, 1), null);
    assert.equal(dscr({ ...A, subordinated: null }, 1), null);
    assert.equal(salesRateThreshold({ ...A, subordinated: null }, "repay").kind, "none");
    // 후순위가 비어도 기말현금 0 한계선은 계산할 수 있다
    assert.equal(salesRateThreshold({ ...A, subordinated: null }, "zero").kind, "value");
  });

  it("일부만 채운 주택형이 있으면 계산하지 않는다", () => {
    const partial = { ...A, housingTypes: [...A.housingTypes, row("x", 30, null)] };
    assert.equal(endingCash(partial, 1), null);
  });

  it("본PF + 금융비용이 0이면 DSCR 자료 없음", () => {
    assert.equal(dscr({ ...A, seniorPf: 0, seniorPfFinanceCost: 0 }, 1), null);
  });

  it("분양률 100%로도 목표에 못 미치면 unreachable", () => {
    assert.equal(salesRateThreshold({ ...A, fixedCost: 100_000 }, "zero").kind, "unreachable");
  });

  it("분양률 0%에서 이미 목표 이상이면 한계선은 0", () => {
    const easy = { ...A, fixedCost: 0 };
    assert.equal(valueOf(salesRateThreshold(easy, "zero")), 0);
    assert.equal(valueOf(priceThreshold(easy, "zero")), 0);
  });
});

describe("이분법", () => {
  it("증가·감소 함수 모두에서 목표값을 찾는다", () => {
    close(bisect((x) => x * x, 2, 0, 2), Math.SQRT2, 1e-8);
    close(bisect((x) => 10 - x, 4, 0, 10), 6, 1e-8);
  });

  it("상환 가능 경계는 포함한다 (기말현금 = −후순위)", () => {
    assert.equal(isRepayable(-400, 400), true);
    assert.equal(isRepayable(-400.01, 400), false);
  });
});

describe("주택형 집계 (손계산)", () => {
  it("공급면적 합계 = Σ(공급평 × 세대수), 세대수 합계 = Σ 세대수", () => {
    // 25 × 100 + 34 × 60 + 45.5 × 10 = 2,500 + 2,040 + 455 = 4,995평 · 170세대
    const s = summarizeHousing([row("a", 25, 100), row("b", 34, 60), row("c", 45.5, 10)]);
    assert.equal(s.totalSupplyPyeong, 4995);
    assert.equal(s.totalUnits, 170);
    assert.equal(s.completeRows, 3);
    assert.equal(s.incompleteRows, 0);
  });

  it("공급평이나 세대수가 빈 행은 합계에서 빠지고 미완성으로 센다", () => {
    const s = summarizeHousing([row("a", 25, 100), row("b", 34, null), row("c", null, 10, 59)]);
    assert.equal(s.totalSupplyPyeong, 2500);
    assert.equal(s.totalUnits, 100);
    assert.equal(s.incompleteRows, 2);
  });

  it("아무것도 입력하지 않은 새 행은 미완성으로 세지 않는다", () => {
    const s = summarizeHousing([emptyHousingType("new")]);
    assert.equal(s.totalSupplyPyeong, null);
    assert.equal(s.incompleteRows, 0);
  });

  it("행별 공급면적 소계 = 공급평 × 세대수 (A: 5,120평 · 11,072평)", () => {
    assert.deepEqual(A.housingTypes.map(rowSupplyPyeong).map((v) => Math.round(v! * 10) / 10), [5120, 11072]);
    assert.equal(rowSupplyPyeong(row("x", 30, null)), null);
  });

  it("주택형 표가 비어 있으면 합계는 자료 없음(null)", () => {
    assert.equal(summarizeHousing([]).totalSupplyPyeong, null);
  });
});

describe("숫자 입력 해석", () => {
  it("빈 칸은 null, 콤마·소수는 읽는다", () => {
    assert.deepEqual(parseNumberInput(""), { ok: true, value: null });
    assert.deepEqual(parseNumberInput("   "), { ok: true, value: null });
    assert.deepEqual(parseNumberInput("1,234.5"), { ok: true, value: 1234.5 });
    assert.deepEqual(parseNumberInput(".5"), { ok: true, value: 0.5 });
  });

  it("숫자가 아니거나 음수, 소수 세대수는 거부한다", () => {
    for (const bad of ["12억", "1e3", "-5", "-"]) assert.equal(parseNumberInput(bad).ok, false, bad);
    assert.equal(parseNumberInput("10.5", true).ok, false);
    assert.deepEqual(parseNumberInput("10", true), { ok: true, value: 10 });
  });
});

describe("사업대상지 이름", () => {
  it("시도는 전체 이름만 통과", () => {
    for (const ok of ["서울특별시", "부산광역시", "세종특별자치시", "경기도", "제주특별자치도", ""]) {
      assert.equal(isFullSidoName(ok), true, ok);
    }
    for (const bad of ["서울", "경기", "부산 "]) assert.equal(isFullSidoName(bad), false, bad);
  });

  it("시군구는 시·군·구로 끝나야 통과", () => {
    for (const ok of ["강남구", "수원시 영통구", "양평군", "창원시", ""]) {
      assert.equal(isFullSigunguName(ok), true, ok);
    }
    for (const bad of ["강남", "영통"]) assert.equal(isFullSigunguName(bad), false, bad);
  });
});

describe("표시 규칙", () => {
  it("천단위 콤마, 빈 값은 자료 없음", () => {
    assert.equal(formatNumber(1234567.891), "1,234,567.89");
    assert.equal(formatNumber(-1500), "-1,500");
    assert.equal(formatNumber(null), NO_DATA);
    assert.equal(formatNumber(450, 1), "450");
    assert.equal(formatNumber(450, 1, true), "450.0");
    assert.equal(formatNumber(12592, 1, true), "12,592.0");
  });
});

describe("임시 값", () => {
  it("버튼 3개 모두 값이 있고, 음수 없이 주택형 행이 완성돼 있다", () => {
    assert.equal(PRESETS.length, 3);
    for (const p of PRESETS) {
      assert.notEqual(p.values, null, p.label);
      const { housingTypes, projectName, sido, sigungu, ...numbers } = p.values!;
      assert.ok(projectName && isFullSidoName(sido) && isFullSigunguName(sigungu), p.label);
      for (const [k, v] of Object.entries(numbers)) assert.ok(v !== null && v >= 0, `${p.label}.${k}`);
      for (const h of housingTypes) assert.ok(h.supplyPyeong !== null && h.units !== null, `${p.label} ${h.name}`);
    }
  });

  it("적용하면 주택형 행마다 새 id를 붙인다", () => {
    let n = 0;
    const input = applyPreset(PRESETS[0].values!, () => `id-${n++}`);
    assert.deepEqual(
      input.housingTypes.map((h) => h.id),
      ["id-0", "id-1"],
    );
    assert.equal(input.projectName, "해운대 그린테라스");
  });
});
