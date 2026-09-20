import { emptyHousingType, type HousingType, type Num, type PlanInput } from "./calc.ts";

/**
 * 입력값을 링크에 담아 공유한다.
 *
 * - 주소의 **# 뒤(해시)** 에 넣는다. 해시는 서버로 전송되지 않으므로 사업 수치가 서버 · 접속 기록에 남지 않는다.
 * - 저장소에는 사업장 값을 넣지 않는다 (임시 값은 lib/presets.ts, 실제 사업장 값은 링크로만 주고받는다).
 * - 링크를 가진 사람은 누구나 그 수치를 볼 수 있다.
 */

/** 링크에서 입력값을 담는 자리 (예: https://…/#plan=abc…) */
export const SHARE_KEY = "plan";

/** 글자열 → base64url (한글 포함 UTF-8 처리) */
function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url → 글자열. 형식이 깨졌으면 null */
function fromBase64Url(encoded: string): string | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/** 입력값을 링크에 넣을 글자열로 바꾼다 */
export function encodePlan(input: PlanInput): string {
  return toBase64Url(JSON.stringify(input));
}

/** 숫자 칸 값인지 (숫자 또는 빈 칸) */
function isNum(v: unknown): v is Num {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}

/** 주택형 행을 확인한다. 모양이 다르면 null */
function readHousingType(v: unknown, id: string): HousingType | null {
  if (typeof v !== "object" || v === null) return null;
  const r = v as Record<string, unknown>;
  if (typeof r.name !== "string" || !isNum(r.exclusiveM2) || !isNum(r.supplyPyeong) || !isNum(r.units)) return null;
  return { ...emptyHousingType(typeof r.id === "string" && r.id !== "" ? r.id : id), name: r.name, exclusiveM2: r.exclusiveM2, supplyPyeong: r.supplyPyeong, units: r.units };
}

/**
 * 링크의 글자열을 입력값으로 되돌린다.
 * 모양이 조금이라도 다르면 null을 돌려준다 (잘못된 링크로 화면이 깨지지 않게).
 */
export function decodePlan(encoded: string): PlanInput | null {
  const text = fromBase64Url(encoded);
  if (text === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (typeof p.projectName !== "string" || typeof p.sido !== "string" || typeof p.sigungu !== "string") return null;
  if (!Array.isArray(p.housingTypes)) return null;

  const housingTypes: HousingType[] = [];
  for (const [i, row] of p.housingTypes.entries()) {
    const h = readHousingType(row, `link-${i}`);
    if (h === null) return null;
    housingTypes.push(h);
  }
  const numbers: Record<string, Num> = {};
  for (const key of ["pricePerPyeong", "retail", "otherInflow", "fixedCost", "seniorPf", "seniorPfFinanceCost", "subordinated"] as const) {
    if (!isNum(p[key])) return null;
    numbers[key] = p[key] as Num;
  }
  return {
    projectName: p.projectName,
    sido: p.sido,
    sigungu: p.sigungu,
    housingTypes,
    pricePerPyeong: numbers.pricePerPyeong,
    retail: numbers.retail,
    otherInflow: numbers.otherInflow,
    fixedCost: numbers.fixedCost,
    seniorPf: numbers.seniorPf,
    seniorPfFinanceCost: numbers.seniorPfFinanceCost,
    subordinated: numbers.subordinated,
  };
}

/** 주소의 해시(#plan=…)에서 입력값을 꺼낸다. 없거나 깨졌으면 null */
export function planFromHash(hash: string): PlanInput | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const value = new URLSearchParams(raw).get(SHARE_KEY);
  return value ? decodePlan(value) : null;
}

/** 공유 링크를 만든다 (기준 주소 + #plan=…) */
export function shareUrl(base: string, input: PlanInput): string {
  const [withoutHash] = base.split("#");
  return `${withoutHash}#${SHARE_KEY}=${encodePlan(input)}`;
}
