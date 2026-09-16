import "server-only";

/**
 * 공공데이터 호출 — **서버에서만** 실행된다.
 *
 * 최상단의 `import "server-only"` 가 클라이언트 임포트를 빌드 타임에 막는다.
 * 인증키는 모듈 로드 시점이 아니라 **요청 시점에** 읽는다. 임포트 단계에서
 * throw 하면 키 없이 `npm run build` 가 깨지기 때문이다.
 *
 * 키 값은 어디에도 출력하지 않는다. 호출이 실패해도 상태코드와 사유만 남기고
 * 요청 URL 은 찍지 않는다 — 쿼리에 키가 들어 있다.
 */

import {
  reb판정,
  법정동판정,
  시군구행만,
  실거래판정,
  xml값,
  xml행목록,
} from "../marketParse";
import type { 분류후보, 응답판정 } from "../marketParse";

/* ─── 캐시 주기 ────────────────────────────────────────────── */

/** 공공데이터 기본 — 하루 */
export const 하루 = 86_400;

/**
 * 코드성 데이터 — 30일.
 * 법정동코드와 R-ONE 지역분류코드(CLS_ID)는 자주 바뀌지 않는다.
 */
export const 삼십일 = 2_592_000;

/* ─── 오류 ─────────────────────────────────────────────────── */

/** 인증키 미설정. 빌드가 아니라 요청 시점에만 난다. */
export class 키없음오류 extends Error {}

/** 네트워크 실패 또는 HTTP 오류 */
export class 외부호출오류 extends Error {}

/** 호출은 됐지만 API 가 오류 코드를 돌려준 경우 */
export class 응답오류 extends Error {
  판정: 응답판정;
  constructor(메시지: string, 판정: 응답판정) {
    super(메시지);
    this.판정 = 판정;
  }
}

/* ─── 인증키 ───────────────────────────────────────────────── */

type 키이름 = "DATA_GO_KR_KEY" | "REB_API_KEY";

/** 요청 시점에만 읽는다. 돌려주기만 하고 로그에는 남기지 않는다. */
function 인증키(이름: 키이름): string {
  const v = process.env[이름];
  if (!v || v.trim() === "") {
    throw new 키없음오류(
      `${이름} 가 설정되어 있지 않다. .env.local 에 넣을 것 (NEXT_PUBLIC_ 접두사 금지).`,
    );
  }
  return v.trim();
}

/** 두 키가 준비됐는지만 알려준다. 값은 노출하지 않는다. */
export function 키상태(): { dataGoKr: boolean; reb: boolean } {
  return {
    dataGoKr: (process.env.DATA_GO_KR_KEY ?? "").trim() !== "",
    reb: (process.env.REB_API_KEY ?? "").trim() !== "",
  };
}

/* ─── 공통 fetch ───────────────────────────────────────────── */

