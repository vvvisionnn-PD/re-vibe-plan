import "server-only";
import {
  CACHE_SECONDS,
  REGION_CACHE_SECONDS,
  combineDetail,
  filterPresale,
  filterRent,
  parseOdcloud,
  parseStanReginJson,
  parseXmlItems,
  pickRegion,
  regionCandidates,
  rtmsStatus,
  toAnnouncement,
  toRemainder,
  type Announcement,
  type PresaleMonth,
  type RegionCandidate,
  type Remainder,
  type RentMonth,
  type SubscriptionDetail,
} from "../market.ts";

/**
 * 공공데이터 호출 — 서버 전용.
 * - 인증키: 환경변수 DATA_GO_KR_KEY. 요청 처리 중에만 읽는다(빌드 때 읽지 않음).
 * - 키가 들어간 URL은 오류 메시지 · 로그 · 응답에 절대 넣지 않는다.
 * - 캐시: 하루(법정동코드 30일) — fetch의 next.revalidate.
 * - 주소 · 파라미터는 api_docs/ 기술문서 그대로.
 */

/** 화면에 보여줘도 되는 오류 (키 · URL을 담지 않는다) */
export class MarketError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

const URLS = {
  region: "https://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList",
  presale: "https://apis.data.go.kr/1613000/RTMSDataSvcSilvTrade/getRTMSDataSvcSilvTrade",
  rent: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
  aptDetail: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail",
  remainderDetail: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getRemndrLttotPblancDetail",
  aptModel: "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancMdl",
  aptCompetition: "https://api.odcloud.kr/api/ApplyhomeInfoCmpetRtSvc/v1/getAPTLttotPblancCmpet",
} as const;

/** 한 번에 받을 행 수 · 최대 페이지 수 (무한 반복 방지) */
const PAGE_SIZE = 1000;
const MAX_PAGES = 20;
/** 요청 시간 제한 (ms) */
const TIMEOUT_MS = 20_000;

/**
 * 인증키를 URL에 넣을 형태로 돌려준다. 이미 인코딩된 키(%가 있음)는 그대로 쓴다.
 * 키 값은 반환만 하고 어디에도 남기지 않는다.
 */
function serviceKey(): string {
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new MarketError("인증키가 설정되지 않았습니다 (DATA_GO_KR_KEY)", 500);
  return key.includes("%") ? key : encodeURIComponent(key);
}

/** 키 파라미터 이름과 나머지 파라미터로 URL을 만든다 */
function buildUrl(base: string, keyParam: string, params: Record<string, string>): string {
  return `${base}?${keyParam}=${serviceKey()}&${new URLSearchParams(params).toString()}`;
}

/**
 * GET 요청을 보내고 본문 문자열 · 응답 시각을 돌려준다.
 * label은 오류 메시지에 쓰는 API 이름 (URL 대신).
 */
async function get(url: string, label: string, revalidate: number): Promise<{ text: string; fetchedAt: string }> {
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new MarketError(timeout ? `${label}: 응답 시간 초과` : `${label}: 연결 실패`);
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = "";
    try {
      const j = JSON.parse(text) as { msg?: unknown };
      if (typeof j.msg === "string") detail = ` — ${j.msg}`;
    } catch {
      // JSON이 아니면 상세 사유 없음
    }
    throw new MarketError(`${label}: HTTP ${res.status}${detail}`);
  }
  const date = res.headers.get("date");
  const fetchedAt = date ? new Date(date).toISOString() : new Date().toISOString();
  return { text, fetchedAt };
}

/** 가장 이른 응답 시각 (캐시된 응답이면 실제 조회 시각) */
const earliest = (a: string, b: string) => (a < b ? a : b);

/** 법정동코드로 지역 이름의 시군구 후보를 찾는다 (30일 캐시) */
export async function findRegions(q: string): Promise<{ candidates: RegionCandidate[]; fetchedAt: string }> {
  const url = buildUrl(URLS.region, "ServiceKey", {
    type: "json",
    pageNo: "1",
    numOfRows: String(PAGE_SIZE),
    flag: "Y",
    locatadd_nm: q,
  });
  const { text, fetchedAt } = await get(url, "법정동코드", REGION_CACHE_SECONDS);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new MarketError("법정동코드: 응답 형식 오류");
  }
  const { rows, message } = parseStanReginJson(json);
  // "해당하는 데이터가 없습니다" · "데이터없음 에러"는 결과 없음(후보 0개)으로 본다
  if (message && !/데이터\s*(가\s*)?없/.test(message)) throw new MarketError(`법정동코드: ${message}`);
  return { candidates: regionCandidates(rows), fetchedAt };
}

/** 사업대상지 이름을 시군구 코드로 확인한다. 정확히 하나가 아니면 오류 */
export async function resolveArea(area: string): Promise<RegionCandidate> {
  const { candidates } = await findRegions(area);
  const picked = pickRegion(candidates, area);
  if (!picked.ok) throw new MarketError(picked.reason, 404);
  return picked.region;
}

