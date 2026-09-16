/**
 * 공공데이터 응답 파싱과 지역 매칭 — 순수 함수만.
 *
 * 서버 전용 모듈(`lib/server/*`)은 `import "server-only"` 때문에 `node --test` 로
 * 실행할 수 없다. 그래서 검산할 값어치가 있는 로직은 전부 이 파일에 둔다.
 * 여기에는 fetch·인증키·환경변수가 없다.
 *
 * 응답은 세 서비스 모두 XML 이다. R-ONE 은 JSON 도 지원한다고 적혀 있으나
 * 기술문서에 JSON 봉투 구조가 없어 문서에 있는 XML 만 쓴다.
 */

/* ─── XML ──────────────────────────────────────────────────── */

/**
 * `<tag>값</tag>` 한 개를 꺼낸다. 없으면 null.
 *
 * 정규식은 문자열로 조립한다. 템플릿 리터럴에 백슬래시 이스케이프를 넣으면
 * 문자열 단계에서 먼저 해석돼 정규식에 닿기 전에 뭉개진다.
 * 그래서 개행 포함 매칭은 [^] 로, 속성부는 리터럴 공백으로 쓴다.
 */
export function xml값(xml: string, 태그: string): string | null {
  const m = new RegExp("<" + 태그 + "(?: [^>]*)?>([^]*?)</" + 태그 + ">").exec(
    xml,
  );
  if (m) return xml해제(m[1]);
  // <tag/> 처럼 빈 요소면 빈 문자열
  return new RegExp("<" + 태그 + "(?: [^>]*)?/>").test(xml) ? "" : null;
}

/**
 * 반복되는 `<태그>` 블록을 평평한 레코드 배열로 바꾼다.
 * 세 서비스 모두 한 겹짜리 평면 구조라 이 정도면 충분하다.
 */
export function xml행목록(
  xml: string,
  태그: string,
): Record<string, string>[] {
  const 블록 = new RegExp(
    "<" + 태그 + "(?: [^>]*)?>([^]*?)</" + 태그 + ">",
    "g",
  );
  const 결과: Record<string, string>[] = [];
  let m: RegExpExecArray | null;
  while ((m = 블록.exec(xml)) !== null) {
    결과.push(xml평면화(m[1]));
  }
  return 결과;
}
/** 한 블록 안의 자식 요소들을 { 태그: 값 } 으로 만든다. */
export function xml평면화(조각: string): Record<string, string> {
  const 결과: Record<string, string> = {};
  const 요소 = /<([A-Za-z_][\w.-]*)(?:\s[^>]*)?(?:\/>|>([\s\S]*?)<\/\1>)/g;
  let m: RegExpExecArray | null;
  while ((m = 요소.exec(조각)) !== null) {
    결과[m[1]] = m[2] === undefined ? "" : xml해제(m[2]).trim();
  }
  return 결과;
}

