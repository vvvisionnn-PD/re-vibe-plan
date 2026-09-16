/**
 * lib/marketParse.ts 검산 — `node --test`.
 *
 * XML 픽스처는 전부 api_docs 기술문서의 **응답 예제를 그대로 옮긴 것**이다.
 * 지어낸 응답이 아니라, 파서가 실제 필드명·구조와 어긋나면 여기서 깨진다.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  거래금액파싱,
  대상지분해,
  법정동판정,
  분기코드,
  시군구행만,
  실거래정리,
  실거래판정,
  지역단위판정,
  지역정규화,
  지역코드5,
  최근분기목록,
  최근월목록,
  분류깊이,
  상권핵심어,
  상권후보추리기,
  시도별후보,
  시도상권목록,
  최근접분류,
  후보점수,
  reb판정,
  xml값,
  xml행목록,
} from "./marketParse.ts";
import type { 분류후보 } from "./marketParse.ts";

/** 기술문서 예제: SttsApiTblItm.do (ITM_TAG=분류) */
const 분류응답 = `<SttsApiTblItm>
<head>
<list_total_count>5476</list_total_count>
<RESULT><CODE>INFO-000</CODE><MESSAGE>정상 처리되었습니다.</MESSAGE></RESULT>
</head>
<row>
<STATBL_ID>A_2024_00900</STATBL_ID><ITM_TAG>분류</ITM_TAG><ITM_ID>500001</ITM_ID>
<PAR_ITM_ID>0</PAR_ITM_ID><ITM_NM>전국</ITM_NM><ITM_FULLNM>전국</ITM_FULLNM>
<UI_NM/><ITM_CMMT_IDTFR/><ITM_CMMT_CONT/><V_ORDER>1</V_ORDER>
</row>
<row>
<STATBL_ID>A_2024_00900</STATBL_ID><ITM_TAG>분류</ITM_TAG><ITM_ID>500002</ITM_ID>
<PAR_ITM_ID>0</PAR_ITM_ID><ITM_NM>수도권</ITM_NM><ITM_FULLNM>수도권</ITM_FULLNM>
<UI_NM/><ITM_CMMT_IDTFR/><ITM_CMMT_CONT/><V_ORDER>2</V_ORDER>
</row>
</SttsApiTblItm>`;

/** 기술문서 예제: SttsApiTblData.do */
const 통계응답 = `<SttsApiTblData>
<head><list_total_count>2</list_total_count>
<RESULT><CODE>INFO-000</CODE><MESSAGE>정상 처리되었습니다.</MESSAGE></RESULT></head>
<row>
<STATBL_ID>A_2024_00900</STATBL_ID><DTACYCLE_CD>YY</DTACYCLE_CD>
<WRTTIME_IDTFR_ID>2022</WRTTIME_IDTFR_ID><GRP_ID/><GRP_NM/>
<CLS_ID>510008</CLS_ID><CLS_NM>종로구</CLS_NM><ITM_ID>100001</ITM_ID><ITM_NM>지수</ITM_NM>
<DTA_VAL>99.176</DTA_VAL><UI_NM>지수</UI_NM><GRP_FULLNM/>
<CLS_FULLNM>서울>종로구</CLS_FULLNM><ITM_FULLNM>지수</ITM_FULLNM>
</row>
<row>
<STATBL_ID>A_2024_00900</STATBL_ID><DTACYCLE_CD>YY</DTACYCLE_CD>
<WRTTIME_IDTFR_ID>2023</WRTTIME_IDTFR_ID><GRP_ID/><GRP_NM/>
<CLS_ID>510008</CLS_ID><CLS_NM>종로구</CLS_NM><ITM_ID>100001</ITM_ID><ITM_NM>지수</ITM_NM>
<DTA_VAL>100</DTA_VAL><UI_NM>지수</UI_NM><GRP_FULLNM/>
<CLS_FULLNM>서울>종로구</CLS_FULLNM><ITM_FULLNM>지수</ITM_FULLNM>
</row>
</SttsApiTblData>`;

