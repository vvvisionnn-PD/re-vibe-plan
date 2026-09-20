import { priceThreshold, type Num, type PlanInput } from "./calc.ts";
import { isFullSidoName, isFullSigunguName } from "./region.ts";

/**
 * 2장 시장 분석 — 공공데이터 응답 해석과 표 계산 (순수 함수).
 *
 * 흐름: 화면 → /api/region · /api/market/* (서버, 키 사용) → 공공데이터
 * 이 파일은 키 · fetch를 다루지 않는다. 서버 · 화면 · 테스트가 함께 쓴다.
 * 주소 · 필드 이름은 api_docs/ 기술문서를 따른다.
 */

/** 자료가 없을 때 2장에 표시하는 문구 */
export const MARKET_NO_DATA = "자료 없음 — 공공데이터 확인 필요";
/** 실거래 조회 개월 수 (한 번에 한 달씩) */
export const MARKET_MONTHS = 12;
/** 청약홈 조회 기간 (년) */
export const SUBSCRIPTION_YEARS = 3;
/** "84㎡" 판정: 전용면적 84.00㎡ 이상 85.00㎡ 미만 */
export const AREA84_MIN = 84;
export const AREA84_MAX = 85;
/** 공공데이터 캐시 (초): 하루, 법정동코드는 30일 */
export const CACHE_SECONDS = 86_400;
export const REGION_CACHE_SECONDS = 30 * 86_400;
/** 1㎡ = 0.3025평 */
const PYEONG_PER_M2 = 0.3025;

// ─────────────────────────────────────────────
// 공통 도우미
// ─────────────────────────────────────────────

/** 사업대상지 이름("시도 시군구")을 만든다. 전체 이름이 아니면 null */
export function areaName(sido: string, sigungu: string): string | null {
  const s = sido.trim();
  const g = sigungu.trim().replace(/\s+/g, " ");
  if (s === "" || g === "" || !isFullSidoName(s) || !isFullSigunguName(g)) return null;
  return `${s} ${g}`;
}

/**
 * 요청 파라미터 area("시도 시군구")를 확인한다. 형식이 맞으면 정리된 이름, 아니면 null.
 * 첫 단어를 시도, 나머지를 시군구로 본다 (예: "경기도 수원시 영통구").
 */
export function parseAreaParam(area: string | null): string | null {
  if (!area || area.length > 60) return null;
  const [sido, ...rest] = area.trim().split(/\s+/);
  return areaName(sido ?? "", rest.join(" "));
}

/** 계약년월 파라미터("YYYYMM") 확인 — 2006년 이후 · 월 01~12 */
export function isYm(ym: string | null): ym is string {
  if (!ym || !/^\d{6}$/.test(ym)) return false;
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(4));
  return y >= 2006 && y <= 2100 && m >= 1 && m <= 12;
}

/** 청약홈 번호 파라미터(주택관리번호 · 공고번호) 확인 — 숫자 1~20자리 */
export function isNoParam(v: string | null): v is string {
  return !!v && /^\d{1,20}$/.test(v);
}

/** "95,815" · " 59.87 " 같은 문자열을 숫자로. 비었거나 숫자가 아니면 null */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/,/g, "").trim();
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** 청약홈 주택형("084.9543T")에서 전용면적(㎡)을 꺼낸다 */
export function exclusiveFromHouseTy(houseTy: string): number | null {
  const m = /^\s*0*(\d+(?:\.\d+)?)/.exec(houseTy);
  return m ? Number(m[1]) : null;
}

/** 전용면적이 84㎡ 구간(84.00 이상 85.00 미만)인지 */
export function is84(exclusiveM2: number | null): boolean {
  return exclusiveM2 !== null && exclusiveM2 >= AREA84_MIN && exclusiveM2 < AREA84_MAX;
}

