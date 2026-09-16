import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetProjectStore } from "@/lib/projectStore";

import { Workbench } from "../Workbench";

beforeEach(() => {
  window.localStorage.clear();
  resetProjectStore();
});

afterEach(cleanup);

/** KPI 카드의 값(라벨 바로 아래 문단)을 읽는다. */
function kpiValue(label: string): string {
  const labelNode = screen.getByText(label);
  return labelNode.nextElementSibling?.textContent ?? "";
}

/** "12.34억원" → 12.34 */
function parseEok(text: string): number {
  return Number(text.replace(/[^0-9.-]/g, ""));
}

describe("Workbench 기본 렌더", () => {
  it("핵심 지표를 모두 표시한다", () => {
    render(<Workbench />);
    for (const label of [
      "총 매출액",
      "총 사업비",
      "사업이익",
      "매출액 대비 이익률",
      "자기자본 수익률",
      "BEP 분양률",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("입력 탭이 기본으로 열려 있다", () => {
    render(<Workbench />);
    expect(screen.getByText("1. 사업 개요")).toBeInTheDocument();
    expect(screen.getByLabelText("대지면적")).toBeInTheDocument();
  });

  it("기준 시나리오에서 검산 경고 배너가 뜨지 않는다", () => {
    render(<Workbench />);
    expect(screen.queryByText(/검산 항등식/)).not.toBeInTheDocument();
  });
});

describe("탭 이동", () => {
  it("사업계획서 탭에서 수지분석표를 보여준다", () => {
    render(<Workbench />);
    fireEvent.click(screen.getByRole("button", { name: "사업계획서" }));
    expect(screen.getByText("Ⅲ. 사업수지 분석")).toBeInTheDocument();
    expect(screen.getByText("Ⅴ. 자금조달 계획")).toBeInTheDocument();
  });

  it("민감도 탭에서 2변량 매트릭스를 보여준다", () => {
    render(<Workbench />);
    fireEvent.click(screen.getByRole("button", { name: "민감도" }));
    expect(screen.getByText("분양가 × 공사비 민감도")).toBeInTheDocument();
  });

  it("검산 탭에서 항등식 통과를 알린다", () => {
    render(<Workbench />);
    fireEvent.click(screen.getByRole("button", { name: /검산/ }));
    expect(screen.getByText(/항등식 \d+건 전부 통과/)).toBeInTheDocument();
  });
});

describe("입력이 결과에 반영된다", () => {
  it("분양단가를 올리면 매출과 사업이익이 커진다", () => {
    render(<Workbench />);
    const before = {
      revenue: parseEok(kpiValue("총 매출액")),
      profit: parseEok(kpiValue("사업이익")),
    };

    const field = screen.getByLabelText("분양단가");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "3500" } });
    fireEvent.blur(field);

    expect(parseEok(kpiValue("총 매출액"))).toBeGreaterThan(before.revenue);
    expect(parseEok(kpiValue("사업이익"))).toBeGreaterThan(before.profit);
  });

  it("공사단가를 올리면 사업이익이 줄어든다", () => {
    render(<Workbench />);
    const before = parseEok(kpiValue("사업이익"));

    const field = screen.getByLabelText("지상 공사단가");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "1200" } });
    fireEvent.blur(field);

    expect(parseEok(kpiValue("사업이익"))).toBeLessThan(before);
  });

  it("천단위 구분기호가 들어간 입력도 받아들인다", () => {
    render(<Workbench />);
    const field = screen.getByLabelText("대지면적") as HTMLInputElement;
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "12,000" } });
    fireEvent.blur(field);
    expect(field.value).toBe("12,000");
  });

  it("입력을 비우면 0 으로 처리하고 NaN 을 만들지 않는다", () => {
    render(<Workbench />);
    const field = screen.getByLabelText("분양단가");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    expect(kpiValue("총 매출액")).not.toContain("NaN");
    expect(parseEok(kpiValue("총 매출액"))).toBe(0);
  });

  it("면적을 바꾸면 산출 면적 요약이 함께 갱신된다", () => {
    render(<Workbench />);
    const field = screen.getByLabelText("대지면적");
    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: "10000" } });
    fireEvent.blur(field);

    const summary = screen.getByText("산출 면적").parentElement!;
    const readout = (label: string) =>
      within(summary).getByText(label).nextElementSibling?.textContent ?? "";

    // 대지 10,000㎡ · 건폐율 50% · 용적률 250%
    expect(readout("건축면적")).toBe("5,000.00㎡ / 1,512.50평");
    expect(readout("지상 연면적")).toBe("25,000.00㎡ / 7,562.50평");
    expect(readout("실제 용적률")).toBe("250.00%");
  });
});

describe("프리셋", () => {
  it("프리셋을 바꿔도 직접 입력한 사업명은 유지된다", () => {
    render(<Workbench />);
    const nameField = screen.getByLabelText("사업명");
    fireEvent.change(nameField, { target: { value: "동탄 물류 프로젝트" } });

    fireEvent.change(screen.getByLabelText("사업유형 프리셋"), {
      target: { value: "물류센터" },
    });

    expect((screen.getByLabelText("사업명") as HTMLInputElement).value).toBe(
      "동탄 물류 프로젝트",
    );
    expect((screen.getByLabelText("용도지역") as HTMLSelectElement).value).toBe(
      "계획관리지역",
    );
  });
});

describe("입력 저장", () => {
  it("입력이 localStorage 에 저장된다", () => {
    render(<Workbench />);
    fireEvent.change(screen.getByLabelText("사업명"), {
      target: { value: "저장 확인용 사업" },
    });
    const saved = window.localStorage.getItem("rede-feasibility-input-v1");
    expect(saved).not.toBeNull();
    expect(JSON.parse(saved!).meta.projectName).toBe("저장 확인용 사업");
  });
});
