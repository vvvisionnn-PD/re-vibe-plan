/**
 * 입력값 저장소.
 *
 * localStorage 는 React 바깥의 외부 시스템이므로 `useSyncExternalStore` 로 읽는다.
 * (useEffect 안에서 setState 로 복원하면 하이드레이션 직후 연쇄 렌더가 발생한다)
 *
 * 저장은 브라우저별 편의 기능일 뿐이다. 차단·시크릿 모드에서 실패해도
 * 계산은 메모리에서 그대로 동작해야 한다.
 */

import { BASE_INPUT } from "./defaults";
import type { ProjectInput } from "./types";

const STORAGE_KEY = "rede-feasibility-input-v1";

/**
 * 저장된 입력을 현재 스키마에 병합한다.
 * 스키마에 필드가 추가되어도 예전 저장본이 그대로 열리도록 섹션별로 메운다.
 */
export function mergeWithBase(raw: unknown): ProjectInput {
  if (typeof raw !== "object" || raw === null) return BASE_INPUT;
  const saved = raw as Partial<ProjectInput>;
  return {
    meta: { ...BASE_INPUT.meta, ...saved.meta },
    land: { ...BASE_INPUT.land, ...saved.land },
    zoning: { ...BASE_INPUT.zoning, ...saved.zoning },
    building: { ...BASE_INPUT.building, ...saved.building },
    revenue: { ...BASE_INPUT.revenue, ...saved.revenue },
    construction: { ...BASE_INPUT.construction, ...saved.construction },
    indirect: { ...BASE_INPUT.indirect, ...saved.indirect },
    finance: { ...BASE_INPUT.finance, ...saved.finance },
  };
}

let snapshot: ProjectInput = BASE_INPUT;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): ProjectInput {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? mergeWithBase(JSON.parse(raw)) : BASE_INPUT;
  } catch {
    return BASE_INPUT;
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 클라이언트 스냅샷. 같은 상태에서는 반드시 같은 참조를 돌려준다. */
export function getSnapshot(): ProjectInput {
  if (!hydrated) {
    snapshot = readStorage();
    hydrated = true;
  }
  return snapshot;
}

/** 서버 렌더 및 하이드레이션 시점 스냅샷. */
export function getServerSnapshot(): ProjectInput {
  return BASE_INPUT;
}

export function setProjectInput(
  next: ProjectInput | ((prev: ProjectInput) => ProjectInput),
): void {
  const value = typeof next === "function" ? next(getSnapshot()) : next;
  snapshot = value;
  hydrated = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // 저장 실패는 조용히 무시한다 — 메모리 상태는 이미 갱신되었다
  }
  for (const listener of listeners) listener();
}

/** 테스트용. 모듈 수준 캐시를 초기화한다. */
export function resetProjectStore(): void {
  snapshot = BASE_INPUT;
  hydrated = false;
  listeners.clear();
}