/** 기술문서 예제: StanReginCd/getStanReginCdList */
const 법정동응답 = `<StanReginCd>
<head><totalCount>1</totalCount><numOfRows>3</numOfRows><pageNo>1</pageNo><type>XML</type>
<RESULT><resultCode>INFO-0</resultCode><resultMsg>NOMAL SERVICE</resultMsg></RESULT></head>
<row>
<region_cd>1100000000</region_cd><sido_cd>11</sido_cd><sgg_cd>000</sgg_cd>
<umd_cd>000</umd_cd><ri_cd>00</ri_cd><locatjumin_cd>1100000000</locatjumin_cd>
<locatjijuk_cd>1100000000</locatjijuk_cd><locatadd_nm>서울특별시</locatadd_nm>
<locat_order>11</locat_order><locat_rm/><locathigh_cd>0000000000</locathigh_cd>
<locallow_nm>서울특별시</locallow_nm><adpt_de>20000101</adpt_de>
</row>
<row>
<region_cd>1111000000</region_cd><sido_cd>11</sido_cd><sgg_cd>110</sgg_cd>
<umd_cd>000</umd_cd><ri_cd>00</ri_cd><locatadd_nm>서울특별시 종로구</locatadd_nm>
<locathigh_cd>1100000000</locathigh_cd><locallow_nm>종로구</locallow_nm>
</row>
<row>
<region_cd>1111010100</region_cd><sido_cd>11</sido_cd><sgg_cd>110</sgg_cd>
<umd_cd>101</umd_cd><ri_cd>00</ri_cd><locatadd_nm>서울특별시 종로구 청운동</locatadd_nm>
<locathigh_cd>1111000000</locathigh_cd><locallow_nm>청운동</locallow_nm>
</row>
</StanReginCd>`;

/** 기술문서 예제: getRTMSDataSvcNrgTrade */
const 실거래응답 = `<response>
<header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>
<body><items>
<item>
<buildYear>2007</buildYear><buildingAr>60.38</buildingAr><buildingType>집합</buildingType>
<buildingUse>제2종근린생활</buildingUse><buyerGbn>개인</buyerGbn><cdealDay> </cdealDay>
<cdealType> </cdealType><dealAmount>40,000</dealAmount><dealDay>30</dealDay>
<dealMonth>7</dealMonth><dealYear>2024</dealYear><dealingGbn>중개거래</dealingGbn>
<estateAgentSggNm>경기 용인시 수지구</estateAgentSggNm><jibun>24</jibun>
<landUse>일반상업</landUse><plottageAr> </plottageAr><sggCd>11110</sggCd>
<sggNm>종로구</sggNm><shareDealingType/><slerGbn>개인</slerGbn><umdNm>종로1가</umdNm>
</item>
</items><numOfRows>1</numOfRows><pageNo>1</pageNo><totalCount>123</totalCount></body>
</response>`;

describe("XML 파싱", () => {
  it("단일 값을 꺼낸다", () => {
    assert.equal(xml값(통계응답, "CODE"), "INFO-000");
    assert.equal(xml값(실거래응답, "totalCount"), "123");
  });

  it("빈 요소는 빈 문자열, 없는 요소는 null", () => {
    assert.equal(xml값("<a><b/></a>", "b"), "");
    assert.equal(xml값("<a></a>", "zzz"), null);
  });

  it("반복 블록을 레코드 배열로 바꾼다", () => {
    const rows = xml행목록(통계응답, "row");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].WRTTIME_IDTFR_ID, "2022");
    assert.equal(rows[0].DTA_VAL, "99.176");
    assert.equal(rows[1].DTA_VAL, "100");
  });

  it("값 안에 > 가 있어도 끊기지 않는다 (CLS_FULLNM)", () => {
    // 기술문서 예제가 서울>종로구 를 이스케이프 없이 쓴다
    const rows = xml행목록(통계응답, "row");
    assert.equal(rows[0].CLS_FULLNM, "서울>종로구");
  });

  it("빈 요소는 빈 문자열로 담는다", () => {
    const rows = xml행목록(통계응답, "row");
    assert.equal(rows[0].GRP_ID, "");
  });

  it("분류 응답의 ITM_ID 를 읽는다 (CLS_ID 로 쓸 값)", () => {
    const rows = xml행목록(분류응답, "row");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].ITM_ID, "500001");
    assert.equal(rows[0].ITM_NM, "전국");
  });
});

