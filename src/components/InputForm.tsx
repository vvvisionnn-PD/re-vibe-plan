"use client";

import { ZONE_LIMITS } from "@/lib/defaults";
import type { FeasibilityResult } from "@/lib/feasibility";
import { LAND_USE_ZONES, USE_TYPES } from "@/lib/types";
import type { ProjectInput } from "@/lib/types";
import { fmtM2, fmtPyeong } from "@/lib/units";

import { FieldGroup, NumberField, SelectField, TextField } from "./fields";

export type PatchFn = <S extends keyof ProjectInput>(
  section: S,
  patch: Partial<ProjectInput[S]>,
) => void;

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line/60 py-1 last:border-b-0">
      <span className="text-[11px] text-muted">{label}</span>
      <span className="tnum text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}

export function InputForm({
  input,
  patch,
  result,
}: {
  input: ProjectInput;
  patch: PatchFn;
  result: FeasibilityResult;
}) {
  const limits = ZONE_LIMITS[input.meta.landUseZone];
  const bcrOver = limits && input.zoning.buildingCoverageRatio > limits.bcr;
  const farOver = limits && input.zoning.floorAreaRatio > limits.far;

  return (
    <div className="flex flex-col gap-4">
      <FieldGroup title="1. 사업 개요">
        <TextField
          label="사업명"
          value={input.meta.projectName}
          onChange={(v) => patch("meta", { projectName: v })}
          placeholder="예: 화성 동탄 공동주택 개발사업"
        />
        <TextField
          label="사업대상지"
          value={input.meta.address}
          onChange={(v) => patch("meta", { address: v })}
          placeholder="예: 경기도 화성시 ○○동 123-4"
          hint="(2)단계에서 이 주소로 공공데이터 시장분석을 호출한다"
        />
        <TextField
          label="시행자"
          value={input.meta.developer}
          onChange={(v) => patch("meta", { developer: v })}
          placeholder="예: ○○개발㈜"
        />
        <SelectField
          label="사업유형"
          value={input.meta.useType}
          options={USE_TYPES}
          onChange={(v) => patch("meta", { useType: v })}
        />
        <SelectField
          label="용도지역"
          value={input.meta.landUseZone}
          options={LAND_USE_ZONES}
          onChange={(v) => patch("meta", { landUseZone: v })}
          hint={
            limits
              ? `법정 상한 — 건폐율 ${limits.bcr}% / 용적률 ${limits.far}%`
              : undefined
          }
        />
        <NumberField
          label="총 사업기간"
          value={input.meta.totalMonths}
          onChange={(v) => patch("meta", { totalMonths: v })}
          unit="개월"
          min={0}
          hint="토지 매입 ~ 정산 완료"
        />
        <NumberField
          label="공사기간"
          value={input.meta.constructionMonths}
          onChange={(v) => patch("meta", { constructionMonths: v })}
          unit="개월"
          min={0}
        />
      </FieldGroup>

      <FieldGroup title="2. 토지비">
        <NumberField
          label="대지면적"
          value={input.land.siteAreaM2}
          onChange={(v) => patch("land", { siteAreaM2: v })}
          unit="㎡"
          min={0}
          hint={fmtPyeong(input.land.siteAreaM2)}
        />
        <NumberField
          label="토지 매입단가"
          value={input.land.unitPricePerPyeong}
          onChange={(v) => patch("land", { unitPricePerPyeong: v })}
          unit="만원/평"
          min={0}
        />
        <NumberField
          label="취득세등"
          value={input.land.acquisitionTaxRate}
          onChange={(v) => patch("land", { acquisitionTaxRate: v })}
          unit="%"
          min={0}
          hint="토지 매입비 대비. 통상 4.6%"
        />
        <NumberField
          label="토지 부대비"
          value={input.land.incidentalRate}
          onChange={(v) => patch("land", { incidentalRate: v })}
          unit="%"
          min={0}
          hint="중개·법무·명도·측량 등"
        />
      </FieldGroup>

      <FieldGroup title="3. 건축 규모" columns={3}>
        <NumberField
          label="건폐율"
          value={input.zoning.buildingCoverageRatio}
          onChange={(v) => patch("zoning", { buildingCoverageRatio: v })}
          unit="%"
          min={0}
          hint={bcrOver ? `⚠ 법정 상한 ${limits.bcr}% 초과` : undefined}
        />
        <NumberField
          label="용적률"
          value={input.zoning.floorAreaRatio}
          onChange={(v) => patch("zoning", { floorAreaRatio: v })}
          unit="%"
          min={0}
          hint={farOver ? `⚠ 법정 상한 ${limits.far}% 초과` : undefined}
        />
        <NumberField
          label="지상 연면적 직접입력"
          value={input.building.aboveGroundAreaOverrideM2}
          onChange={(v) => patch("building", { aboveGroundAreaOverrideM2: v })}
          unit="㎡"
          min={0}
          hint="0 이면 대지면적 × 용적률로 자동 산정"
        />
        <NumberField
          label="지하 연면적"
          value={input.building.basementAreaM2}
          onChange={(v) => patch("building", { basementAreaM2: v })}
          unit="㎡"
          min={0}
          hint={fmtPyeong(input.building.basementAreaM2)}
        />
        <NumberField
          label="분양(계약)면적 비율"
          value={input.building.saleableAreaRatio}
          onChange={(v) => patch("building", { saleableAreaRatio: v })}
          unit="%"
          min={0}
          hint="지상 연면적 대비"
        />
        <NumberField
          label="전용률"
          value={input.building.exclusiveRatio}
          onChange={(v) => patch("building", { exclusiveRatio: v })}
          unit="%"
          min={0}
          hint="분양면적 대비 전용면적"
        />
        <NumberField
          label="지상 층수"
          value={input.building.floorsAbove}
          onChange={(v) => patch("building", { floorsAbove: v })}
          unit="층"
          min={0}
        />
        <NumberField
          label="지하 층수"
          value={input.building.floorsBelow}
          onChange={(v) => patch("building", { floorsBelow: v })}
          unit="층"
          min={0}
        />
        <NumberField
          label="주차대수"
          value={input.building.parkingCount}
          onChange={(v) => patch("building", { parkingCount: v })}
          unit="대"
          min={0}
        />

        <div className="sm:col-span-2 lg:col-span-3 mt-1 rounded-md bg-surface-alt px-3 py-2">
          <p className="mb-1 text-[11px] font-semibold text-muted">산출 면적</p>
          <div className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            <Readout
              label="건축면적"
              value={`${fmtM2(result.area.buildingAreaM2)} / ${fmtPyeong(result.area.buildingAreaM2)}`}
            />
            <Readout
              label="지상 연면적"
              value={`${fmtM2(result.area.aboveGroundAreaM2)} / ${fmtPyeong(result.area.aboveGroundAreaM2)}`}
            />
            <Readout
              label="총 연면적"
              value={`${fmtM2(result.area.totalFloorAreaM2)} / ${fmtPyeong(result.area.totalFloorAreaM2)}`}
            />
            <Readout
              label="분양(계약)면적"
              value={`${fmtM2(result.area.saleableAreaM2)} / ${fmtPyeong(result.area.saleableAreaM2)}`}
            />
            <Readout
              label="전용면적"
              value={`${fmtM2(result.area.exclusiveAreaM2)} / ${fmtPyeong(result.area.exclusiveAreaM2)}`}
            />
            <Readout
              label="실제 용적률"
              value={`${result.area.effectiveFar.toFixed(2)}%`}
            />
          </div>
        </div>
      </FieldGroup>

      <FieldGroup title="4. 분양수입" columns={3}>
        <NumberField
          label="분양단가"
          value={input.revenue.unitPricePerPyeong}
          onChange={(v) => patch("revenue", { unitPricePerPyeong: v })}
          unit="만원/평"
          min={0}
          hint="분양(계약)면적 기준"
        />
        <NumberField
          label="분양률"
          value={input.revenue.salesRate}
          onChange={(v) => patch("revenue", { salesRate: v })}
          unit="%"
          min={0}
        />
        <NumberField
          label="기타수입"
          value={input.revenue.otherRevenue}
          onChange={(v) => patch("revenue", { otherRevenue: v })}
          unit="만원"
          hint="상가 임대·광고 등"
        />
      </FieldGroup>

      <FieldGroup title="5. 공사비">
        <NumberField
          label="지상 공사단가"
          value={input.construction.unitCostAbovePerPyeong}
          onChange={(v) =>
            patch("construction", { unitCostAbovePerPyeong: v })
          }
          unit="만원/평"
          min={0}
        />
        <NumberField
          label="지하 공사단가"
          value={input.construction.unitCostBasementPerPyeong}
          onChange={(v) =>
            patch("construction", { unitCostBasementPerPyeong: v })
          }
          unit="만원/평"
          min={0}
        />
        <NumberField
          label="설계·감리비"
          value={input.construction.designSupervisionRate}
          onChange={(v) => patch("construction", { designSupervisionRate: v })}
          unit="%"
          min={0}
          hint="도급공사비 대비"
        />
        <NumberField
          label="철거·토목·인입 등"
          value={input.construction.demolitionAndOther}
          onChange={(v) => patch("construction", { demolitionAndOther: v })}
          unit="만원"
        />
      </FieldGroup>

      <FieldGroup title="6. 간접비" columns={3}>
        <NumberField
          label="분양대행 수수료"
          value={input.indirect.salesAgencyRate}
          onChange={(v) => patch("indirect", { salesAgencyRate: v })}
          unit="%"
          min={0}
          hint="분양수입 대비"
        />
        <NumberField
          label="광고·홍보비"
          value={input.indirect.advertisingRate}
          onChange={(v) => patch("indirect", { advertisingRate: v })}
          unit="%"
          min={0}
          hint="분양수입 대비"
        />
        <NumberField
          label="신탁 수수료"
          value={input.indirect.trustFeeRate}
          onChange={(v) => patch("indirect", { trustFeeRate: v })}
          unit="%"
          min={0}
          hint="분양수입 대비"
        />
        <NumberField
          label="PM·일반관리비"
          value={input.indirect.pmFeeRate}
          onChange={(v) => patch("indirect", { pmFeeRate: v })}
          unit="%"
          min={0}
          hint="도급공사비 대비"
        />
        <NumberField
          label="보존등기비"
          value={input.indirect.registrationRate}
          onChange={(v) => patch("indirect", { registrationRate: v })}
          unit="%"
          min={0}
          hint="도급공사비 대비"
        />
        <NumberField
          label="인허가·용역비 등"
          value={input.indirect.licensingAndOther}
          onChange={(v) => patch("indirect", { licensingAndOther: v })}
          unit="만원"
        />
        <NumberField
          label="예비비"
          value={input.indirect.contingencyRate}
          onChange={(v) => patch("indirect", { contingencyRate: v })}
          unit="%"
          min={0}
          hint="토지비 + 공사비 + 간접비 대비"
        />
      </FieldGroup>

      <FieldGroup title="7. 자금조달" columns={3}>
        <NumberField
          label="자기자본"
          value={input.finance.equity}
          onChange={(v) => patch("finance", { equity: v })}
          unit="만원"
          min={0}
        />
        <NumberField
          label="브릿지론 LTV"
          value={input.finance.bridgeLtv}
          onChange={(v) => patch("finance", { bridgeLtv: v })}
          unit="%"
          min={0}
          hint="토지비계 대비"
        />
        <NumberField
          label="브릿지 금리"
          value={input.finance.bridgeRate}
          onChange={(v) => patch("finance", { bridgeRate: v })}
          unit="%/년"
          min={0}
        />
        <NumberField
          label="브릿지 수수료"
          value={input.finance.bridgeFeeRate}
          onChange={(v) => patch("finance", { bridgeFeeRate: v })}
          unit="%"
          min={0}
        />
        <NumberField
          label="브릿지 기간"
          value={input.finance.bridgeMonths}
          onChange={(v) => patch("finance", { bridgeMonths: v })}
          unit="개월"
          min={0}
        />
        <NumberField
          label="본PF 금리"
          value={input.finance.pfRate}
          onChange={(v) => patch("finance", { pfRate: v })}
          unit="%/년"
          min={0}
        />
        <NumberField
          label="본PF 수수료"
          value={input.finance.pfFeeRate}
          onChange={(v) => patch("finance", { pfFeeRate: v })}
          unit="%"
          min={0}
        />
        <NumberField
          label="본PF 기간"
          value={input.finance.pfMonths}
          onChange={(v) => patch("finance", { pfMonths: v })}
          unit="개월"
          min={0}
        />
        <NumberField
          label="본PF 평균 인출률"
          value={input.finance.pfAvgDrawRate}
          onChange={(v) => patch("finance", { pfAvgDrawRate: v })}
          unit="%"
          min={0}
          max={100}
          hint="기간 중 평균 잔액 비중"
        />
        <NumberField
          label="기중 분양대금 회수율"
          value={input.finance.salesCollectionRate}
          onChange={(v) => patch("finance", { salesCollectionRate: v })}
          unit="%"
          min={0}
          max={100}
          hint="준공 전 유입되어 PF 소요를 줄이는 비중"
        />
      </FieldGroup>
    </div>
  );
}
