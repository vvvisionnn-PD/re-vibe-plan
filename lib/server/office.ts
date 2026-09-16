import "server-only";

/**
 * 오피스 임대시장 지표 조회 — 라우트가 얇아지도록 공통 절차를 모았다.
 *
 * 절차는 기술문서가 안내하는 순서 그대로다.
 *   1) SttsApiTbl.do   로 주기코드(DTACYCLE_CD)를 **확인**한다 (추정하지 않는다)
 *   2) SttsApiTblItm.do (ITM_TAG=분류) 로 지역분류코드(CLS_ID) 목록을 받는다
 *   3) 사업대상지와 가장 가까운 CLS_ID 를 고른다
 *   4) SttsApiTblData.do 로 통계값을 받는다
 */

import {
  분류깊이,
  상권후보추리기,
  실거래정리,
  시도상권목록,
  지역단위판정,
  지역코드5,
  최근분기목록,
  최근월목록,
} from "../marketParse";
import { 대상지분해 } from "../marketParse";
import { 평당매매가중앙값 } from "../market";
import type {
  실거래응답,
  시장지표응답,
  지역해석,
  지표종류,
  표메타,
} from "../market";
import {
  분류목록조회,
  실거래조회,
  시군구후보조회,
  통계조회,
  통계표조회,
  키없음오류,
  외부호출오류,
  응답오류,
} from "./publicData";

/** 사용자가 지정한 통계표 ID */
export const 통계표ID: Record<지표종류, string> = {
  임대료: "TT249843134237374",
  공실률: "TT244763134428698",
  순영업소득: "TT242303134253883",
  수익률: "T245883135037859",
};