describe("응답 판정", () => {
  it("R-ONE 정상은 INFO-000", () => {
    const r = reb판정(통계응답);
    assert.equal(r.성공, true);
    assert.equal(r.자료없음, false);
    assert.equal(r.코드, "INFO-000");
  });

  it("R-ONE 자료 없음은 INFO-200", () => {
    const r = reb판정("<x><RESULT><CODE>INFO-200</CODE><MESSAGE>해당하는 데이터가 없습니다.</MESSAGE></RESULT></x>");
    assert.equal(r.성공, false);
    assert.equal(r.자료없음, true);
  });

  it("R-ONE 인증키 오류는 실패로 본다", () => {
    const r = reb판정("<x><RESULT><CODE>ERROR-290</CODE><MESSAGE>인증키가 유효하지 않습니다.</MESSAGE></RESULT></x>");
    assert.equal(r.성공, false);
    assert.equal(r.자료없음, false);
  });

  it("법정동코드 정상은 INFO-0", () => {
    const r = 법정동판정(법정동응답);
    assert.equal(r.성공, true);
    assert.equal(r.메시지, "NOMAL SERVICE");
  });

  it("실거래 정상은 000", () => {
    const r = 실거래판정(실거래응답);
    assert.equal(r.성공, true);
    assert.equal(r.메시지, "OK");
  });

  it("실거래 03 은 데이터 없음", () => {
    const r = 실거래판정("<response><header><resultCode>03</resultCode><resultMsg>NO DATA</resultMsg></header></response>");
    assert.equal(r.자료없음, true);
  });
});

describe("지역 매칭", () => {
  const 후보 = (CLS_ID: string, 이름: string, 전체이름: string): 분류후보 => ({
    CLS_ID,
    이름,
    전체이름,
  });

  it("사업대상지를 시도와 시군구로 나눈다", () => {
    assert.deepEqual(대상지분해("서울특별시 강남구"), {
      시도: "서울특별시",
      시군구: "강남구",
    });
    assert.deepEqual(대상지분해("경기도 성남시 분당구"), {
      시도: "경기도",
      시군구: "성남시 분당구",
    });
    assert.deepEqual(대상지분해(""), { 시도: "", 시군구: "" });
  });

  it("정식 명칭과 축약 명칭을 같은 꼴로 만든다", () => {
    assert.equal(지역정규화("서울특별시"), "서울");
    assert.equal(지역정규화("세종특별자치시"), "세종");
    assert.equal(지역정규화("경기도"), "경기");
    assert.equal(지역정규화(" 강남구 "), "강남구");
  });

  it("정확히 같은 시군구가 가장 높은 점수를 받는다", () => {
    const a = 후보("510008", "종로구", "서울>종로구");
    const b = 후보("500001", "전국", "전국");
    assert.ok(후보점수("서울특별시 종로구", a) > 후보점수("서울특별시 종로구", b));
  });

  it("시도가 다른 동명 시군구보다 같은 시도를 고른다", () => {
    const 서울중구 = 후보("1", "중구", "서울>중구");
    const 부산중구 = 후보("2", "중구", "부산>중구");
    const 목록 = [부산중구, 서울중구];
    assert.equal(최근접분류("서울특별시 중구", 목록)?.후보.CLS_ID, "1");
    assert.equal(최근접분류("부산광역시 중구", 목록)?.후보.CLS_ID, "2");
  });

  it("일반구가 있는 시군구는 말단 마디로도 찾는다", () => {
    const 분당 = 후보("3", "분당구", "경기>성남시>분당구");
    assert.ok(후보점수("경기도 성남시 분당구", 분당) >= 90);
  });

  it("관련 없는 후보만 있으면 null 을 돌려준다", () => {
    const 목록 = [후보("9", "전국", "전국"), 후보("8", "수도권", "수도권")];
    assert.equal(최근접분류("서울특별시 강남구", 목록), null);
  });

  it("기술문서 분류 응답에서 후보를 만들어 매칭한다", () => {
    const 목록 = xml행목록(분류응답, "row").map((r) =>
      후보(r.ITM_ID, r.ITM_NM, r.ITM_FULLNM),
    );
    assert.equal(목록.length, 2);
    // 전국·수도권만 있으므로 시군구 질의에는 해당 없음
    assert.equal(최근접분류("서울특별시 종로구", 목록), null);
  });
});

