"use client";

import { useMemo } from "react";

import {
  DEFAULT_DELTAS,
  breakEvenSalesRate,
  sensitivityMatrix,
  withPatch,
} from "@/lib/analysis";
import { computeFeasibility } from "@/lib/feasibility";
import type { ProjectInput } from "@/lib/types";
import { fmtEok, fmtRatio } from "@/lib/units";

import { Card, Table, Td, Th } from "./ui";

function toneFor(margin: number): string {
  if (margin >= 0.15) return "bg-positive/15 text-positive";
  if (margin >= 0.05) return "bg-positive/10";
  if (margin >= 0) return "bg-warning/12 text-warning";
  return "bg-negative/12 text-negative";
}

export function SensitivityView({ input }: { input: ProjectInput }) {
  const matrix = useMemo(() => sensitivityMatrix(input), [input]);

  const salesRateScan = useMemo(() => {
    const rates = [50, 60, 70, 80, 90, 100];
    const bep = breakEvenSalesRate(input).value;
    return {
      bep,
      rows: rates.map((rate) => {
        const r = computeFeasibility(
          withPatch(input, "revenue", { salesRate: rate }),
        );
        return {
          rate,
          revenue: r.revenue.total,
          cost: r.cost.total,
          profit: r.profit.profit,
          margin: r.profit.marginOnRevenue,
          roe: r.profit.roe,
        };
      }),
    };
  }, [input]);

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="분양가 × 공사비 민감도"
        subtitle="셀 값: 사업이익(억원) / 매출액 대비 이익률"
      >
        <Table
          head={
            <tr>
              <Th align="left">분양가 \ 공사비</Th>
              {matrix.costDeltas.map((d) => (
                <Th key={d}>{d > 0 ? `+${d}%` : `${d}%`}</Th>
              ))}
            </tr>
          }
        >
          {matrix.rows.map((row, i) => (
            <tr key={matrix.priceDeltas[i]}>
              <Td align="left" emphasis>
                {matrix.priceDeltas[i] > 0
                  ? `+${matrix.priceDeltas[i]}%`
                  : `${matrix.priceDeltas[i]}%`}
              </Td>
              {row.map((cell) => (
                <Td
                  key={cell.costDelta}
                  className={`${toneFor(cell.margin)} ${
                    cell.priceDelta === 0 && cell.costDelta === 0
                      ? "ring-1 ring-inset ring-accent"
                      : ""
                  }`}
                >
                  <span className="block text-xs font-medium">
                    {fmtEok(cell.profit, 1)}
                  </span>
                  <span className="block text-[11px] opacity-80">
                    {fmtRatio(cell.margin, 1)}
                  </span>
                </Td>
              ))}
            </tr>
          ))}
        </Table>
        <p className="mt-3 text-[11px] text-muted">
          공사비 변동은 지상·지하 단가에 동일 비율로 적용한다. 테두리 표시 셀이
          기준 시나리오다. 변동폭 기본값 {DEFAULT_DELTAS.join("% / ")}%.
        </p>
      </Card>

      <Card
        title="분양률 시나리오"
        subtitle={
          salesRateScan.bep === null
            ? "손익분기 분양률을 구할 수 없다"
            : `손익분기 분양률 ${salesRateScan.bep.toFixed(2)}%`
        }
      >
        <Table
          head={
            <tr>
              <Th align="left">분양률</Th>
              <Th>매출액</Th>
              <Th>총사업비</Th>
              <Th>사업이익</Th>
              <Th>매출이익률</Th>
              <Th>ROE</Th>
            </tr>
          }
        >
          {salesRateScan.rows.map((row) => (
            <tr key={row.rate}>
              <Td align="left" emphasis>
                {row.rate}%
              </Td>
              <Td>{fmtEok(row.revenue, 1)}</Td>
              <Td>{fmtEok(row.cost, 1)}</Td>
              <Td
                className={row.profit >= 0 ? "text-positive" : "text-negative"}
              >
                {fmtEok(row.profit, 1)}
              </Td>
              <Td>{fmtRatio(row.margin, 1)}</Td>
              <Td>{fmtRatio(row.roe, 1)}</Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