async function xml가져오기(
  주소: string,
  revalidate: number,
  서비스명: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(주소, {
      next: { revalidate },
      headers: { Accept: "application/xml, text/xml, */*" },
    });
  } catch (e) {
    // 원인만 남긴다. 주소에는 인증키가 들어 있으므로 절대 찍지 않는다.
    throw new 외부호출오류(
      `${서비스명} 호출 실패: ${e instanceof Error ? e.message : "네트워크 오류"}`,
    );
  }
  if (!res.ok) {
    throw new 외부호출오류(`${서비스명} 응답 ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/**
 * data.go.kr 주소를 만든다.
 *
 * 포털은 Encoding 키와 Decoding 키를 함께 준다. 이미 인코딩된 키(%2B 같은 문자가
 * 든 값)를 다시 인코딩하면 인증이 깨진다. `%XX` 가 보이면 그대로 이어 붙인다.
 * 인증키 파라미터 이름은 서비스마다 다르다 — 법정동코드는 `ServiceKey`,
 * 실거래가는 `serviceKey` 다.
 */
function dataGoKr주소(
  base: string,
  키파라미터: "ServiceKey" | "serviceKey",
  파라미터: Record<string, string>,
): string {
  const 키 = 인증키("DATA_GO_KR_KEY");
  const 쿼리 = Object.entries(파라미터)
    .filter(([, v]) => v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const 키값 = /%[0-9A-Fa-f]{2}/.test(키) ? 키 : encodeURIComponent(키);
  return `${base}?${쿼리}&${키파라미터}=${키값}`;
}

/* ─── R-ONE (한국부동산원) ─────────────────────────────────── */

const REB_BASE = "https://www.reb.or.kr/r-one/openapi/";

function reb주소(서비스: string, 파라미터: Record<string, string>): string {
  const url = new URL(서비스, REB_BASE);
  url.searchParams.set("KEY", 인증키("REB_API_KEY"));
  url.searchParams.set("Type", "xml");
  for (const [k, v] of Object.entries(파라미터)) {
    if (v !== "") url.searchParams.set(k, v);
  }
  return url.toString();
}

export interface 통계표정보 {
  STATBL_ID: string;
  통계표명: string;
  /** 주기코드 — YY / HY / QY / MM / WK */
  주기: string;
  주기명: string;
  자료시작: string;
  자료종료: string;
}

/**
 * 통계표 메타 조회 (SttsApiTbl.do).
 * DTACYCLE_CD 를 추정하지 않고 여기서 확인해 쓴다. 코드성이라 30일 캐시.
 */
export async function 통계표조회(
  STATBL_ID: string,
): Promise<통계표정보 | null> {
  const xml = await xml가져오기(
    reb주소("SttsApiTbl.do", { STATBL_ID, pIndex: "1", pSize: "100" }),
    삼십일,
    "R-ONE 서비스 통계목록",
  );
  const 판정 = reb판정(xml);
  if (!판정.성공) {
    if (판정.자료없음) return null;
    throw new 응답오류(`R-ONE 통계목록 ${판정.코드}: ${판정.메시지}`, 판정);
  }
  const row = xml행목록(xml, "row").find((r) => r.STATBL_ID === STATBL_ID);
  if (!row) return null;
  return {
    STATBL_ID: row.STATBL_ID,
    통계표명: row.STATBL_NM ?? "",
    주기: row.DTACYCLE_CD ?? "",
    주기명: row.DTACYCLE_NM ?? "",
    자료시작: row.DATA_START_YY ?? "",
    자료종료: row.DATA_END_YY ?? "",
  };
}

/**
 * 통계표의 분류(지역) 목록 조회 (SttsApiTblItm.do, ITM_TAG=분류).
 * 여기서 얻은 ITM_ID 가 통계 조회의 CLS_ID 가 된다. 코드성이라 30일 캐시.
 * 한 번에 1,000건을 넘을 수 없어(ERROR-336) 넘치면 페이지를 넘긴다.
 */
export async function 분류목록조회(
  STATBL_ID: string,
  최대페이지 = 5,
): Promise<분류후보[]> {
  const 결과: 분류후보[] = [];
  for (let page = 1; page <= 최대페이지; page++) {
    const xml = await xml가져오기(
      reb주소("SttsApiTblItm.do", {
        STATBL_ID,
        ITM_TAG: "분류",
        pIndex: String(page),
        pSize: "1000",
      }),
      삼십일,
      "R-ONE 통계 세부항목",
    );
    const 판정 = reb판정(xml);
    if (!판정.성공) {
      if (판정.자료없음) break;
      throw new 응답오류(`R-ONE 세부항목 ${판정.코드}: ${판정.메시지}`, 판정);
    }
    const rows = xml행목록(xml, "row");
    for (const r of rows) {
      if (!r.ITM_ID) continue;
      결과.push({
        CLS_ID: r.ITM_ID,
        이름: r.ITM_NM ?? "",
        전체이름: r.ITM_FULLNM ?? r.ITM_NM ?? "",
      });
    }
    const 전체 = Number(xml값(xml, "list_total_count") ?? "0");
    if (rows.length === 0 || !Number.isFinite(전체) || 결과.length >= 전체) {
      break;
    }
  }
  return 결과;
}

/** 통계 자료값 한 줄 */
export interface 통계값 {
  시점: string;
  CLS_ID: string;
  분류명: string;
  분류전체명: string;
  ITM_ID: string;
  항목명: string;
  값: number | null;
  단위: string;
}

/**
 * 통계 조회 (SttsApiTblData.do).
 *
 * 분기 통계는 공표 시차가 있어 한 시점을 찍으면 빈 응답이 오기 쉽다.
 * 구간(START~END)으로 받아서 값이 있는 가장 최근 시점을 고른다.
 * 통계값이라 하루 캐시.
 */
export async function 통계조회(파라미터: {
  STATBL_ID: string;
  DTACYCLE_CD: string;
  CLS_ID?: string;
  ITM_ID?: string;
  START_WRTTIME?: string;
  END_WRTTIME?: string;
}): Promise<통계값[]> {
  const xml = await xml가져오기(
    reb주소("SttsApiTblData.do", {
      STATBL_ID: 파라미터.STATBL_ID,
      DTACYCLE_CD: 파라미터.DTACYCLE_CD,
      CLS_ID: 파라미터.CLS_ID ?? "",
      ITM_ID: 파라미터.ITM_ID ?? "",
      START_WRTTIME: 파라미터.START_WRTTIME ?? "",
      END_WRTTIME: 파라미터.END_WRTTIME ?? "",
      pIndex: "1",
      pSize: "1000",
    }),
    하루,
    "R-ONE 통계 조회",
  );
  const 판정 = reb판정(xml);
  if (!판정.성공) {
    if (판정.자료없음) return [];
    throw new 응답오류(`R-ONE 통계조회 ${판정.코드}: ${판정.메시지}`, 판정);
  }
  return xml행목록(xml, "row").map((r) => {
    const n = Number((r.DTA_VAL ?? "").replace(/,/g, ""));
    return {
      시점: r.WRTTIME_IDTFR_ID ?? "",
      CLS_ID: r.CLS_ID ?? "",
      분류명: r.CLS_NM ?? "",
      분류전체명: r.CLS_FULLNM ?? "",
      ITM_ID: r.ITM_ID ?? "",
      항목명: r.ITM_NM ?? "",
      값: Number.isFinite(n) ? n : null,
      단위: r.UI_NM ?? "",
    };
  });
}

/* ─── 공공데이터포털 (data.go.kr) ──────────────────────────── */

const BJD_URL = "http://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList";

/**
 * 법정동코드 조회.
 * `flag=Y` 는 필수다 — 빠지면 결과가 비어 온다. 코드성이라 30일 캐시.
 */
export async function 법정동조회(
  지역주소명: string,
  numOfRows = 100,
): Promise<Record<string, string>[]> {
  const 주소 = dataGoKr주소(BJD_URL, "ServiceKey", {
    type: "xml",
    pageNo: "1",
    numOfRows: String(numOfRows),
    flag: "Y",
    locatadd_nm: 지역주소명.trim(),
  });
  const xml = await xml가져오기(주소, 삼십일, "법정동코드");
  const 판정 = 법정동판정(xml);
  if (!판정.성공) {
    if (판정.자료없음) return [];
    throw new 응답오류(`법정동코드 ${판정.코드}: ${판정.메시지}`, 판정);
  }
  return xml행목록(xml, "row");
}

/** 시군구 단위 후보만 (시도·읍면동·리 제외) */
export async function 시군구후보조회(
  질의: string,
): Promise<Record<string, string>[]> {
  return 시군구행만(await 법정동조회(질의));
}

const RTMS_URL =
  "https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade";

/**
 * 상업업무용 부동산 매매 실거래가 조회.
 * LAWD_CD 는 법정동코드 10자리 중 앞 5자리, DEAL_YMD 는 계약년월 6자리.
 * 일 1회 갱신이라 하루 캐시.
 */
export async function 실거래조회(
  LAWD_CD: string,
  DEAL_YMD: string,
  numOfRows = 1000,
): Promise<Record<string, string>[]> {
  const 주소 = dataGoKr주소(RTMS_URL, "serviceKey", {
    LAWD_CD,
    DEAL_YMD,
    pageNo: "1",
    numOfRows: String(numOfRows),
  });
  const xml = await xml가져오기(주소, 하루, "상업업무용 실거래가");
  const 판정 = 실거래판정(xml);
  if (!판정.성공) {
    if (판정.자료없음) return [];
    throw new 응답오류(`실거래가 ${판정.코드}: ${판정.메시지}`, 판정);
  }
  return xml행목록(xml, "item");
}