describe("지역 단위 판정 — 시군구인지 권역인지", () => {
  const 후보 = (이름: string, 전체이름 = 이름) => ({
    CLS_ID: "x",
    이름,
    전체이름,
  });

  it("시군구 이름이 대부분이면 시군구 단위로 본다", () => {
    const r = 지역단위판정([
      후보("종로구", "서울>종로구"),
      후보("중구", "서울>중구"),
      후보("강남구", "서울>강남구"),
    ]);
    assert.equal(r.단위, "시군구");
    assert.equal(r.시군구형, 3);
  });

  it("CBD/GBD/YBD 같은 권역명이 있으면 권역 단위로 본다", () => {
    const r = 지역단위판정([
      후보("도심(CBD)", "서울>도심(CBD)"),
      후보("강남(GBD)", "서울>강남(GBD)"),
      후보("여의도(YBD)", "서울>여의도(YBD)"),
    ]);
    assert.equal(r.단위, "권역");
    assert.equal(r.권역형, 3);
  });

  it("빈 목록은 판정불가", () => {
    assert.equal(지역단위판정([]).단위, "판정불가");
  });
});

describe("시점", () => {
  it("분기 코드는 YYYY + 2자리 분기다", () => {
    // 기술문서 예시: 202301 ~ 202304 (23년 1분기~4분기)
    assert.equal(분기코드(2023, 1), "202301");
    assert.equal(분기코드(2023, 4), "202304");
  });

  it("최근 분기 목록은 과거→현재 순이고 연도를 넘어간다", () => {
    const 목록 = 최근분기목록(new Date(Date.UTC(2025, 1, 15)), 5); // 2025년 1분기
    assert.deepEqual(목록, ["202401", "202402", "202403", "202404", "202501"]);
  });

  it("최근 월 목록도 연도를 넘어간다", () => {
    const 목록 = 최근월목록(new Date(Date.UTC(2025, 0, 10)), 3); // 2025-01
    assert.deepEqual(목록, ["202411", "202412", "202501"]);
  });

  it("최근 1년은 12개월이다", () => {
    assert.equal(최근월목록(new Date(Date.UTC(2025, 5, 1)), 12).length, 12);
  });
});

describe("법정동코드", () => {
  it("시군구 레벨 행만 고른다", () => {
    const rows = xml행목록(법정동응답, "row");
    assert.equal(rows.length, 3);
    const 시군구 = 시군구행만(rows);
    // 시도(1100000000)와 읍면동(1111010100)은 빠지고 종로구만 남는다
    assert.equal(시군구.length, 1);
    assert.equal(시군구[0].locatadd_nm, "서울특별시 종로구");
  });

  it("실거래 조회용 지역코드는 앞 5자리다", () => {
    assert.equal(지역코드5("1111000000"), "11110");
  });
});

