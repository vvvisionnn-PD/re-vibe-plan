"use client";

import {
  breakEvenConstructionCost,
  breakEvenSalesRate,
  breakEvenUnitPrice,
  costComposition,
} from "@/lib/analysis";
import type { FeasibilityResult } from "@/lib/feasibility";
import type { ProjectInput } from "@/lib/types";
import {
  fmtEok,
  fmtM2,
  fmtManwon,
  fmtPyeong,
  fmtRatio,
  m2ToPyeong,
} from "@/lib/units";

import { Badge, Card, Table, Td, Th, TotalRow } from "./ui";

interface Line {
  label: string;
  basis: string;
  amount: number;
  level?: "item" | "subtotal" | "total";
}

function shareOf(amount: number, total: number): string {
  return total > 0 ? fmtRatio(amount / total, 1) : "-";
}

function CostRows({ lines, total }: { lines: Line[]; total: number }) {
  return (
    <>
      {lines.map((line) => {
        const emphasis = line.level === "subtotal" || line.level === "total";
        const cells = (
          <>
            <Td
              align="left"
              emphasis={emphasis}
              className={emphasis ? "" : "pl-5"}
            >
              {line.label}
            </Td>
            <Td align="left" className="text-[11px] text-muted">
              {line.basis}
            </Td>
            <Td emphasis={emphasis}>{fmtManwon(line.amount, 0)}</Td>
            <Td emphasis={emphasis}>{fmtEok(line.amount, 2)}</Td>
            <Td emphasis={emphasis}>{shareOf(line.amount, total)}</Td>
          </>
        );
        return emphasis ? (
          <TotalRow key={line.label}>{cells}</TotalRow>
        ) : (
          <tr key={line.label}>{cells}</tr>
        );
      })}
    </>
  );
}

function InfoTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid gap-x-8 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5"
        >
          <span className="text-xs text-muted">{label}</span>
          <span className="tnum text-sm font-medium text-foreground text-right">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ReportView({
  input,
  result,
}: {
  input: ProjectInput;
  result: FeasibilityResult;
}) {
  const { area, revenue, cost, profit, funding } = result;
  const total = cost.total;
  const composition = costComposition(result);

  const bepRate = breakEvenSalesRate(input);
  const bepPrice = breakEvenUnitPrice(input);
  const bepCost = breakEvenConstructionCost(input);

  const saleablePyeong = m2ToPyeong(area.saleableAreaM2);
  const abovePyeong = m2ToPyeong(area.aboveGroundAreaM2);
  const basementPyeong = m2ToPyeong(area.basementAreaM2);
  const sitePyeong = m2ToPyeong(area.siteAreaM2);

  const costLines: Line[] = [
    {
      label: "토지 매입비",
      basis: `${fmtManwon(sitePyeong, 1)}평 × ${fmtManwon(input.land.unitPricePerPyeong)}만원/평`,
      amount: cost.land.purchase,
    },
    {
      label: "취득세등",
      basis: `토지 매입비 × ${input.land.acquisitionTaxRate}%`,
      amount: cost.land.acquisitionTax,
    },
    {
      label: "토지 부대비",
      basis: `토지 매입비 × ${input.land.incidentalRate}%`,
      amount: cost.land.incidental,
    },
    { label: "토지비 계", basis: "", amount: cost.land.subtotal, level: "subtotal" },

    {
      label: "지상 공사비",
      basis: `${fmtManwon(abovePyeong, 1)}평 × ${fmtManwon(input.construction.unitCostAbovePerPyeong)}만원/평`,
      amount: cost.construction.above,
    },
    {
      label: "지하 공사비",
      basis: `${fmtManwon(basementPyeong, 1)}평 × ${fmtManwon(input.construction.unitCostBasementPerPyeong)}만원/평`,
      amount: cost.construction.basement,
    },
    {
      label: "설계·감리비",
      basis: `도급공사비 × ${input.construction.designSupervisionRate}%`,
      amount: cost.construction.designSupervision,
    },
    {
      label: "철거·토목·인입 등",
      basis: "직접 입력",
      amount: cost.construction.demolitionAndOther,
    },
    {
      label: "공사비 계",
      basis: "",
      amount: cost.construction.subtotal,
      level: "subtotal",
    },

    {
      label: "분양대행 수수료",
      basis: `분양수입 × ${input.indirect.salesAgencyRate}%`,
      amount: cost.indirect.salesAgency,
    },
    {
      label: "광고·홍보비",
      basis: `분양수입 × ${input.indirect.advertisingRate}%`,
      amount: cost.indirect.advertising,
    },
    {
      label: "신탁 수수료",
      basis: `분양수입 × ${input.indirect.trustFeeRate}%`,
      amount: cost.indirect.trustFee,
    },
    {
      label: "PM·일반관리비",
      basis: `도급공사비 × ${input.indirect.pmFeeRate}%`,
      amount: cost.indirect.pmFee,
    },
    {
      label: "보존등기비",
      basis: `도급공사비 × ${input.indirect.registrationRate}%`,
      amount: cost.indirect.registration,
    },
    {
      label: "인허가·용역비 등",
      basis: "직접 입력",
      amount: cost.indirect.licensingAndOther,
    },
    {
      label: "예비비",
      basis: `${fmtEok(cost.indirect.contingencyBase, 1)} × ${input.indirect.contingencyRate}%`,
      amount: cost.indirect.contingency,
    },
    {
      label: "간접비 계",
      basis: "",
      amount: cost.indirect.subtotal,
      level: "subtotal",
    },

    {
      label: "브릿지론 이자",
      basis: `${fmtEok(cost.finance.bridgePrincipal, 1)} × ${input.finance.bridgeRate}% × ${input.finance.bridgeMonths}개월`,
      amount: cost.finance.bridgeInterest,
    },
    {
      label: "브릿지론 수수료",
      basis: `원금 × ${input.finance.bridgeFeeRate}%`,
      amount: cost.finance.bridgeFee,
    },
    {
      label: "본PF 이자",
      basis: `${fmtEok(cost.finance.pfPrincipal, 1)} × ${input.finance.pfRate}% × ${input.finance.pfMonths}개월 × 인출률 ${input.finance.pfAvgDrawRate}%`,
      amount: cost.finance.pfInterest,
    },
    {
      label: "본PF 수수료",
      basis: `원금 × ${input.finance.pfFeeRate}%`,
      amount: cost.finance.pfFee,
    },
    {
      label: "금융비 계",
      basis: "",
      amount: cost.finance.subtotal,
      level: "subtotal",
    },

    { label: "총 사업비", basis: "", amount: total, level: "total" },
  ];

  const today = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-lg border border-line bg-surface px-5 py-4 print-block">
        <p className="text-[11px] uppercase tracking-widest text-muted">
          부동산 개발사업 사업계획서
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">
          {input.meta.projectName || "(사업명 미입력)"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {input.meta.address || "(사업대상지 미입력)"} · {input.meta.useType} ·{" "}
          {input.meta.landUseZone}
        </p>
        <p className="mt-2 text-[11px] text-muted">
          {input.meta.developer ? `시행 ${input.meta.developer} · ` : ""}
          작성일 {today}
        </p>
      </header>

      <Card title="Ⅰ. 사업 개요">
        <InfoTable
          rows={[
            ["사업명", input.meta.projectName || "-"],
            ["사업대상지", input.meta.address || "-"],
            ["시행자", input.meta.developer || "-"],
            ["사업유형", input.meta.useType],
            ["용도지역", input.meta.landUseZone],
            ["총 사업기간", `${input.meta.totalMonths}개월`],
            ["공사기간", `${input.meta.constructionMonths}개월`],
            ["대지면적", `${fmtM2(area.siteAreaM2)} (${fmtPyeong(area.siteAreaM2)})`],
          ]}
        />
      </Card>

      <Card title="Ⅱ. 건축 개요">
        <InfoTable
          rows={[
            ["건폐율 (적용)", `${area.effectiveBcr.toFixed(2)}%`],
            ["용적률 (적용)", `${area.effectiveFar.toFixed(2)}%`],
            ["건축면적", `${fmtM2(area.buildingAreaM2)} (${fmtPyeong(area.buildingAreaM2)})`],
            ["지상 연면적", `${fmtM2(area.aboveGroundAreaM2)} (${fmtPyeong(area.aboveGroundAreaM2)})`],
            ["지하 연면적", `${fmtM2(area.basementAreaM2)} (${fmtPyeong(area.basementAreaM2)})`],
            ["총 연면적", `${fmtM2(area.totalFloorAreaM2)} (${fmtPyeong(area.totalFloorAreaM2)})`],
            ["분양(계약)면적", `${fmtM2(area.saleableAreaM2)} (${fmtPyeong(area.saleableAreaM2)})`],
            ["전용면적", `${fmtM2(area.exclusiveAreaM2)} (${fmtPyeong(area.exclusiveAreaM2)})`],
            ["규모", `지상 ${input.building.floorsAbove}층 / 지하 ${input.building.floorsBelow}층`],
            ["주차대수", `${fmtManwon(input.building.parkingCount)}대`],
          ]}
        />
      </Card>

      <Card
        title="Ⅲ. 사업수지 분석"
        subtitle="단위: 만원 · 비중은 총사업비 대비"
        className="print-page-break"
      >
        <Table
          head={
            <tr>
              <Th align="left">구분</Th>
              <Th align="left">산출근거</Th>
              <Th>금액(만원)</Th>
              <Th>억원</Th>
              <Th>비중</Th>
            </tr>
          }
        >
          <TotalRow>
            <Td align="left" emphasis>
              매출액
            </Td>
            <Td align="left" className="text-[11px] text-muted">
              분양수입 + 기타수입
            </Td>
            <Td emphasis>{fmtManwon(revenue.total, 0)}</Td>
            <Td emphasis>{fmtEok(revenue.total, 2)}</Td>
            <Td emphasis>{shareOf(revenue.total, total)}</Td>
          </TotalRow>
          <tr>
            <Td align="left" className="pl-5">
              분양수입
            </Td>
            <Td align="left" className="text-[11px] text-muted">
              {`${fmtManwon(saleablePyeong, 1)}평 × ${fmtManwon(input.revenue.unitPricePerPyeong)}만원/평 × 분양률 ${input.revenue.salesRate}%`}
            </Td>
            <Td>{fmtManwon(revenue.sales, 0)}</Td>
            <Td>{fmtEok(revenue.sales, 2)}</Td>
            <Td>{shareOf(revenue.sales, total)}</Td>
          </tr>
          <tr>
            <Td align="left" className="pl-5">
              기타수입
            </Td>
            <Td align="left" className="text-[11px] text-muted">
              직접 입력
            </Td>
            <Td>{fmtManwon(revenue.other, 0)}</Td>
            <Td>{fmtEok(revenue.other, 2)}</Td>
            <Td>{shareOf(revenue.other, total)}</Td>
          </tr>

          <CostRows lines={costLines} total={total} />

          <TotalRow>
            <Td align="left" emphasis>
              사업이익
            </Td>
            <Td align="left" className="text-[11px] text-muted">
              매출액 − 총사업비
            </Td>
            <Td
              emphasis
              className={profit.profit >= 0 ? "text-positive" : "text-negative"}
            >
              {fmtManwon(profit.profit, 0)}
            </Td>
            <Td
              emphasis
              className={profit.profit >= 0 ? "text-positive" : "text-negative"}
            >
              {fmtEok(profit.profit, 2)}
            </Td>
            <Td emphasis>{fmtRatio(profit.marginOnRevenue, 1)}</Td>
          </TotalRow>
        </Table>
      </Card>

      <Card title="Ⅳ. 사업비 구성">
        <div className="flex flex-col gap-2">
          {composition.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs text-muted">
                {item.label}
              </span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-surface-alt">
                <div
                  className="h-full rounded bg-accent"
                  style={{ width: `${Math.min(100, item.share * 100)}%` }}
                />
              </div>
              <span className="tnum w-24 shrink-0 text-right text-xs text-foreground">
                {fmtEok(item.amount, 1)}
              </span>
              <span className="tnum w-14 shrink-0 text-right text-xs text-muted">
                {fmtRatio(item.share, 1)}
              </span>
            </div>
          ))}
          <p className="mt-2 text-[11px] text-muted">
            총 연면적 평당 사업비 {fmtManwon(cost.perPyeong, 1)}만원/평
          </p>
        </div>
      </Card>

      <Card title="Ⅴ. 자금조달 계획" subtitle="단위: 만원">
        <Table
          head={
            <tr>
              <Th align="left">구분</Th>
              <Th>금액(만원)</Th>
              <Th>억원</Th>
              <Th>비중</Th>
            </tr>
          }
        >
          <tr>
            <Td align="left">자기자본</Td>
            <Td>{fmtManwon(funding.equity, 0)}</Td>
            <Td>{fmtEok(funding.equity, 2)}</Td>
            <Td>{shareOf(funding.equity, funding.totalSource)}</Td>
          </tr>
          <tr>
            <Td align="left">본PF 대출</Td>
            <Td>{fmtManwon(funding.pf, 0)}</Td>
            <Td>{fmtEok(funding.pf, 2)}</Td>
            <Td>{shareOf(funding.pf, funding.totalSource)}</Td>
          </tr>
          <tr>
            <Td align="left">기중 분양대금 회수</Td>
            <Td>{fmtManwon(funding.salesCollected, 0)}</Td>
            <Td>{fmtEok(funding.salesCollected, 2)}</Td>
            <Td>{shareOf(funding.salesCollected, funding.totalSource)}</Td>
          </tr>
          <TotalRow>
            <Td align="left" emphasis>
              조달 합계
            </Td>
            <Td emphasis>{fmtManwon(funding.totalSource, 0)}</Td>
            <Td emphasis>{fmtEok(funding.totalSource, 2)}</Td>
            <Td emphasis>100.0%</Td>
          </TotalRow>
          <tr>
            <Td align="left">자금 소요 (총사업비)</Td>
            <Td>{fmtManwon(funding.totalUse, 0)}</Td>
            <Td>{fmtEok(funding.totalUse, 2)}</Td>
            <Td>-</Td>
          </tr>
          <tr>
            <Td align="left">
              브릿지론 원금{" "}
              <span className="text-[11px] text-muted">
                (본PF로 상환 — 순계 제외)
              </span>
            </Td>
            <Td>{fmtManwon(funding.bridge, 0)}</Td>
            <Td>{fmtEok(funding.bridge, 2)}</Td>
            <Td>-</Td>
          </tr>
        </Table>
      </Card>

      <Card title="Ⅵ. 수익성 및 손익분기점">
        <InfoTable
          rows={[
            ["사업이익", fmtEok(profit.profit, 2)],
            ["매출액 대비 이익률", fmtRatio(profit.marginOnRevenue)],
            ["총사업비 대비 이익률", fmtRatio(profit.marginOnCost)],
            ["자기자본 수익률 (ROE)", fmtRatio(profit.roe)],
            ["연환산 ROE", fmtRatio(profit.annualizedRoe)],
            [
              "BEP 분양률",
              bepRate.value === null
                ? "해 없음 (어떤 분양률에서도 흑자 전환 불가)"
                : `${bepRate.value.toFixed(2)}%`,
            ],
            [
              "BEP 분양단가",
              bepPrice.value === null
                ? "해 없음"
                : `${fmtManwon(bepPrice.value, 1)}만원/평`,
            ],
            [
              "BEP 지상 공사단가",
              bepCost.value === null
                ? "해 없음"
                : `${fmtManwon(bepCost.value, 1)}만원/평`,
            ],
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {bepRate.value !== null ? (
            <Badge tone={bepRate.value <= 80 ? "positive" : "warning"}>
              분양률 {bepRate.value.toFixed(1)}% 달성 시 손익분기
            </Badge>
          ) : null}
          <Badge tone={profit.marginOnCost >= 0.1 ? "positive" : "warning"}>
            총사업비 대비 이익률 {fmtRatio(profit.marginOnCost, 1)}
          </Badge>
          {cost.finance.diverged ? (
            <Badge tone="negative">
              본PF 비용계수 ≥ 1 — 금융조건 재확인 필요
            </Badge>
          ) : null}
        </div>
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-muted">
        본 사업계획서는 입력값에 근거한 개략 검토 자료이며, 실제 인허가 조건 ·
        시공 견적 · 금융 조건에 따라 결과가 달라질 수 있다. 분양가와 공사비는
        시장 조사 및 견적으로 반드시 검증할 것.
      </p>
    </div>
  );
}