/** 실거래 XML을 모든 페이지 받아 item 목록으로 (하루 캐시) */
async function rtmsItems(base: string, label: string, lawdCd: string, ym: string) {
  const items: Record<string, string>[] = [];
  let fetchedAt = new Date().toISOString();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = buildUrl(base, "serviceKey", {
      LAWD_CD: lawdCd,
      DEAL_YMD: ym,
      pageNo: String(page),
      numOfRows: String(PAGE_SIZE),
    });
    const res = await get(url, label, CACHE_SECONDS);
    fetchedAt = earliest(fetchedAt, res.fetchedAt);
    const status = rtmsStatus(res.text);
    if (!status.ok) throw new MarketError(`${label}: ${status.message}`);
    const pageItems = parseXmlItems(res.text);
    items.push(...pageItems);
    if (pageItems.length === 0 || items.length >= status.totalCount) break;
  }
  return { items, fetchedAt };
}

/** 분양권 전매 한 달치 (입주권 · 해제 제외) */
export async function fetchPresaleMonth(lawdCd: string, ym: string): Promise<PresaleMonth & { fetchedAt: string }> {
  const { items, fetchedAt } = await rtmsItems(URLS.presale, "분양권전매", lawdCd, ym);
  return { ...filterPresale(ym, items), fetchedAt };
}

/** 전월세 한 달치 (84㎡ 신규 전세만) */
export async function fetchRentMonth(lawdCd: string, ym: string): Promise<RentMonth & { fetchedAt: string }> {
  const { items, fetchedAt } = await rtmsItems(URLS.rent, "전월세", lawdCd, ym);
  return { ...filterRent(ym, items), fetchedAt };
}

/** 청약홈 odcloud 목록을 모든 페이지 받는다 (하루 캐시) */
async function odcloudAll(base: string, label: string, cond: Record<string, string>) {
  const rows: Record<string, unknown>[] = [];
  let fetchedAt = new Date().toISOString();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = buildUrl(base, "serviceKey", { page: String(page), perPage: String(PAGE_SIZE), ...cond });
    const res = await get(url, label, CACHE_SECONDS);
    fetchedAt = earliest(fetchedAt, res.fetchedAt);
    let json: unknown;
    try {
      json = JSON.parse(res.text);
    } catch {
      throw new MarketError(`${label}: 응답 형식 오류`);
    }
    const { data, totalCount, message } = parseOdcloud(json);
    if (message) throw new MarketError(`${label}: ${message}`);
    rows.push(...data);
    if (data.length === 0 || rows.length >= totalCount) break;
  }
  return { rows, fetchedAt };
}

/**
 * 청약홈 — 공급위치에 지역명이 들어간 최근 공고 (APT 분양 · 잔여세대).
 * 조건: cond[HSSPLY_ADRES::LIKE]=지역명, cond[RCRIT_PBLANC_DE::GTE]=since
 */
export async function fetchSubscriptions(
  area: string,
  since: string,
): Promise<{ announcements: Announcement[]; remainders: Remainder[]; fetchedAt: string }> {
  const cond = { "cond[HSSPLY_ADRES::LIKE]": area, "cond[RCRIT_PBLANC_DE::GTE]": since };
  const [apt, rem] = await Promise.all([
    odcloudAll(URLS.aptDetail, "청약홈 분양정보", cond),
    odcloudAll(URLS.remainderDetail, "청약홈 잔여세대", cond),
  ]);
  return {
    announcements: apt.rows.map(toAnnouncement),
    remainders: rem.rows.map(toRemainder),
    fetchedAt: earliest(apt.fetchedAt, rem.fetchedAt),
  };
}

/** 청약홈 — 공고 하나의 주택형별 분양가 · 경쟁률 */
export async function fetchSubscriptionDetail(id: string, pblanc: string): Promise<SubscriptionDetail & { fetchedAt: string }> {
  const cond = { "cond[HOUSE_MANAGE_NO::EQ]": id, "cond[PBLANC_NO::EQ]": pblanc };
  const [mdl, cmpet] = await Promise.all([
    odcloudAll(URLS.aptModel, "청약홈 주택형", cond),
    odcloudAll(URLS.aptCompetition, "청약홈 경쟁률", cond),
  ]);
  return { ...combineDetail(id, pblanc, mdl.rows, cmpet.rows), fetchedAt: earliest(mdl.fetchedAt, cmpet.fetchedAt) };
}

/** Route Handler에서 오류를 응답으로 바꾼다 (키 · URL은 담지 않음) */
export function errorResponse(e: unknown): Response {
  if (e instanceof MarketError) return Response.json({ error: e.message }, { status: e.status });
  return Response.json({ error: "서버 오류" }, { status: 500 });
}