describe("실거래 정리", () => {
  const items = xml행목록(실거래응답, "item");

  it("기술문서 예제를 항목별로 읽는다", () => {
    assert.equal(items.length, 1);
    assert.equal(items[0].dealAmount, "40,000");
    assert.equal(items[0].buildingAr, "60.38");
    assert.equal(items[0].buildingUse, "제2종근린생활");
  });

  it("거래금액의 천단위 콤마를 푼다", () => {
    assert.equal(거래금액파싱("40,000"), 40000);
    assert.equal(거래금액파싱(""), null);
    assert.equal(거래금액파싱(undefined), null);
    assert.equal(거래금액파싱("-"), null);
  });

  it("업무시설이 아닌 거래는 사유와 함께 제외한다", () => {
    const r = 실거래정리(items, { 용도필터: ["업무"], 용도라벨: "업무시설" });
    assert.equal(r.전체건수, 1);
    assert.equal(r.건.length, 0);
    assert.deepEqual(r.제외, [{ 사유: "업무시설 외 용도", 건수: 1 }]);
  });

  it("용도필터를 풀면 남고 필드가 채워진다", () => {
    const r = 실거래정리(items, { 용도필터: [] });
    assert.equal(r.건.length, 1);
    const 건 = r.건[0];
    assert.equal(건.거래금액만원, 40000);
    assert.equal(건.건물면적m2, 60.38);
    assert.equal(건.계약일, "2024-07-30");
    assert.equal(건.시군구, "종로구");
    assert.equal(건.법정동, "종로1가");
    // 공백만 든 plottageAr 은 null 이어야 한다 (0 으로 만들지 말 것)
    assert.equal(건.대지면적m2, null);
  });

  it("해제된 거래를 제외한다 (cdealtype·cdealType 둘 다)", () => {
    for (const 필드 of ["cdealtype", "cdealType"]) {
      const r = 실거래정리(
        [{ [필드]: "O", buildingUse: "업무", dealAmount: "10,000", buildingAr: "100" }],
        { 용도필터: ["업무"], 용도라벨: "업무시설" },
      );
      assert.equal(r.건.length, 0);
      assert.deepEqual(r.제외, [{ 사유: "해제된 거래", 건수: 1 }]);
    }
  });

  it("건물면적이나 금액이 없으면 사유별로 센다", () => {
    const r = 실거래정리(
      [
        { buildingUse: "업무", dealAmount: "", buildingAr: "100" },
        { buildingUse: "업무", dealAmount: "10,000", buildingAr: " " },
        { buildingUse: "업무", dealAmount: "20,000", buildingAr: "200" },
      ],
      { 용도필터: ["업무"], 용도라벨: "업무시설" },
    );
    assert.equal(r.건.length, 1);
    assert.equal(r.전체건수, 3);
    assert.deepEqual(
      r.제외.sort((a, b) => a.사유.localeCompare(b.사유)),
      [
        { 사유: "거래금액 없음", 건수: 1 },
        { 사유: "건물면적 없음", 건수: 1 },
      ],
    );
  });
});