/** 중앙값. 값이 없으면 null */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** 오늘 기준 직전 n개월 계약년월("YYYYMM") — 이번 달은 자료가 덜 쌓여 빼고, 오래된 달부터 */
export function recentMonths(today: Date, n = MARKET_MONTHS): string[] {
  const out: string[] = [];
  for (let i = n; i >= 1; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    out.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/** 오늘로부터 years년 전 날짜("YYYY-MM-DD") — 청약홈 모집공고일 조건 */
export function yearsAgo(today: Date, years = SUBSCRIPTION_YEARS): string {
  const d = new Date(today.getFullYear() - years, today.getMonth(), today.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 날짜를 "YYYY-MM-DD"로 */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 이름 비교용 정리: 공백 · 괄호 내용 · "아파트" 제거, 소문자 */
export function normalizeName(name: string): string {
  return name
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/아파트|apt/gi, "")
    .replace(/[\s·.,\-_]/g, "")
    .toLowerCase();
}

// ─────────────────────────────────────────────
// 법정동코드 (행정안전부_행정표준코드_법정동코드 · getStanReginCdList)
// ─────────────────────────────────────────────

/** 시군구 후보 — code는 법정동코드 앞 5자리 (실거래 API의 LAWD_CD) */
export interface RegionCandidate {
  code: string;
  name: string;
}

/**
 * 법정동코드 JSON 응답에서 행 목록을 꺼낸다.
 * 구조: { StanReginCd: [ { head: [..., { RESULT: { resultCode } }] }, { row: [...] } ] }
 * 결과코드가 INFO-0이 아니면 rows는 빈 배열, message에 사유를 담는다.
 */
export function parseStanReginJson(json: unknown): { rows: Record<string, unknown>[]; message: string | null } {
  const root = (json as { StanReginCd?: unknown[]; RESULT?: { resultCode?: string; resultMsg?: string } }) ?? {};
  if (!Array.isArray(root.StanReginCd)) {
    const r = root.RESULT;
    return { rows: [], message: r?.resultMsg ?? "법정동코드 응답 형식 오류" };
  }
  let rows: Record<string, unknown>[] = [];
  let message: string | null = null;
  for (const part of root.StanReginCd as Record<string, unknown>[]) {
    if (Array.isArray(part.head)) {
      for (const h of part.head as Record<string, unknown>[]) {
        const r = h.RESULT as { resultCode?: string; resultMsg?: string } | undefined;
        if (r && r.resultCode !== "INFO-0") message = r.resultMsg ?? r.resultCode ?? "법정동코드 조회 오류";
      }
    }
    if (Array.isArray(part.row)) rows = part.row as Record<string, unknown>[];
  }
  return { rows, message };
}

/**
 * 법정동코드 행에서 시군구 단위(읍면동 000 · 리 00 · 시군구 ≠ 000)만 후보로 고른다.
 * 폐지된 코드(비고에 "폐지")는 뺀다.
 */
export function regionCandidates(rows: Record<string, unknown>[]): RegionCandidate[] {
  const out: RegionCandidate[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const code = String(r.region_cd ?? "");
    const name = String(r.locatadd_nm ?? "").trim();
    if (code.length !== 10 || r.sgg_cd === "000" || r.umd_cd !== "000" || r.ri_cd !== "00") continue;
    if (String(r.locat_rm ?? "").includes("폐지")) continue;
    const five = code.slice(0, 5);
    if (seen.has(five)) continue;
    seen.add(five);
    out.push({ code: five, name });
  }
  return out;
}

/** 후보 중 사업대상지 이름과 정확히 같은 하나를 고른다. 없으면 사유를 돌려준다 */
export function pickRegion(
  candidates: RegionCandidate[],
  area: string,
): { ok: true; region: RegionCandidate } | { ok: false; reason: string } {
  const exact = candidates.filter((c) => c.name === area);
  if (exact.length === 1) return { ok: true, region: exact[0] };
  if (exact.length > 1) return { ok: false, reason: `"${area}"에 해당하는 코드가 여러 개입니다` };
  return { ok: false, reason: `법정동코드에서 "${area}"을(를) 찾지 못했습니다` };
}

// ─────────────────────────────────────────────
// 실거래가 XML (국토교통부 · RTMSDataSvcSilvTrade / RTMSDataSvcAptRent)
// ─────────────────────────────────────────────

/** XML의 <item> 목록을 {태그: 값} 객체 배열로 바꾼다 (한 단계 태그만) */
export function parseXmlItems(xml: string): Record<string, string>[] {
  const items: Record<string, string>[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  const fieldRe = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>|<([A-Za-z0-9_]+)\s*\/>/g;
  for (const m of xml.matchAll(itemRe)) {
    const obj: Record<string, string> = {};
    for (const f of m[1].matchAll(fieldRe)) {
      if (f[1]) obj[f[1]] = decodeXml(f[2]).trim();
      else if (f[3]) obj[f[3]] = "";
    }
    items.push(obj);
  }
  return items;
}

/** XML 엔티티를 되돌린다 */
function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** XML에서 한 태그 값을 꺼낸다 */
export function xmlTag(xml: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? decodeXml(m[1]).trim() : null;
}

/**
 * 실거래 XML 응답 상태. resultCode "000"이면 정상.
 * 포털 게이트웨이 오류(<returnAuthMsg>)도 오류로 본다.
 */
export function rtmsStatus(xml: string): { ok: true; totalCount: number } | { ok: false; message: string } {
  const code = xmlTag(xml, "resultCode");
  if (code === null) {
    const auth = xmlTag(xml, "returnAuthMsg") ?? xmlTag(xml, "errMsg");
    return { ok: false, message: auth ? `공공데이터 포털 오류: ${auth}` : "실거래 응답 형식 오류" };
  }
  if (code !== "000" && code !== "00") return { ok: false, message: `실거래 조회 오류: ${xmlTag(xml, "resultMsg") ?? code}` };
  return { ok: true, totalCount: toNumber(xmlTag(xml, "totalCount")) ?? 0 };
}

/** 계약일 "YYYY-MM-DD" */
function dealDate(item: Record<string, string>): string {
  const y = item.dealYear ?? "";
  const m = (item.dealMonth ?? "").padStart(2, "0");
  const d = (item.dealDay ?? "").padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 분양권 전매 거래 (입주권 · 해제 제외 후) */
export interface PresaleTrade {
  aptNm: string;
  umdNm: string;
  exclusiveM2: number;
  /** 거래금액 (만원) */
  amount: number;
  date: string;
}

/** 분양권 월별 조회 결과 */
export interface PresaleMonth {
  ym: string;
  trades: PresaleTrade[];
  /** 원자료 건수 · 제외 건수 */
  stats: { total: number; rightsExcluded: number; cancelledExcluded: number; invalidExcluded: number };
  /** 원자료의 구분(ownershipGbn) 값별 건수 — 제외 기준 확인용 */
  ownership: Record<string, number>;
}

/**
 * 분양권 전매 자료를 거른다.
 * - 입주권 제외: ownershipGbn(분양권 및 입주권)이 "입"으로 시작하면 뺀다.
 *   실제 응답에서 분양권 거래는 이 값이 대부분 비어 있으므로("분"만 남기면 전부 빠짐), 빈 값 · "분"은 분양권으로 본다.
 * - 해제 제외: cdealType(해제여부)에 값이 있으면 뺀다
 * - 금액 · 면적이 숫자가 아니면 뺀다
 */
export function filterPresale(ym: string, items: Record<string, string>[]): PresaleMonth {
  const stats = { total: items.length, rightsExcluded: 0, cancelledExcluded: 0, invalidExcluded: 0 };
  const ownership: Record<string, number> = {};
  const trades: PresaleTrade[] = [];
  for (const it of items) {
    const g = (it.ownershipGbn ?? "").trim() || "(빈 값)";
    ownership[g] = (ownership[g] ?? 0) + 1;
    if ((it.ownershipGbn ?? "").trim().startsWith("입")) {
      stats.rightsExcluded += 1;
      continue;
    }
    if ((it.cdealType ?? "").trim() !== "") {
      stats.cancelledExcluded += 1;
      continue;
    }
    const exclusiveM2 = toNumber(it.excluUseAr);
    const amount = toNumber(it.dealAmount);
    if (exclusiveM2 === null || amount === null) {
      stats.invalidExcluded += 1;
      continue;
    }
    trades.push({ aptNm: it.aptNm ?? "", umdNm: it.umdNm ?? "", exclusiveM2, amount, date: dealDate(it) });
  }
  return { ym, trades, stats, ownership };
}

/** 84㎡ 신규 전세 계약 */
export interface RentContract {
  aptNm: string;
  umdNm: string;
  exclusiveM2: number;
  /** 보증금 (만원) */
  deposit: number;
  date: string;
}

/** 전월세 월별 조회 결과 */
export interface RentMonth {
  ym: string;
  contracts: RentContract[];
  stats: { total: number; monthlyExcluded: number; sizeExcluded: number; notNewExcluded: number; invalidExcluded: number };
}

/**
 * 전월세 자료에서 84㎡ 신규 전세만 남긴다.
 * - 월세 제외: monthlyRent(월세금액)가 0이 아니면 뺀다
 * - 면적 제외: 전용 84.00㎡ 이상 85.00㎡ 미만만 남긴다
 * - 신규만: contractType(계약구분)이 "신규"가 아니면(갱신 · 미기재) 뺀다
 * 전월세 기술문서에는 해제여부 항목이 없어 해제 거래는 걸러낼 수 없다.
 */
export function filterRent(ym: string, items: Record<string, string>[]): RentMonth {
  const stats = { total: items.length, monthlyExcluded: 0, sizeExcluded: 0, notNewExcluded: 0, invalidExcluded: 0 };
  const contracts: RentContract[] = [];
  for (const it of items) {
    const monthly = toNumber(it.monthlyRent) ?? 0;
    const deposit = toNumber(it.deposit);
    const exclusiveM2 = toNumber(it.excluUseAr);
    if (deposit === null || exclusiveM2 === null) {
      stats.invalidExcluded += 1;
      continue;
    }
    if (monthly !== 0) {
      stats.monthlyExcluded += 1;
      continue;
    }
    if (!is84(exclusiveM2)) {
      stats.sizeExcluded += 1;
      continue;
    }
    if ((it.contractType ?? "").trim() !== "신규") {
      stats.notNewExcluded += 1;
      continue;
    }
    contracts.push({ aptNm: it.aptNm ?? "", umdNm: it.umdNm ?? "", exclusiveM2, deposit, date: dealDate(it) });
  }
  return { ym, contracts, stats };
}

// ─────────────────────────────────────────────
// 청약홈 (한국부동산원 · ApplyhomeInfoDetailSvc / ApplyhomeInfoCmpetRtSvc)
// ─────────────────────────────────────────────

/** odcloud JSON 응답의 data 배열. 오류 응답이면 message */
export function parseOdcloud(json: unknown): { data: Record<string, unknown>[]; totalCount: number; message: string | null } {
  const o = (json ?? {}) as Record<string, unknown>;
  if (!Array.isArray(o.data)) {
    const msg = typeof o.msg === "string" ? o.msg : "청약홈 응답 형식 오류";
    return { data: [], totalCount: 0, message: msg };
  }
  return { data: o.data as Record<string, unknown>[], totalCount: toNumber(o.totalCount) ?? 0, message: null };
}

/** APT 분양 공고 (분양정보 상세조회) */
export interface Announcement {
  /** 주택관리번호 */
  id: string;
  /** 공고번호 */
  pblanc: string;
  name: string;
  /** 모집공고일 */
  date: string;
  address: string;
  /** 공급규모 (세대) */
  totalUnits: number | null;
  url: string;
}

/** 분양정보 상세조회 행 → 공고 */
export function toAnnouncement(r: Record<string, unknown>): Announcement {
  return {
    id: String(r.HOUSE_MANAGE_NO ?? ""),
    pblanc: String(r.PBLANC_NO ?? ""),
    name: String(r.HOUSE_NM ?? ""),
    date: String(r.RCRIT_PBLANC_DE ?? ""),
    address: String(r.HSSPLY_ADRES ?? ""),
    totalUnits: toNumber(r.TOT_SUPLY_HSHLDCO),
    url: String(r.PBLANC_URL ?? ""),
  };
}

/** 잔여세대 공고 (APT 잔여세대 분양정보 상세조회) */
export interface Remainder {
  id: string;
  pblanc: string;
  name: string;
  date: string;
  address: string;
  /** 공급규모 (세대) */
  units: number | null;
  /** 주택구분코드명 (예: 무순위) */
  kind: string;
}

/** 잔여세대 상세조회 행 → 잔여세대 공고 */
export function toRemainder(r: Record<string, unknown>): Remainder {
  return {
    id: String(r.HOUSE_MANAGE_NO ?? ""),
    pblanc: String(r.PBLANC_NO ?? ""),
    name: String(r.HOUSE_NM ?? ""),
    date: String(r.RCRIT_PBLANC_DE ?? ""),
    address: String(r.HSSPLY_ADRES ?? ""),
    units: toNumber(r.TOT_SUPLY_HSHLDCO),
    kind: String(r.HOUSE_SECD_NM ?? ""),
  };
}

/** 공고의 주택형 하나 — 분양가(주택형별 상세조회) + 경쟁률 */
export interface HouseTypeDetail {
  /** 주택형 (예: 084.9543T) */
  houseTy: string;
  exclusiveM2: number | null;
  /** 공급면적 (㎡) */
  supplyM2: number | null;
  /** 분양최고금액 (만원) */
  topAmount: number | null;
  /** 일반공급 세대수 (경쟁률 자료의 공급세대수) */
  generalUnits: number | null;
  /** 1순위 · 2순위 접수건수 (모든 거주지역 합). 경쟁률 자료가 없으면 null */
  rank1Req: number | null;
  rank2Req: number | null;
}

/** 공고 하나의 주택형별 상세 */
export interface SubscriptionDetail {
  id: string;
  pblanc: string;
  types: HouseTypeDetail[];
}

/**
 * 주택형별 분양가 행(getAPTLttotPblancMdl)과 경쟁률 행(getAPTLttotPblancCmpet)을 주택형으로 합친다.
 * 접수건수는 순위별로 모든 거주지역(해당 · 기타경기 · 기타)을 더한다.
 */
export function combineDetail(id: string, pblanc: string, mdl: Record<string, unknown>[], cmpet: Record<string, unknown>[]): SubscriptionDetail {
  const key = (ty: unknown) => String(ty ?? "").trim();
  const req = new Map<string, { r1: number; r2: number; units: number | null }>();
  for (const c of cmpet) {
    const k = key(c.HOUSE_TY);
    const cur = req.get(k) ?? { r1: 0, r2: 0, units: null };
    const rank = toNumber(c.SUBSCRPT_RANK_CODE);
    const n = toNumber(c.REQ_CNT) ?? 0;
    if (rank === 1) cur.r1 += n;
    if (rank === 2) cur.r2 += n;
    const units = toNumber(c.SUPLY_HSHLDCO);
    if (units !== null) cur.units = Math.max(cur.units ?? 0, units);
    req.set(k, cur);
  }
  const types: HouseTypeDetail[] = mdl.map((m) => {
    const k = key(m.HOUSE_TY);
    const r = req.get(k);
    return {
      houseTy: k,
      exclusiveM2: exclusiveFromHouseTy(k),
      supplyM2: toNumber(m.SUPLY_AR),
      topAmount: toNumber(m.LTTOT_TOP_AMOUNT),
      generalUnits: r?.units ?? toNumber(m.SUPLY_HSHLDCO),
      rank1Req: r ? r.r1 : null,
      rank2Req: r ? r.r2 : null,
    };
  });
  return { id, pblanc, types };
}

// ─────────────────────────────────────────────
// 표 계산
// ─────────────────────────────────────────────

/** 표 공통 머리말: 지역 · 건수 · 제외 기준 · 조회일 */
export interface TableMeta {
  area: string;
  count: number;
  exclusions: string[];
  asOf: string;
}

/** 공고 키 */
const annKey = (id: string, pblanc: string) => `${id}|${pblanc}`;

/** 인근 신규 84㎡ 한 줄 */
export interface NewSupplyRow {
  name: string;
  date: string;
  houseTy: string;
  supplyPyeong: number;
  /** 분양최고금액 (만원) */
  topAmount: number;
  /** 공급평당 분양가 (만원/평) = 분양최고금액 ÷ (공급면적 × 0.3025) */
  pricePerPyeong: number;
}

/**
 * 표 1 — 인근 신규 84㎡ 공급평당 분양가 vs 계획가.
 * 최근 3년 APT 분양 공고의 전용 84㎡ 주택형에서 공급평당 = 분양최고금액 ÷ (공급면적㎡ × 0.3025).
 * 대표값은 중앙값, 차이 = 계획 평당가 − 중앙값.
 */
export function newSupply84(announcements: Announcement[], details: SubscriptionDetail[], planPrice: Num) {
  const byKey = new Map(details.map((d) => [annKey(d.id, d.pblanc), d]));
  const rows: NewSupplyRow[] = [];
  let noPrice = 0;
  for (const a of announcements) {
    const d = byKey.get(annKey(a.id, a.pblanc));
    if (!d) continue;
    for (const t of d.types) {
      if (!is84(t.exclusiveM2)) continue;
      if (t.supplyM2 === null || t.supplyM2 <= 0 || t.topAmount === null || t.topAmount <= 0) {
        noPrice += 1;
        continue;
      }
      const supplyPyeong = t.supplyM2 * PYEONG_PER_M2;
      rows.push({ name: a.name, date: a.date, houseTy: t.houseTy, supplyPyeong, topAmount: t.topAmount, pricePerPyeong: t.topAmount / supplyPyeong });
    }
  }
  const med = median(rows.map((r) => r.pricePerPyeong));
  return {
    rows: rows.sort((x, y) => y.date.localeCompare(x.date)),
    median: med,
    /** 계획 평당가 − 인근 중앙값 (만원/평). 음수면 계획가가 더 싸다 */
    planMinusMedian: med !== null && planPrice !== null ? planPrice - med : null,
    noPrice,
  };
}

/** 분양권 웃돈 한 줄 */
export interface PremiumRow {
  aptNm: string;
  date: string;
  exclusiveM2: number;
  /** 거래금액 (만원) */
  amount: number;
  /** 맞춘 분양가 = 같은 단지 · 가장 가까운 주택형의 분양최고금액 (만원) */
  salePrice: number;
  /** 웃돈 (만원) = 거래금액 − 분양가 */
  premium: number;
}

/**
 * 표 2 — 분양권 웃돈 (입주권 제외).
 * 분양권 거래를 청약홈 공고와 단지명으로 맞추고(이름 정리 후 한쪽이 다른 쪽을 포함),
 * 전용면적이 ±0.5㎡ 안에서 가장 가까운 주택형의 분양최고금액을 분양가로 쓴다.
 * 웃돈 = 거래금액 − 분양가.
 * - 맞출 단지 · 주택형이 없으면 unmatched로 뺀다.
 * - 가장 가까운 전용면적(±0.005㎡)에 분양가가 다른 주택형이 여럿이면(예: 125.8735A · 125.8735D)
 *   실거래 자료로는 타입을 구분할 수 없으므로 ambiguous로 뺀다.
 */
export function presalePremium(trades: PresaleTrade[], announcements: Announcement[], details: SubscriptionDetail[]) {
  const byKey = new Map(details.map((d) => [annKey(d.id, d.pblanc), d]));
  const complexes = announcements
    .map((a) => ({ norm: normalizeName(a.name), detail: byKey.get(annKey(a.id, a.pblanc)) }))
    .filter((c) => c.norm.length >= 2 && c.detail);
  const rows: PremiumRow[] = [];
  let unmatched = 0;
  let ambiguous = 0;
  for (const t of trades) {
    const n = normalizeName(t.aptNm);
    const complex = n.length >= 2 ? complexes.find((c) => c.norm.includes(n) || n.includes(c.norm)) : undefined;
    const candidates = (complex?.detail?.types ?? [])
      .filter((ty) => ty.exclusiveM2 !== null && ty.topAmount !== null)
      .map((ty) => ({ price: ty.topAmount!, gap: Math.abs(ty.exclusiveM2! - t.exclusiveM2) }))
      .filter((c) => c.gap <= 0.5);
    if (candidates.length === 0) {
      unmatched += 1;
      continue;
    }
    const bestGap = Math.min(...candidates.map((c) => c.gap));
    const prices = new Set(candidates.filter((c) => c.gap <= bestGap + 0.005).map((c) => c.price));
    if (prices.size > 1) {
      ambiguous += 1;
      continue;
    }
    const salePrice = [...prices][0];
    rows.push({ aptNm: t.aptNm, date: t.date, exclusiveM2: t.exclusiveM2, amount: t.amount, salePrice, premium: t.amount - salePrice });
  }
  return {
    rows: rows.sort((x, y) => y.date.localeCompare(x.date)),
    medianPremium: median(rows.map((r) => r.premium)),
    unmatched,
    ambiguous,
  };
}

/** 미달 한 줄 (공고 단위) */
export interface UndersubRow {
  name: string;
  date: string;
  /** 경쟁률 자료가 있는 주택형 수 */
  types: number;
  /** 1 · 2순위 접수 합계가 일반공급 세대수보다 적은 주택형 수 */
  shortTypes: number;
  /** 미달 세대수 = Σ max(0, 일반공급 − 1순위 − 2순위) */
  shortUnits: number;
}

/**
 * 표 3 — 1 · 2순위 미달.
 * 주택형마다 1순위 + 2순위 접수건수(모든 거주지역 합) < 일반공급 세대수이면 미달.
 * 경쟁률 자료가 없는 주택형은 뺀다.
 */
export function undersubscription(announcements: Announcement[], details: SubscriptionDetail[]) {
  const byKey = new Map(details.map((d) => [annKey(d.id, d.pblanc), d]));
  const rows: UndersubRow[] = [];
  let noRate = 0;
  for (const a of announcements) {
    const d = byKey.get(annKey(a.id, a.pblanc));
    if (!d) continue;
    let types = 0;
    let shortTypes = 0;
    let shortUnits = 0;
    for (const t of d.types) {
      if (t.rank1Req === null || t.rank2Req === null || t.generalUnits === null) {
        noRate += 1;
        continue;
      }
      types += 1;
      const gap = t.generalUnits - t.rank1Req - t.rank2Req;
      if (gap > 0) {
        shortTypes += 1;
        shortUnits += gap;
      }
    }
    if (types > 0) rows.push({ name: a.name, date: a.date, types, shortTypes, shortUnits });
  }
  return {
    rows: rows.sort((x, y) => y.date.localeCompare(x.date)),
    shortComplexes: rows.filter((r) => r.shortTypes > 0).length,
    totalShortUnits: rows.reduce((s, r) => s + r.shortUnits, 0),
    noRate,
  };
}

/** 표 4 — 잔여세대 공고 (최근 3년). 공급규모 합계 */
export function remainderSummary(list: Remainder[]) {
  const rows = [...list].sort((x, y) => y.date.localeCompare(x.date));
  return { rows, totalUnits: rows.reduce((s, r) => s + (r.units ?? 0), 0) };
}

/**
 * 우리 84㎡ 세대당 분양가 (만원) — 전용 84㎡ 주택형의 공급평 × 계획 평당가.
 * 84㎡ 주택형이 여럿이면 세대수 가중평균. 없거나 값이 비면 null.
 */
export function our84UnitPrice(input: PlanInput): number | null {
  if (input.pricePerPyeong === null) return null;
  let units = 0;
  let sum = 0;
  for (const h of input.housingTypes) {
    if (!is84(h.exclusiveM2) || h.supplyPyeong === null || h.units === null || h.units <= 0) continue;
    units += h.units;
    sum += h.supplyPyeong * input.pricePerPyeong * h.units;
  }
  return units > 0 ? sum / units : null;
}

/**
 * 표 5 — 84㎡ 신규 전세 ÷ 우리 84㎡ 세대당 분양가.
 * 전세 대표값은 중앙값. 비율이 높을수록 전세로 분양가를 받쳐주는 힘이 크다.
 */
export function jeonseRatio(contracts: RentContract[], input: PlanInput) {
  const medianDeposit = median(contracts.map((c) => c.deposit));
  const ourPrice = our84UnitPrice(input);
  return {
    medianDeposit,
    ourPrice,
    ratio: medianDeposit !== null && ourPrice !== null && ourPrice > 0 ? medianDeposit / ourPrice : null,
  };
}

/**
 * 결론 — 시장 대비 여유 = 인근 신규 84㎡ 공급평당(중앙값) − 상환 한계 평당가.
 * 양수면 인근 시세가 상환 한계보다 그만큼 높다(여유), 음수면 부족.
 */
export function marketMargin(input: PlanInput, nearbyMedian: number | null) {
  const t = priceThreshold(input, "repay");
  const repay = t.kind === "value" ? t.value : null;
  const margin = repay !== null && nearbyMedian !== null ? nearbyMedian - repay : null;
  return {
    repayPrice: repay,
    nearbyMedian,
    margin,
    marginPct: margin !== null && nearbyMedian !== null && nearbyMedian > 0 ? (margin / nearbyMedian) * 100 : null,
  };
}

/** 여러 달 분양권 자료를 합친다 (거래 목록 · 제외 건수 합계) */
export function mergePresale(months: PresaleMonth[]) {
  const stats = { total: 0, rightsExcluded: 0, cancelledExcluded: 0, invalidExcluded: 0 };
  const trades: PresaleTrade[] = [];
  for (const m of months) {
    trades.push(...m.trades);
    stats.total += m.stats.total;
    stats.rightsExcluded += m.stats.rightsExcluded;
    stats.cancelledExcluded += m.stats.cancelledExcluded;
    stats.invalidExcluded += m.stats.invalidExcluded;
  }
  return { trades, stats };
}

/** 여러 달 전월세 자료를 합친다 */
export function mergeRent(months: RentMonth[]) {
  const stats = { total: 0, monthlyExcluded: 0, sizeExcluded: 0, notNewExcluded: 0, invalidExcluded: 0 };
  const contracts: RentContract[] = [];
  for (const m of months) {
    contracts.push(...m.contracts);
    stats.total += m.stats.total;
    stats.monthlyExcluded += m.stats.monthlyExcluded;
    stats.sizeExcluded += m.stats.sizeExcluded;
    stats.notNewExcluded += m.stats.notNewExcluded;
    stats.invalidExcluded += m.stats.invalidExcluded;
  }
  return { contracts, stats };
}

/** 조회일 — 응답 시각(ISO) 중 가장 이른 날을 "YYYY-MM-DD"(한국 시간)로. 없으면 null */
export function asOfDate(isoList: string[]): string | null {
  const valid = isoList.filter((s) => !Number.isNaN(Date.parse(s))).sort();
  if (valid.length === 0) return null;
  const kst = new Date(Date.parse(valid[0]) + 9 * 3_600_000);
  return kst.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// 서버 응답 형태 (Route Handler ↔ 화면)
// ─────────────────────────────────────────────

/** /api/region 응답 */
export interface RegionResponse {
  area: string;
  region: RegionCandidate | null;
  candidates: RegionCandidate[];
  reason: string | null;
  asOf: string;
}

/** /api/market/presale 응답 */
export interface PresaleResponse extends PresaleMonth {
  area: string;
  asOf: string;
}

/** /api/market/rent 응답 */
export interface RentResponse extends RentMonth {
  area: string;
  asOf: string;
}

/** /api/market/subscription 응답 */
export interface SubscriptionResponse {
  area: string;
  since: string;
  announcements: Announcement[];
  remainders: Remainder[];
  asOf: string;
}

/** /api/market/subscription/detail 응답 */
export interface DetailResponse extends SubscriptionDetail {
  area: string;
  asOf: string;
}

/** 서버 오류 응답 */
export interface ErrorResponse {
  error: string;
}