function xml해제(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/* ─── 응답 판정 ─────────────────────────────────────────────── */

export interface 응답판정 {
  성공: boolean;
  /** 자료가 정상 조회됐지만 건수가 0 인 경우 */
  자료없음: boolean;
  코드: string;
  메시지: string;
}

/**
 * R-ONE 응답 판정.
 * 기술문서: INFO-000 정상 / INFO-200 해당 데이터 없음 / ERROR-290 인증키 무효 등.
 */
export function reb판정(xml: string): 응답판정 {
  const 코드 = (xml값(xml, "CODE") ?? "").trim();
  const 메시지 = (xml값(xml, "MESSAGE") ?? "").trim();
  return {
    성공: 코드 === "INFO-000",
    자료없음: 코드 === "INFO-200",
    코드,
    메시지,
  };
}

/**
 * 법정동코드 응답 판정.
 * 기술문서 예제: resultCode=INFO-0, resultMsg=NOMAL SERVICE.
 * 에러 코드표는 290/310/... 숫자만 적혀 있어 두 형태를 모두 받아준다.
 */
export function 법정동판정(xml: string): 응답판정 {
  const 코드 = (xml값(xml, "resultCode") ?? "").trim();
  const 메시지 = (xml값(xml, "resultMsg") ?? "").trim();
  const 정상 = 코드 === "INFO-0" || 코드 === "0" || 코드 === "INFO-000";
  return {
    성공: 정상,
    // 실제 응답에서 INFO-3("데이터없음 에러")이 확인됐다. 문서 코드표에는 없다.
    자료없음: 코드 === "INFO-200" || 코드 === "200" || 코드 === "INFO-3",
    코드,
    메시지,
  };
}

/**
 * 실거래가 응답 판정.
 * 기술문서 예제: resultCode=000, resultMsg=OK. 03 은 데이터 없음.
 */
export function 실거래판정(xml: string): 응답판정 {
  const 코드 = (xml값(xml, "resultCode") ?? "").trim();
  const 메시지 = (xml값(xml, "resultMsg") ?? "").trim();
  return {
    성공: 코드 === "000" || 코드 === "00",
    자료없음: 코드 === "03",
    코드,
    메시지,
  };
}

/* ─── 지역 매칭 ─────────────────────────────────────────────── */

/** 사업대상지 전체 이름을 시도와 시군구로 나눈다. */
export function 대상지분해(area: string): { 시도: string; 시군구: string } {
  const 조각 = area.trim().split(/\s+/).filter(Boolean);
  if (조각.length === 0) return { 시도: "", 시군구: "" };
  if (조각.length === 1) return { 시도: 조각[0], 시군구: "" };
  return { 시도: 조각[0], 시군구: 조각.slice(1).join(" ") };
}

/**
 * 지역명을 비교하기 좋게 다듬는다.
 * R-ONE 분류명은 "서울>종로구" 처럼 축약 시도명을 쓰고,
 * 입력은 "서울특별시 종로구" 처럼 정식 명칭을 쓴다.
 */
export function 지역정규화(s: string): string {
  return s
    .replace(/\s+/g, "")
    .replace(/특별자치시|특별자치도|특별시|광역시/g, "")
    .replace(/^(충청|전라|경상)(북|남)도?/, "$1$2")
    .replace(/도$/, "");
}

/** R-ONE 분류(CLS) 후보 한 건 */
export interface 분류후보 {
  /** SttsApiTblItm.do 의 ITM_ID — SttsApiTblData.do 의 CLS_ID 로 쓴다 */
  CLS_ID: string;
  이름: string;
  전체이름: string;
}

/** 분류후보와 질의의 근접도 점수 (높을수록 가깝다. 0 이면 무관) */
export function 후보점수(질의: string, 후보: 분류후보): number {
  const { 시도, 시군구 } = 대상지분해(질의);
  const 시도n = 지역정규화(시도);
  const 시군구n = 지역정규화(시군구);
  // "성남시 분당구" 처럼 두 마디면 마지막 마디로도 견준다
  const 말단n = 지역정규화(시군구.split(/\s+/).pop() ?? "");

  const 이름n = 지역정규화(후보.이름);
  const 마디 = 후보.전체이름.split(">").map((x) => 지역정규화(x.trim()));
  const 후보말단 = 마디[마디.length - 1] || 이름n;
  const 후보상위 = 마디.length > 1 ? 마디[0] : "";

  if (!시군구n && !시도n) return 0;

  let 점수 = 0;
  if (시군구n) {
    if (이름n === 시군구n || 후보말단 === 시군구n) 점수 = 100;
    else if (말단n && (이름n === 말단n || 후보말단 === 말단n)) 점수 = 90;
    else if (시군구n.includes(이름n) || 이름n.includes(시군구n)) 점수 = 60;
    else if (말단n && (말단n.includes(이름n) || 이름n.includes(말단n))) 점수 = 55;
  }
  if (점수 === 0 && 시도n && (이름n === 시도n || 후보말단 === 시도n)) 점수 = 30;

  // 상위 마디까지 시도와 맞으면 가산 — 동명 시군구를 가른다 (예: 중구)
  if (점수 >= 55 && 시도n && 후보상위 && 후보상위 === 시도n) 점수 += 10;
  return 점수;
}

/** 후보 목록에서 가장 가까운 분류를 고른다. 없으면 null. */
export function 최근접분류(
  질의: string,
  후보목록: 분류후보[],
  최소점수 = 55,
): { 후보: 분류후보; 점수: number } | null {
  let 최고: { 후보: 분류후보; 점수: number } | null = null;
  for (const 후보 of 후보목록) {
    const 점수 = 후보점수(질의, 후보);
    if (점수 >= 최소점수 && (최고 === null || 점수 > 최고.점수)) {
      최고 = { 후보, 점수 };
    }
  }
  return 최고;
}

/**
 * 통계표의 지역 구분이 시군구 단위인지 권역 단위인지 가늠한다.
 *
 * 실제 응답으로 확인한 결과, 오피스 임대동향조사는 **권역 단위**다.
 * 분류가 3단계 계층으로 온다.
 *   전국 / 시도            (예: 서울)
 *   시도 > 권역            (예: 서울>강남, 서울>도심, 서울>여의도마포, 서울>기타)
 *   시도 > 권역 > 상권     (예: 서울>강남>테헤란로)
 * 말단이 시·군·구로 끝나지 않으므로 시군구명으로는 정확히 맞출 수 없다.
 * 그래서 시군구→권역 매핑이 따로 필요하고, 화면에서 사람이 고를 수 있어야 한다.
 */
export function 지역단위판정(후보목록: 분류후보[]): {
  단위: "시군구" | "권역" | "판정불가";
  시군구형: number;
  권역형: number;
  전체: number;
} {
  const 권역어 = /(CBD|GBD|YBD|BBD|도심|권역|기타지역|일대)/i;
  let 시군구형 = 0;
  let 권역형 = 0;
  let 계층형 = 0;
  for (const c of 후보목록) {
    const 마디 = c.전체이름.split(">");
    const 말단 = (마디[마디.length - 1] ?? c.이름).trim();
    if (마디.length > 1) 계층형 += 1;
    if (권역어.test(말단)) 권역형 += 1;
    else if (/(시|군|구)$/.test(말단)) 시군구형 += 1;
  }
  const 전체 = 후보목록.length;
  if (전체 === 0) return { 단위: "판정불가", 시군구형, 권역형, 전체 };
  if (시군구형 / 전체 >= 0.6) {
    return { 단위: "시군구", 시군구형, 권역형, 전체 };
  }
  if (권역형 > 0 || 계층형 > 0) {
    return { 단위: "권역", 시군구형, 권역형, 전체 };
  }
  return { 단위: "판정불가", 시군구형, 권역형, 전체 };
}

/**
 * 특정 시도에 속한 후보만 추린다.
 *
 * 권역 단위 통계표에서는 시군구명으로 자동 매칭이 정확할 수 없다.
 * 해당 시도의 권역 목록을 화면에 띄워 사람이 고르게 하려고 쓴다.
 * `깊이` 로 계층을 고른다 — 1=시도, 2=권역, 3=상권.
 */
export function 시도별후보(
  후보목록: 분류후보[],
  시도: string,
  깊이?: number,
): 분류후보[] {
  const 시도n = 지역정규화(시도);
  if (!시도n) return [];
  return 후보목록.filter((c) => {
    const 마디 = c.전체이름.split(">").map((x) => 지역정규화(x.trim()));
    if (마디[0] !== 시도n) return false;
    return 깊이 === undefined || 마디.length === 깊이;
  });
}

/* ─── 시점 ─────────────────────────────────────────────────── */

/**
 * 분기 자료작성시점 코드. 기술문서 예시: 202301 ~ 202304 (23년 1~4분기).
 * 분기는 2자리로 채운다.
 */
export function 분기코드(년: number, 분기: number): string {
  return `${년}${String(분기).padStart(2, "0")}`;
}

/** 기준일이 속한 분기 */
export function 분기(기준일: Date): { 년: number; 분기: number } {
  return {
    년: 기준일.getUTCFullYear(),
    분기: Math.floor(기준일.getUTCMonth() / 3) + 1,
  };
}

/**
 * 최근 n개 분기 코드를 과거→현재 순으로 만든다.
 *
 * 분기 통계는 공표에 시차가 있어 최근 분기가 아직 없을 수 있다. 한 분기를
 * 찍어 조회하지 말고 이 구간 전체를 START~END 로 넘긴 뒤 값이 있는
 * 가장 최근 분기를 쓴다.
 */
export function 최근분기목록(기준일: Date, 개수: number): string[] {
  const { 년, 분기: q } = 분기(기준일);
  const 결과: string[] = [];
  let y = 년;
  let c = q;
  for (let i = 0; i < Math.max(1, 개수); i++) {
    결과.unshift(분기코드(y, c));
    c -= 1;
    if (c === 0) {
      c = 4;
      y -= 1;
    }
  }
  return 결과;
}

/** 최근 n개월 YYYYMM 목록 (과거→현재). 실거래가 DEAL_YMD 용. */
export function 최근월목록(기준일: Date, 개수: number): string[] {
  const 결과: string[] = [];
  let y = 기준일.getUTCFullYear();
  let m = 기준일.getUTCMonth() + 1;
  for (let i = 0; i < Math.max(1, 개수); i++) {
    결과.unshift(`${y}${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return 결과;
}

/* ─── 실거래 ───────────────────────────────────────────────── */

/** 정리된 실거래 한 건 */
export interface 실거래건 {
  시군구: string;
  법정동: string;
  지번: string;
  건물유형: string;
  건물주용도: string;
  용도지역: string;
  /** YYYY-MM-DD */
  계약일: string;
  /** 거래금액 (만원) */
  거래금액만원: number;
  /** 건물면적 (㎡) */
  건물면적m2: number;
  /** 대지면적 (㎡). 값이 없으면 null */
  대지면적m2: number | null;
  층: string;
  건축년도: string;
  거래유형: string;
}

export interface 제외집계 {
  사유: string;
  건수: number;
}

export interface 실거래정리결과 {
  건: 실거래건[];
  /** 걸러내기 전 원본 건수 */
  전체건수: number;
  제외: 제외집계[];
}

/** "40,000" → 40000. 숫자가 아니면 null. */
export function 거래금액파싱(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function 숫자또는null(s: string | undefined): number | null {
  if (s === undefined) return null;
  const n = Number(String(s).replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 실거래 응답을 걸러 정리한다.
 *
 * 제외 기준을 버리지 않고 사유별로 세어 둔다 — 대주단 자료에는 "몇 건 중 몇 건을
 * 왜 뺐는지"가 함께 실려야 한다.
 *
 * 해제여부 필드는 기술문서 응답명세에 `cdealtype`, 예제에 `<cdealType>` 로
 * 대소문자가 엇갈려 있어 둘 다 본다.
 * [확인 필요] 해제여부의 값 정의(O/Y 등)는 문서에 없다. 공백이 아니면 해제로 본다.
 *
 * 용도 필터는 실제 응답에서 확인한 값으로 잡는다. 기술문서 샘플이 "제2종근린생활"
 * 이듯 buildingUse 는 짧은 이름으로 온다. 업무시설은 **"업무"** 로 온다 —
 * "업무시설" 로 거르면 한 건도 남지 않는다.
 */
export function 실거래정리(
  items: Record<string, string>[],
  옵션: { 용도필터?: string[]; 용도라벨?: string } = {},
): 실거래정리결과 {
  const 용도필터 = 옵션.용도필터 ?? ["업무"];
  const 용도라벨 = 옵션.용도라벨 ?? 용도필터.join("·");
  const 건: 실거래건[] = [];
  const 세기 = new Map<string, number>();
  const 더하기 = (사유: string) =>
    세기.set(사유, (세기.get(사유) ?? 0) + 1);

  for (const it of items) {
    const 해제 = (it.cdealtype ?? it.cdealType ?? "").trim();
    if (해제 !== "") {
      더하기("해제된 거래");
      continue;
    }
    const 용도 = (it.buildingUse ?? "").trim();
    if (용도필터.length > 0 && !용도필터.some((u) => 용도.includes(u))) {
      더하기(`${용도라벨} 외 용도`);
      continue;
    }
    const 금액 = 거래금액파싱(it.dealAmount);
    if (금액 === null) {
      더하기("거래금액 없음");
      continue;
    }
    const 면적 = 숫자또는null(it.buildingAr);
    if (면적 === null) {
      더하기("건물면적 없음");
      continue;
    }
    const 년 = (it.dealYear ?? "").trim();
    const 월 = (it.dealMonth ?? "").trim().padStart(2, "0");
    const 일 = (it.dealDay ?? "").trim().padStart(2, "0");

    건.push({
      시군구: (it.sggNm ?? "").trim(),
      법정동: (it.umdNm ?? "").trim(),
      지번: (it.jibun ?? "").trim(),
      건물유형: (it.buildingType ?? "").trim(),
      건물주용도: 용도,
      용도지역: (it.landUse ?? "").trim(),
      계약일: 년 ? `${년}-${월}-${일}` : "",
      거래금액만원: 금액,
      건물면적m2: 면적,
      대지면적m2: 숫자또는null(it.plottageAr),
      층: (it.floor ?? "").trim(),
      건축년도: (it.buildYear ?? "").trim(),
      거래유형: (it.dealingGbn ?? "").trim(),
    });
  }

  return {
    건,
    전체건수: items.length,
    제외: [...세기.entries()].map(([사유, 건수]) => ({ 사유, 건수 })),
  };
}

/**
 * 법정동코드 응답에서 시군구 단위 행만 고른다.
 *
 * region_cd 10자리 = 시도(2) + 시군구(3) + 읍면동(3) + 리(2).
 * 시군구 레벨은 시군구코드가 000 이 아니고 읍면동·리가 모두 0 인 행이다.
 */
export function 시군구행만(
  rows: Record<string, string>[],
): Record<string, string>[] {
  return rows.filter(
    (r) =>
      (r.sgg_cd ?? "") !== "000" &&
      (r.sgg_cd ?? "") !== "" &&
      (r.umd_cd ?? "000") === "000" &&
      (r.ri_cd ?? "00") === "00",
  );
}

/** 법정동코드 10자리 중 실거래가 조회에 쓰는 앞 5자리 */
export function 지역코드5(region_cd: string): string {
  return (region_cd ?? "").trim().slice(0, 5);
}

/* ─── 상권 후보 추림 ───────────────────────────────────────── */

/**
 * 시군구명에서 상권명과 견줄 핵심어를 뽑는다.
 * 상권명은 "강남대로"·"여의도" 처럼 행정구역 접미사가 없으므로 시/군/구를 뗀다.
 * "성남시 분당구" 처럼 두 마디면 말단을 쓴다.
 */
export function 상권핵심어(시군구: string): string {
  const 말단 = (시군구.trim().split(/\s+/).pop() ?? "").trim();
  const n = 지역정규화(말단);
  const 벗김 = n.replace(/(특별자치시|특별자치도|시|군|구)$/, "");
  return 벗김.length >= 2 ? 벗김 : n;
}

/** 분류의 계층 깊이 — 1=전국·시도, 2=권역 또는 비서울 상권, 3=서울 상권 */
export function 분류깊이(후보: 분류후보): number {
  return (후보.전체이름 || 후보.이름).split(">").length;
}

/**
 * 시군구명과 상권명의 부분일치 점수.
 *
 * 오피스 통계표의 말단은 상권명이라 시군구명과 정확히 같을 수 없다.
 * 그래서 "포함 관계"에 우선순위를 두고 점수를 매긴다.
 *   "강남구" → "강남"(권역, 정확) > "강남대로"(상권, 접두) > "논현역"(무관)
 * 시도가 다른 동명 상권은 크게 깎아 후보에서 밀어낸다.
 */
export function 상권후보점수(질의: string, 후보: 분류후보): number {
  const { 시도, 시군구 } = 대상지분해(질의);
  const 핵심 = 상권핵심어(시군구);
  if (!핵심) return 0;

  const 마디 = (후보.전체이름 || 후보.이름)
    .split(">")
    .map((x) => 지역정규화(x.trim()));
  const 말단 = 마디[마디.length - 1] ?? "";
  const 상위 = 마디[0] ?? "";
  const 시도n = 지역정규화(시도);

  let 점수 = 0;
  if (말단 === 핵심) 점수 = 100;
  else if (말단.startsWith(핵심)) 점수 = 90;
  else if (말단.includes(핵심)) 점수 = 80;
  else if (핵심.length >= 2 && 말단.length >= 2 && 핵심.includes(말단)) 점수 = 70;
  if (점수 === 0) return 0;

  // 같은 시도 안이면 가산, 다른 시도면 크게 깎는다 (동명 상권 구분)
  if (시도n && 마디.length > 1) 점수 += 상위 === 시도n ? 5 : -40;
  return Math.max(0, 점수);
}

/** 추천 후보 한 건 */
export interface 상권후보 extends 분류후보 {
  점수: number;
  깊이: number;
}

/**
 * 부분일치 우선순위로 상권 후보를 3~5개 추린다.
 * 최종 확정은 사람이 한다 — 여기서 고른 것은 "추천"일 뿐이다.
 */
export function 상권후보추리기(
  질의: string,
  후보목록: 분류후보[],
  최대 = 5,
): 상권후보[] {
  return 후보목록
    .map((c) => ({ ...c, 점수: 상권후보점수(질의, c), 깊이: 분류깊이(c) }))
    .filter((c) => c.점수 > 0)
    .sort((a, b) => b.점수 - a.점수 || a.깊이 - b.깊이)
    .slice(0, Math.max(1, 최대));
}

/**
 * 드롭다운에 채울 목록 — 해당 시도의 권역·상권 전부 (전국·시도 자체는 뺀다).
 * 자동 추림이 비었을 때도 사람이 고를 수 있어야 한다.
 */
export function 시도상권목록(
  후보목록: 분류후보[],
  시도: string,
): 상권후보[] {
  return 시도별후보(후보목록, 시도)
    .filter((c) => 분류깊이(c) >= 2)
    .map((c) => ({ ...c, 점수: 0, 깊이: 분류깊이(c) }))
    .sort((a, b) => a.깊이 - b.깊이 || a.전체이름.localeCompare(b.전체이름));
}