describe("오피스 통계표의 실제 지역 분류 (권역 단위)", () => {
  /**
   * 실제 R-ONE 응답(STATBL_ID=TT249843134237374)에서 관찰한 계층 구조다.
   * 전국/시도 → 권역 → 상권 3단계이며 말단이 시·군·구로 끝나지 않는다.
   */
  const 실제후보: 분류후보[] = [
    { CLS_ID: "500001", 이름: "전국", 전체이름: "전국" },
    { CLS_ID: "500002", 이름: "서울", 전체이름: "서울" },
    { CLS_ID: "500009", 이름: "경기", 전체이름: "경기" },
    { CLS_ID: "510003", 이름: "도심", 전체이름: "서울>도심" },
    { CLS_ID: "510004", 이름: "강남", 전체이름: "서울>강남" },
    { CLS_ID: "510005", 이름: "여의도마포", 전체이름: "서울>여의도마포" },
    { CLS_ID: "510006", 이름: "기타", 전체이름: "서울>기타" },
    { CLS_ID: "520019", 이름: "테헤란로", 전체이름: "서울>강남>테헤란로" },
    { CLS_ID: "520010", 이름: "종로", 전체이름: "서울>도심>종로" },
    { CLS_ID: "520062", 이름: "분당역세권", 전체이름: "경기>분당역세권" },
  ];

  it("시군구가 아니라 권역 단위로 판정한다", () => {
    const r = 지역단위판정(실제후보);
    assert.equal(r.단위, "권역");
    assert.equal(r.시군구형, 0);
  });

  it("강남구는 서울>강남 으로 붙지만 정확 일치는 아니다", () => {
    const 최근접 = 최근접분류("서울특별시 강남구", 실제후보);
    assert.equal(최근접?.후보.CLS_ID, "510004");
    // 포함 관계로 붙은 것이라 100점이 아니다 — 화면에서 확인을 받아야 한다
    assert.ok(최근접!.점수 < 100);
  });

  it("서초구는 대응 권역 이름이 없어 자동으로 붙지 않는다", () => {
    // 실제로는 서울>강남 권역에 속하지만, 통계표 이름만으로는 알 수 없다.
    // 시군구→권역 매핑은 근거 자료로 따로 확인해야 한다.
    assert.equal(최근접분류("서울특별시 서초구", 실제후보), null);
  });

  it("시도별 후보를 깊이별로 추린다 (화면의 권역 선택용)", () => {
    const 서울권역 = 시도별후보(실제후보, "서울특별시", 2);
    assert.deepEqual(
      서울권역.map((c) => c.이름),
      ["도심", "강남", "여의도마포", "기타"],
    );
    const 서울상권 = 시도별후보(실제후보, "서울특별시", 3);
    assert.deepEqual(서울상권.map((c) => c.이름), ["테헤란로", "종로"]);
    assert.equal(시도별후보(실제후보, "경기도", 2).length, 1);
  });

  it("시도가 비면 빈 목록", () => {
    assert.deepEqual(시도별후보(실제후보, ""), []);
  });
});

describe("법정동코드 실제 응답 코드", () => {
  it("INFO-3 도 자료 없음으로 본다 (문서 코드표에 없지만 실제로 온다)", () => {
    const r = 법정동판정(
      "<StanReginCd><RESULT><resultCode>INFO-3</resultCode><resultMsg>데이터없음 에러</resultMsg></RESULT></StanReginCd>",
    );
    assert.equal(r.성공, false);
    assert.equal(r.자료없음, true);
  });
});

describe("실거래 용도 값은 짧은 이름으로 온다", () => {
  /** 실제 응답(LAWD_CD=11680)에서 관찰한 buildingUse 값들 */
  const 실제용도 = [
    "제2종근린생활",
    "제1종근린생활",
    "업무",
    "판매",
    "기타",
    "숙박",
    "교육연구",
  ];

  const 건들 = 실제용도.map((용도, i) => ({
    buildingUse: 용도,
    dealAmount: "10,000",
    buildingAr: "100",
    dealYear: "2026",
    dealMonth: String(i + 1),
    dealDay: "1",
  }));

  it('"업무시설" 로 거르면 한 건도 남지 않는다 (회귀 방지)', () => {
    const r = 실거래정리(건들, { 용도필터: ["업무시설"] });
    assert.equal(r.건.length, 0);
  });

  it('"업무" 로 걸러야 업무시설 거래가 남는다', () => {
    const r = 실거래정리(건들, { 용도필터: ["업무"], 용도라벨: "업무시설" });
    assert.equal(r.건.length, 1);
    assert.equal(r.건[0].건물주용도, "업무");
    assert.deepEqual(r.제외, [{ 사유: "업무시설 외 용도", 건수: 6 }]);
  });

  it("기본 용도필터가 업무다", () => {
    assert.equal(실거래정리(건들).건.length, 1);
  });
});

