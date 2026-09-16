"use client";

import { useMemo } from "react";

import { breakEvenSalesRate } from "@/lib/analysis";
import type { FeasibilityResult } from "@/lib/feasibility";
import type { ProjectInput } from "@/lib/types";
import { fmtEok, fmtRatio } from "@/lib/units";

function Kpi({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  const valueTone =
    tone === "positive"
      ? "text-positive"
      : tone === "negative"
        ? "text-negative"
        : "text-foreground";
  return (
    <div className="min-w-0 flex-1 px-3 py-2">
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p className={`tnum mt-0.5 truncate text-base font-semibold ${valueTone}`}>
        {value}
      </p>
      {sub ? (
        <p className="tnum truncate text-[11px] text-muted">{sub}</p>
      ) : null}
    </div>
  );
}

export function KpiBar({
  input,
  result,
}: {
  input: ProjectInput;
  result: FeasibilityResult;
}) {
  const bep = useMemo(() => breakEvenSalesRate(input), [input]);
  const positive = result.profit.profit >= 0;

  return (
    <div className="grid grid-cols-2 divide-x divide-y divide-line rounded-lg border border-line bg-surface sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
      <Kpi label="총 매출액" value={fmtEok(result.revenue.total, 1)} />
      <Kpi label="총 사업비" value={fmtEok(result.cost.total, 1)} />
      <Kpi
        label="사업이익"
        value={fmtEok(result.profit.profit, 1)}
        tone={positive ? "positive" : "negative"}
      />
      <Kpi
        label="매출액 대비 이익률"
        value={fmtRatio(result.profit.marginOnRevenue, 1)}
        sub={`사업비 대비 ${fmtRatio(result.profit.marginOnCost, 1)}`}
        tone={positive ? "positive" : "negative"}
      />
      <Kpi
        label="자기자본 수익률"
        value={fmtRatio(result.profit.roe, 1)}
        sub={`연환산 ${fmtRatio(result.profit.annualizedRoe, 1)}`}
      />
      <Kpi
        label="BEP 분양률"
        value={bep.value === null ? "해 없음" : `${bep.value.toFixed(1)}%`}
        sub={`현재 분양률 ${input.revenue.salesRate}%`}
      />
    </div>
  );
}