/** 오늘 날짜 YYYY-MM-DD */
export function 조회일(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 외부 호출 예외를 사용자에게 보여줄 문구로 바꾼다. 키 값은 절대 담지 않는다. */
export function 오류문구(e: unknown): string {
  if (e instanceof 키없음오류) return e.message;
  if (e instanceof 응답오류) return e.message;
  if (e instanceof 외부호출오류) return e.message;
  return e instanceof Error ? e.message : "알 수 없는 오류";
}

/**
 * 통계표의 지역 분류에서 사업대상지에 맞는 상권 후보를 추린다.
 *
 * 오피스 통계표의 말단은 상권명이라 시군구명과 정확히 같을 수 없다.
 * 그래서 **부분일치 우선순위로 3~5개를 추천**하고, 같은 시도의 권역·상권
 * 전체 목록도 함께 돌려준다. 최종 확정은 화면에서 사람이 한다.
 *
 * `선택CLS` 가 주어지면 그것을 적용한다 (사용자가 드롭다운에서 고른 값).
 */
export async function 지역해석하기(
  STATBL_ID: string,
  area: string,
  선택CLS?: string | null,
): Promise<지역해석> {
  const 후보 = await 분류목록조회(STATBL_ID);
  const 판정 = 지역단위판정(후보);
  const { 시도 } = 대상지분해(area);
  const 추천 = 상권후보추리기(area, 후보, 5);
  const 시도목록 = 시도상권목록(후보, 시도);

  const 고름 = 선택CLS
    ? (후보.find((c) => c.CLS_ID === 선택CLS) ?? null)
    : null;
  const 적용 = 고름
    ? { ...고름, 점수: 0, 깊이: 분류깊이(고름) }
    : (추천[0] ?? null);

  return {
    질의: area,
    CLS_ID: 적용?.CLS_ID ?? null,
    분류명: 적용?.이름 ?? "",
    분류전체명: 적용?.전체이름 ?? "",
    점수: 적용?.점수 ?? 0,
    단위: 판정.단위,
    후보수: 후보.length,
    추천,
    시도목록,
    자동선택: !고름,
  };
}

/**
 * 주기코드를 고른다.
 *
 * SttsApiTbl.do 는 주기코드를 "YY,QY" 처럼 **쉼표로 묶어** 돌려주기도 한다.
 * 그대로 넘기면 조회 결과가 비어 온다(실제로 수익률 통계표가 그렇다).
 *
 * 지표마다 필요한 주기가 다르다.
 *  - 수익률: 분기값은 그 분기만의 수익률(예: 0.63%)이라 캡레이트와 견줄 수 없다.
 *    연(YY) 값(예: 3.12%)을 써야 한다.
 *  - 나머지: 분기(QY)가 최신이다.
 */
export function 주기선택(지표: 지표종류, 주기문자열: string): string {
  const 후보 = 주기문자열
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
  if (후보.length === 0) return "";
  const 선호 = 지표 === "수익률" ? ["YY", "QY", "HY"] : ["QY", "MM", "HY", "YY"];
  for (const c of 선호) if (후보.includes(c)) return c;
  return 후보[0];
}

/**
 * 통계표마다 쓸 **항목 ID**.
 *
 * `SttsApiTblItm.do?ITM_TAG=항목` 으로 실제 확인한 값이다. 조회할 때 이 번호를
 * 넘기면 필요한 한 줄만 온다 — 여러 줄을 받아 이름으로 골라내지 않는다.
 *
 * 이름으로 고르면 R-ONE 이 항목명을 조금만 바꿔도 매칭이 빗나가고, 그러면 오류 없이
 * 첫 줄이 쓰인다. 수익률 표에서 그러면 소득수익률(3.12%) 자리에 투자수익률(10.23%)이
 * 조용히 들어간다. 번호로 요청하면 틀릴 때 빈 응답이나 경고로 드러난다.
 */
export const 항목ID: Record<지표종류, string> = {
  임대료: "100001", // 임대료 (천원/㎡)
  공실률: "100001", // 공실률 (%)
  순영업소득: "100005", // 순영업소득(천원/㎡) — (%) 항목이 아니다
  수익률: "100002", // 소득수익률 — 투자수익률·자본수익률이 아니다
};

/**
 * 위 번호가 가리켜야 할 항목명. 응답이 다르면 R-ONE 이 ID 를 재배치한 것이므로
 * 값을 그대로 쓰지 않고 경고를 남긴다.
 */
export const 기대항목명: Record<지표종류, string> = {
  임대료: "임대료",
  공실률: "공실률",
  순영업소득: "순영업소득",
  수익률: "소득수익률",
};

/** 주기코드에 맞는 조회 구간을 만든다 */
function 조회구간(주기: string, ym: string | null): { start: string; end: string } {
  if (ym && ym.trim()) return { start: ym.trim(), end: ym.trim() };
  const 오늘 = new Date();
  if (주기 === "QY") {
    const 목록 = 최근분기목록(오늘, 8); // 공표 시차를 감안해 2년치
    return { start: 목록[0], end: 목록[목록.length - 1] };
  }
  if (주기 === "MM") {
    const 목록 = 최근월목록(오늘, 12);
    return { start: 목록[0], end: 목록[목록.length - 1] };
  }
  if (주기 === "YY") {
    const y = 오늘.getUTCFullYear();
    return { start: String(y - 3), end: String(y) };
  }
  // HY / WK 등은 구간을 비워 API 기본값에 맡긴다
  return { start: "", end: "" };
}

/**
 * 지표 한 개를 조회한다.
 * 분기 통계는 공표 시차가 있어 구간으로 받은 뒤 **값이 있는 가장 최근 시점**을 쓴다.
 */
export async function 지표조회(
  지표: 지표종류,
  area: string,
  ym: string | null,
  선택CLS?: string | null,
): Promise<시장지표응답> {
  const STATBL_ID = 통계표ID[지표];
  const 경고: string[] = [];
  const 기본메타 = (): 표메타 => ({
    지역: area,
    건수: 0,
    제외: [],
    조회일: 조회일(),
    출처: "R-ONE",
    출처상세: `한국부동산원 R-ONE · ${STATBL_ID}`,
    기준시점: null,
  });

  try {
    // 1) 주기코드를 확인한다 — 추정하지 않는다
    const 표정보 = await 통계표조회(STATBL_ID);
    const 주기원본 = 표정보?.주기 ?? "";
    if (!주기원본) {
      경고.push(
        `주기코드를 확인하지 못해 분기(QY)로 가정했다. [확인 필요] STATBL_ID=${STATBL_ID}`,
      );
    }
    const 적용주기 = 주기선택(지표, 주기원본) || "QY";
    if (주기원본.includes(",")) {
      경고.push(
        `이 통계표는 주기코드가 여러 개다(${주기원본}). "${적용주기}" 를 골랐다.` +
          (지표 === "수익률"
            ? " 분기 수익률은 해당 분기만의 값이라 캡레이트와 견줄 수 없어 연 기준을 쓴다."
            : ""),
      );
    }

    // 2~3) 지역 분류 확인
    const 해석 = await 지역해석하기(STATBL_ID, area, 선택CLS);
    const 출처상세 = 표정보
      ? `한국부동산원 R-ONE · ${표정보.통계표명} (${표정보.주기명 || 적용주기})`
      : `한국부동산원 R-ONE · ${STATBL_ID}`;

    if (해석.단위 !== "시군구") {
      경고.push(
        `지역 구분이 시군구가 아니라 상권 단위다 (후보 ${해석.후보수}개).` +
          (해석.자동선택
            ? " 아래 값은 상권명 부분일치로 자동 추린 것이다 — 구획도로 경계를 확인하고 확정할 것."
            : " 사용자가 확정한 상권이다."),
      );
    }
    if (표정보 && !표정보.통계표명.includes("2024년")) {
      경고.push(
        `[확인 필요] 2024년 3분기 재구획 이전 시리즈일 수 있다 (통계표명: ${표정보.통계표명}). ` +
          "구 시리즈 상권명과 혼용하지 말 것.",
      );
    }
    if (해석.CLS_ID === null) {
      return {
        ok: false,
        지표,
        값: null,
        단위: "",
        메타: { ...기본메타(), 출처상세 },
        지역해석: 해석,
        경고,
        오류:
          `"${area}" 와 이름이 겹치는 상권이 없다. ` +
          `아래 목록에서 상권을 직접 고를 것 (같은 시도 ${해석.시도목록.length}개).`,
      };
    }

    // 4) 통계값
    const { start, end } = 조회구간(적용주기, ym);
    const 행 = await 통계조회({
      STATBL_ID,
      DTACYCLE_CD: 적용주기,
      CLS_ID: 해석.CLS_ID,
      // 항목을 번호로 지정한다. 이름으로 골라내지 않는다.
      ITM_ID: 항목ID[지표],
      START_WRTTIME: start,
      END_WRTTIME: end,
    });

    const 유효 = 행.filter((r) => r.값 !== null);
    if (유효.length === 0) {
      return {
        ok: false,
        지표,
        값: null,
        단위: "",
        메타: { ...기본메타(), 지역: 해석.분류전체명 || area, 출처상세 },
        지역해석: 해석,
        경고,
        오류: "해당 구간에 공표된 값이 없다 — 공공데이터포털 확인 필요",
      };
    }

    const 최근시점 = 유효.reduce((a, b) => (b.시점 > a.시점 ? b : a)).시점;
    const 최근행 = 유효.filter((r) => r.시점 === 최근시점);
    // 항목을 번호로 지정했으므로 보통 한 줄만 온다.
    const 선택 = 최근행[0];

    // 번호가 예상과 다른 항목을 가리키면 조용히 쓰지 말고 드러낸다.
    if (!선택.항목명.includes(기대항목명[지표])) {
      경고.push(
        `ITM_ID ${항목ID[지표]} 가 예상과 다른 항목("${선택.항목명}")을 가리킨다. ` +
          `R-ONE 이 항목 ID 를 재배치했을 수 있다. [확인 필요]`,
      );
    }
    if (최근행.length > 1) {
      경고.push(
        `항목 번호를 지정했는데도 같은 시점에 ${최근행.length}줄이 왔다` +
          `(${[...new Set(최근행.map((r) => r.항목명))].join(", ")}). [확인 필요]`,
      );
    }

    return {
      ok: true,
      지표,
      값: 선택.값,
      단위: 선택.단위,
      메타: {
        지역: 선택.분류전체명 || 선택.분류명 || area,
        건수: 최근행.length,
        제외: [],
        조회일: 조회일(),
        출처: "R-ONE",
        출처상세: `${출처상세} · 항목 ${선택.항목명}`,
        기준시점: 최근시점,
      },
      지역해석: 해석,
      경고,
      오류: null,
    };
  } catch (e) {
    return {
      ok: false,
      지표,
      값: null,
      단위: "",
      메타: 기본메타(),
      지역해석: null,
      경고,
      오류: 오류문구(e),
    };
  }
}

/** 동시 실행 수를 제한해 순서대로 처리한다 */
async function 제한동시<T, R>(
  목록: T[],
  동시수: number,
  작업: (x: T) => Promise<R>,
): Promise<R[]> {
  const 결과: R[] = new Array(목록.length);
  let 다음 = 0;
  const 일꾼 = async () => {
    while (다음 < 목록.length) {
      const i = 다음++;
      결과[i] = await 작업(목록[i]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(동시수, 목록.length) }, 일꾼),
  );
  return 결과;
}

/**
 * 인근 상업업무용 매매 실거래 — 최근 1년, 업무시설 용도만.
 * 실거래가 API 는 한 달씩만 조회되므로 12번 부른다(하루 캐시).
 */
export async function 실거래조회하기(
  area: string,
  ym: string | null,
): Promise<실거래응답> {
  const 경고: string[] = [];
  const 기본메타 = (지역: string): 표메타 => ({
    지역,
    건수: 0,
    제외: [],
    조회일: 조회일(),
    출처: "공공데이터포털",
    출처상세: "국토교통부 상업업무용 부동산 매매 실거래가",
    기준시점: null,
  });

  try {
    const 후보 = await 시군구후보조회(area);
    if (후보.length === 0) {
      return {
        ok: false,
        건수: 0,
        평당매매가중앙값: null,
        건: [],
        메타: 기본메타(area),
        경고,
        오류: `"${area}" 의 법정동코드를 찾지 못했다`,
      };
    }
    if (후보.length > 1) {
      경고.push(
        `법정동코드 후보가 ${후보.length}개다. 첫 번째(${후보[0].locatadd_nm})를 썼다.`,
      );
    }
    const LAWD_CD = 지역코드5(후보[0].region_cd ?? "");
    const 지역명 = 후보[0].locatadd_nm ?? area;

    const 월목록 = ym && ym.trim() ? [ym.trim()] : 최근월목록(new Date(), 12);
    const 월별 = await 제한동시(월목록, 4, async (m) => {
      try {
        return await 실거래조회(LAWD_CD, m);
      } catch (e) {
        경고.push(`${m} 조회 실패: ${오류문구(e)}`);
        return [] as Record<string, string>[];
      }
    });

    const 정리 = 실거래정리(월별.flat(), {
      // 실제 응답의 buildingUse 는 "업무" 로 온다 ("업무시설" 아님)
      용도필터: ["업무"],
      용도라벨: "업무시설",
    });
    return {
      ok: true,
      건수: 정리.건.length,
      평당매매가중앙값: 평당매매가중앙값(정리.건),
      건: 정리.건,
      메타: {
        지역: 지역명,
        건수: 정리.건.length,
        제외: 정리.제외,
        조회일: 조회일(),
        출처: "공공데이터포털",
        출처상세: `국토교통부 상업업무용 부동산 매매 실거래가 · LAWD_CD ${LAWD_CD} · ${월목록[0]}~${월목록[월목록.length - 1]} · 원본 ${정리.전체건수}건`,
        기준시점: `${월목록[0]}~${월목록[월목록.length - 1]}`,
      },
      경고,
      오류: null,
    };
  } catch (e) {
    return {
      ok: false,
      건수: 0,
      평당매매가중앙값: null,
      건: [],
      메타: 기본메타(area),
      경고,
      오류: 오류문구(e),
    };
  }
}