describe("상권 후보 추림 (권역 단위 통계표용)", () => {
  /** 실제 응답(2024년3분기~ 오피스 시리즈)에서 관찰한 상권명들 */
  const 상권: 분류후보[] = [
    { CLS_ID: "500001", 이름: "전국", 전체이름: "전국" },
    { CLS_ID: "500002", 이름: "서울", 전체이름: "서울" },
    { CLS_ID: "510003", 이름: "도심", 전체이름: "서울>도심" },
    { CLS_ID: "510004", 이름: "강남", 전체이름: "서울>강남" },
    { CLS_ID: "510005", 이름: "여의도마포", 전체이름: "서울>여의도마포" },
    { CLS_ID: "510006", 이름: "기타", 전체이름: "서울>기타" },
    { CLS_ID: "520013", 이름: "강남대로", 전체이름: "서울>강남>강남대로" },
    { CLS_ID: "520019", 이름: "테헤란로", 전체이름: "서울>강남>테헤란로" },
    { CLS_ID: "520023", 이름: "여의도", 전체이름: "서울>여의도마포>여의도" },
    { CLS_ID: "520030", 이름: "잠실/송파", 전체이름: "서울>기타>잠실/송파" },
    { CLS_ID: "520062", 이름: "분당역세권", 전체이름: "경기>분당역세권" },
  ];

  it("시군구명에서 행정구역 접미사를 뗀다", () => {
    assert.equal(상권핵심어("강남구"), "강남");
    assert.equal(상권핵심어("성남시 분당구"), "분당");
    assert.equal(상권핵심어("수원시"), "수원");
    // 한 글자만 남으면 원래 이름을 쓴다
    assert.equal(상권핵심어("중구"), "중구");
  });

  it("강남구 → 강남 권역이 1순위, 강남대로가 뒤따른다", () => {
    const 추천 = 상권후보추리기("서울특별시 강남구", 상권, 5);
    assert.equal(추천[0].CLS_ID, "510004");
    assert.ok(추천.map((c) => c.이름).includes("강남대로"));
    // 이름에 "강남"이 든 것만 올라온다
    assert.ok(추천.every((c) => c.이름.includes("강남")));
  });

  it("송파구는 잠실/송파 상권을 찾아낸다", () => {
    const 추천 = 상권후보추리기("서울특별시 송파구", 상권, 5);
    assert.equal(추천[0].CLS_ID, "520030");
  });

  it("영등포구는 여의도 계열을 못 찾는다 (이름이 겹치지 않음)", () => {
    // 실제로는 여의도마포 권역이지만 이름만으로는 알 수 없다 → 드롭다운으로 사람이 고른다
    assert.equal(상권후보추리기("서울특별시 영등포구", 상권).length, 0);
  });

  it("다른 시도의 동명 상권은 밀려난다", () => {
    const 추천 = 상권후보추리기("경기도 성남시 분당구", 상권, 5);
    assert.equal(추천[0].CLS_ID, "520062");
  });

  it("추천 개수는 최대치를 넘지 않는다", () => {
    assert.ok(상권후보추리기("서울특별시 강남구", 상권, 3).length <= 3);
  });

  it("드롭다운 목록은 시도의 권역·상권만 담고 얕은 것부터 온다", () => {
    const 목록 = 시도상권목록(상권, "서울특별시");
    assert.ok(목록.every((c) => c.깊이 >= 2));
    assert.ok(!목록.some((c) => c.이름 === "전국" || c.이름 === "서울"));
    assert.equal(목록[0].깊이, 2);
    // 영등포구처럼 자동 추림이 비어도 고를 수 있어야 한다
    assert.ok(목록.length >= 8);
  });

  it("분류 깊이를 센다", () => {
    assert.equal(분류깊이({ CLS_ID: "x", 이름: "서울", 전체이름: "서울" }), 1);
    assert.equal(분류깊이({ CLS_ID: "x", 이름: "강남", 전체이름: "서울>강남" }), 2);
    assert.equal(
      분류깊이({ CLS_ID: "x", 이름: "테헤란로", 전체이름: "서울>강남>테헤란로" }),
      3,
    );
  });
});
