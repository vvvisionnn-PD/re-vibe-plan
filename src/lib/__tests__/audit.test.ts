import { describe, expect, it } from "vitest";

import { withPatch } from "../analysis";
import { auditFeasibility } from "../audit";
import { BASE_INPUT, PRESETS, buildPreset } from "../defaults";
import { computeFeasibility } from "../feasibility";

const base = BASE_INPUT;

describe("검산 리포트", () => {
  const report = auditFeasibility(base);

  it("기준 시나리오에서 모든 항등식이 성립한다", () => {
    const failed = report.identityFailures.map(
      (c) => `${c.label} (차이 ${c.diff})`,
    );
    expect(failed).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("항등식과 개연성 점검이 모두 포함된다", () => {
    expect(report.checks.some((c) => c.kind === "identity")).toBe(true);
    expect(report.checks.some((c) => c.kind === "sanity")).toBe(true);
  });

  it("검산 항목 id 는 중복되지 않는다", () => {
    const ids = report.checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("각 항목이 기대값·실제값·허용오차를 모두 보고한다", () => {
    for (const c of report.checks) {
      expect(Number.isFinite(c.expected)).toBe(true);
      expect(Number.isFinite(c.actual)).toBe(true);
      expect(c.diff).toBeGreaterThanOrEqual(0);
      expect(c.tolerance).toBeGreaterThanOrEqual(0);
      expect(c.passed).toBe(c.diff <= c.tolerance);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });
});

describe("모든 프리셋에 대한 검산", () => {
  it.each(PRESETS.map((p) => p.label))("%s", (useType) => {
    const input = buildPreset(useType);
    const report = auditFeasibility(input);
    expect(report.identityFailures.map((c) => c.label)).toEqual([]);
  });
});

describe("극단 입력에서도 항등식은 유지된다", () => {
  const cases: [string, ReturnType<typeof withPatch>][] = [
    ["분양률 0%", withPatch(base, "revenue", { salesRate: 0 })],
    ["분양률 150%", withPatch(base, "revenue", { salesRate: 150 })],
    ["자기자본 0", withPatch(base, "finance", { equity: 0 })],
    [
      "자기자본 과다",
      withPatch(base, "finance", { equity: 100_000_000 }),
    ],
    ["지하 없음", withPatch(base, "building", { basementAreaM2: 0 })],
    [
      "초고가 토지",
      withPatch(base, "land", { unitPricePerPyeong: 100_000 }),
    ],
    ["예비비 0%", withPatch(base, "indirect", { contingencyRate: 0 })],
    [
      "브릿지 미사용",
      withPatch(base, "finance", { bridgeLtv: 0, bridgeMonths: 0 }),
    ],
    [
      "기중 회수 없음",
      withPatch(base, "finance", { salesCollectionRate: 0 }),
    ],
    [
      "기중 회수 100%",
      withPatch(base, "finance", { salesCollectionRate: 100 }),
    ],
  ];

  it.each(cases)("%s", (_label, input) => {
    const report = auditFeasibility(input);
    expect(report.identityFailures.map((c) => c.label)).toEqual([]);
  });
});

describe("개연성 경고", () => {
  it("건폐율 100% 초과를 경고한다", () => {
    const report = auditFeasibility(
      withPatch(base, "zoning", { buildingCoverageRatio: 120 }),
    );
    expect(report.sanityFailures.map((c) => c.id)).toContain("sanity.bcr");
    // 경고이지 엔진 버그가 아니므로 항등식은 여전히 성립해야 한다
    expect(report.ok).toBe(true);
  });

  it("전용률 100% 초과를 경고한다", () => {
    const report = auditFeasibility(
      withPatch(base, "building", { exclusiveRatio: 130 }),
    );
    expect(report.sanityFailures.map((c) => c.id)).toContain(
      "sanity.exclusive",
    );
  });

  it("자기자본 0 을 경고한다", () => {
    const report = auditFeasibility(withPatch(base, "finance", { equity: 0 }));
    expect(report.sanityFailures.map((c) => c.id)).toContain("sanity.equity");
  });

  it("PF 비용계수가 1 이상이면 경고한다", () => {
    const report = auditFeasibility(
      withPatch(base, "finance", {
        pfRate: 60,
        pfAvgDrawRate: 100,
        pfMonths: 60,
      }),
    );
    expect(report.sanityFailures.map((c) => c.id)).toContain(
      "sanity.pfCoefficient",
    );
  });

  it("기준 시나리오에는 개연성 경고가 없다", () => {
    expect(auditFeasibility(base).sanityFailures).toEqual([]);
  });
});

describe("검산은 계산 결과를 재사용할 수 있다", () => {
  it("결과를 주입해도 같은 리포트를 만든다", () => {
    const result = computeFeasibility(base);
    const a = auditFeasibility(base, result);
    const b = auditFeasibility(base);
    expect(a.checks.map((c) => [c.id, c.passed])).toEqual(
      b.checks.map((c) => [c.id, c.passed]),
    );
  });
});
