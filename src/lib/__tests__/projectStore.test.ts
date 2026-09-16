import { beforeEach, describe, expect, it, vi } from "vitest";

import { BASE_INPUT } from "../defaults";
import {
  getServerSnapshot,
  getSnapshot,
  mergeWithBase,
  resetProjectStore,
  setProjectInput,
  subscribe,
} from "../projectStore";

beforeEach(() => {
  window.localStorage.clear();
  resetProjectStore();
});

describe("mergeWithBase", () => {
  it("저장본에 없는 섹션은 기본값으로 채운다", () => {
    const merged = mergeWithBase({ revenue: { salesRate: 70 } });
    expect(merged.revenue.salesRate).toBe(70);
    expect(merged.revenue.unitPricePerPyeong).toBe(
      BASE_INPUT.revenue.unitPricePerPyeong,
    );
    expect(merged.land).toEqual(BASE_INPUT.land);
  });

  it("객체가 아니면 기본값을 돌려준다", () => {
    expect(mergeWithBase(null)).toEqual(BASE_INPUT);
    expect(mergeWithBase("x")).toEqual(BASE_INPUT);
    expect(mergeWithBase(42)).toEqual(BASE_INPUT);
  });
});

describe("스냅샷", () => {
  it("서버 스냅샷은 항상 기본 입력이다", () => {
    expect(getServerSnapshot()).toBe(BASE_INPUT);
  });

  it("상태가 바뀌지 않으면 같은 참조를 돌려준다", () => {
    expect(getSnapshot()).toBe(getSnapshot());
  });

  it("저장된 값이 있으면 복원한다", () => {
    window.localStorage.setItem(
      "rede-feasibility-input-v1",
      JSON.stringify({ meta: { projectName: "복원된 사업" } }),
    );
    expect(getSnapshot().meta.projectName).toBe("복원된 사업");
  });

  it("깨진 JSON 이 저장되어 있으면 기본값으로 시작한다", () => {
    window.localStorage.setItem("rede-feasibility-input-v1", "{{{");
    expect(getSnapshot()).toEqual(BASE_INPUT);
  });
});

describe("갱신", () => {
  it("갱신 후 스냅샷과 localStorage 가 함께 바뀐다", () => {
    setProjectInput({
      ...BASE_INPUT,
      meta: { ...BASE_INPUT.meta, projectName: "테스트 사업" },
    });
    expect(getSnapshot().meta.projectName).toBe("테스트 사업");
    const saved = window.localStorage.getItem("rede-feasibility-input-v1");
    expect(JSON.parse(saved!).meta.projectName).toBe("테스트 사업");
  });

  it("함수형 갱신은 직전 스냅샷을 받는다", () => {
    setProjectInput((prev) => ({
      ...prev,
      revenue: { ...prev.revenue, salesRate: 55 },
    }));
    expect(getSnapshot().revenue.salesRate).toBe(55);
  });

  it("구독자에게 변경을 알린다", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    setProjectInput(BASE_INPUT);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setProjectInput(BASE_INPUT);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("저장이 실패해도 메모리 상태는 갱신된다", () => {
    const spy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    expect(() =>
      setProjectInput((prev) => ({
        ...prev,
        revenue: { ...prev.revenue, salesRate: 33 },
      })),
    ).not.toThrow();
    expect(getSnapshot().revenue.salesRate).toBe(33);
    spy.mockRestore();
  });
});
