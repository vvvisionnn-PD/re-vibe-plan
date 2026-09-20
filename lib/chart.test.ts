// 차트 축 · 폭포 단계 검산 — 실행: npm test (node --test)
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { linearScale, niceDomain, niceStep, ticks } from "./chart.ts";
import { cashWaterfall } from "./calc.ts";
import { applyPreset, PRESETS } from "./presets.ts";

let seq = 0;
const A = applyPreset(PRESETS[0].values!, () => `w${seq++}`);

/** 오차 tol 안에서 같은지 */
function close(actual: number | null, expected: number, tol = 1e-9) {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual! - expected) <= tol, `기대 ${expected}, 실제 ${actual}`);
}

describe("축 계산", () => {
  it("값 → 좌표 (y축은 뒤집힌 범위)", () => {
    const y = linearScale([0, 100], [200, 0]);
    assert.equal(y(0), 200);
    assert.equal(y(100), 0);
    assert.equal(y(50), 100);
    // 폭이 0이면 가운데
    assert.equal(linearScale([5, 5], [0, 100])(5), 50);
  });

  it("눈금 간격은 1 · 2 · 5 × 10ⁿ", () => {
    assert.equal(niceStep(4068, 5), 1000);
    assert.equal(niceStep(780, 5), 200);
    assert.equal(niceStep(45, 5), 10);
    assert.equal(niceStep(9, 5), 2);
  });

  it("축 범위를 눈금에 맞춰 넓힌다", () => {
    assert.deepEqual(niceDomain(0, 4068, 5), [0, 5000]);
    assert.deepEqual(niceDomain(-400, 380, 5), [-400, 400]);
    assert.deepEqual(niceDomain(7, 7), [0, 7]);
  });

  it("눈금 목록 (0은 정확히 0)", () => {
    assert.deepEqual(ticks(0, 5000, 5), [0, 1000, 2000, 3000, 4000, 5000]);
    assert.deepEqual(ticks(-400, 400, 5), [-400, -200, 0, 200, 400]);
  });
});

// ─────────────────────────────────────────────
// 샘플 A 폭포 (분양률 100% · 계획 평당가) — calc.test.ts의 손계산과 같은 값
//   분양수입        4,068.464
//   분양수입 차감   −32.547712  (4,068.464 × 0.8%)   → 4,035.916288
//   세대당 비용     −15.6       (520 × 0.03)          → 4,020.316288
//   고정비          −3,815                            →   205.316288
//   기타유입        +175                              →   380.316288 = 기말현금
// ─────────────────────────────────────────────
describe("사업수지 폭포 (샘플 A 손계산)", () => {
  const w = cashWaterfall(A)!;

  it("단계 순서와 금액", () => {
    assert.deepEqual(
      w.steps.map((s) => s.label),
      ["분양수입", "분양수입 차감", "세대당 비용", "고정비", "기타유입", "기말현금"],
    );
    close(w.steps[0].amount, 4068.464);
    close(w.steps[1].amount, -32.547712);
    close(w.steps[2].amount, -15.6);
    close(w.steps[3].amount, -3815);
    close(w.steps[4].amount, 175);
    close(w.steps[5].amount, 380.316288);
  });

  it("누적(from → to)이 이어지고 마지막은 기말현금", () => {
    close(w.steps[0].to, 4068.464);
    for (let i = 1; i < 4; i++) close(w.steps[i].from, w.steps[i - 1].to);
    close(w.steps[3].to, 205.316288);
    close(w.steps[4].to, 380.316288);
    assert.equal(w.steps[5].from, 0);
    close(w.steps[5].to, 380.316288);
  });

  it("차감 · 유입 구분과 축 범위", () => {
    assert.deepEqual(
      w.steps.map((s) => s.kind),
      ["start", "down", "down", "down", "up", "total"],
    );
    assert.equal(w.min, 0);
    close(w.max, 4068.464);
  });

  it("분양률을 낮추면 기말현금이 음수가 되고 축이 아래로 내려간다", () => {
    const low = cashWaterfall(A, 0.5)!;
    assert.ok(low.steps[5].amount < 0);
    assert.ok(low.min < 0);
  });

  it("입력이 비면 null", () => {
    assert.equal(cashWaterfall({ ...A, fixedCost: null }), null);
  });
});
