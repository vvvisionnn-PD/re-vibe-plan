"use client";

/**
 * Ⅱ. 임대시장 분석 — 공공데이터로 채운다.
 *
 * 브라우저는 **지역 이름만** 서버로 보낸다. 법정동코드와 CLS_ID 확인은 서버에서만 한다.
 * 시장값으로 계획값을 자동 대체하지 않는다. 나란히 놓고 괴리를 보여줄 뿐이다.
 */

import { useState } from "react";

import {
  상권구획도,
  평당가여유계산,
  공실률비교표,
  수익률비교표,
  순영업소득비교표,
  시장대비여유계산,
  실거래비교표,
  임대료비교표,
} from "../lib/market";
import type {
  상권선택지,
  지역해석,
  비교행,
  실거래응답,
  시장지표응답,
  지표종류,
  표메타,
} from "../lib/market";
import type { 사업계획입력 } from "../lib/calc";
import { 대상지전체이름 } from "../lib/regions";
import { PyeongPriceChart } from "./charts/PyeongPriceChart";

/* ─── 상태 ─────────────────────────────────────────────────── */

type 작업키 = 지표종류 | "실거래";

const 작업목록: 작업키[] = [
  "임대료",
  "공실률",
  "순영업소득",
  "수익률",
  "실거래",
];

const 라우트: Record<작업키, string> = {
  임대료: "/api/market/office-rent",
  공실률: "/api/market/office-vacancy",
  순영업소득: "/api/market/office-noi",
  수익률: "/api/market/office-yield",
  실거래: "/api/market/office-transactions",
};

interface 작업상태 {
  상태: "대기" | "진행" | "완료" | "실패";
  지표?: 시장지표응답;
  실거래?: 실거래응답;
  오류?: string;
}

type 작업표 = Record<작업키, 작업상태>;

function 초기작업(): 작업표 {
  return {
    임대료: { 상태: "대기" },
    공실률: { 상태: "대기" },
    순영업소득: { 상태: "대기" },
    수익률: { 상태: "대기" },
    실거래: { 상태: "대기" },
  };
}

/* ─── 표시 도우미 ──────────────────────────────────────────── */

function 콤마(값: number | null, 자리 = 2): string {
  if (값 === null || !Number.isFinite(값)) return "-";
  return 값.toLocaleString("ko-KR", {
    minimumFractionDigits: 자리,
    maximumFractionDigits: 자리,
  });
}

/** "202602" → "2026년 2분기", "2025" → "2025년" */
function 시점표기(시점: string | null): string {
  if (!시점) return "자료 없음";
  if (/^\d{4}$/.test(시점)) return `${시점}년`;
  if (/^\d{6}$/.test(시점)) {
    const 년 = 시점.slice(0, 4);
    const 뒤 = Number(시점.slice(4));
    return 뒤 >= 1 && 뒤 <= 4 ? `${년}년 ${뒤}분기` : `${년}년 ${뒤}월`;
  }
  return 시점;
}

/** 진행 표시 한 칸 */
function 진행칩({ 이름, 상태 }: { 이름: string; 상태: 작업상태 }) {
  const 색 =
    상태.상태 === "완료"
      ? "border-positive/40 bg-positive/10 text-positive"
      : 상태.상태 === "실패"
        ? "border-negative/40 bg-negative/10 text-negative"
        : 상태.상태 === "진행"
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-line bg-surface-alt text-muted";

  let 꼬리 = "대기";
  if (상태.상태 === "진행") 꼬리 = "조회 중…";
  else if (상태.상태 === "실패") 꼬리 = "실패";
  else if (상태.상태 === "완료") {
    꼬리 = 상태.실거래
      ? `${상태.실거래.건수.toLocaleString("ko-KR")}건`
      : 시점표기(상태.지표?.메타.기준시점 ?? null);
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${색}`}
    >
      {이름} <span className="tnum opacity-80">{꼬리}</span>
    </span>
  );
}

/** 표마다 붙는 꼬리표 — 지역·건수·제외 기준·조회일·출처 */
function 메타줄({ 메타 }: { 메타: 표메타 }) {
  const 제외 =
    메타.제외.length > 0
      ? 메타.제외.map((x) => `${x.사유} ${x.건수}건`).join(", ")
      : "없음";
  return (
    <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
      지역 <strong className="text-foreground/80">{메타.지역}</strong> · 기준시점{" "}
      {시점표기(메타.기준시점)} · 건수 {메타.건수.toLocaleString("ko-KR")} ·
      제외 {제외} · 조회일 {메타.조회일} ·{" "}
      <strong className="text-foreground/80">출처 {메타.출처}</strong> (
      {메타.출처상세})
    </p>
  );
}

/** 비교표 한 개 */
function 비교표({
  제목,
  행,
  메타,
  경고,
  오류,
  재시도,
}: {
  제목: string;
  행: 비교행;
  메타: 표메타 | null;
  경고: string[];
  오류: string | null;
  재시도: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3 print-block">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold text-foreground">
          {제목}
          {/* 추정이 섞인 값은 제목 옆에 라벨로 드러낸다 — 문장 속에만 두면 놓친다 */}
          {행.항목.includes("추정") ? (
            <span className="ml-1.5 rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              추정
            </span>
          ) : null}
        </h4>
        {오류 ? (
          <button
            type="button"
            onClick={재시도}
            className="no-print rounded border border-line px-2 py-0.5 text-[11px] text-foreground hover:bg-surface-alt"
          >
            다시 시도
          </button>
        ) : null}
      </div>

      {오류 ? (
        <p className="mt-2 rounded border border-negative/40 bg-negative/10 px-2 py-1.5 text-[11px] text-foreground">
          {오류}
        </p>
      ) : (
        <table className="mt-2 w-full border-collapse text-sm">
          <tbody>
            <tr>
              <td className="w-28 border-b border-line/60 py-1 text-xs text-muted">
                시장
                {행.항목.includes("연 환산") ? (
                  <span className="block text-[10px] text-warning">
                    연 환산 (추정)
                  </span>
                ) : null}
              </td>
              <td className="tnum border-b border-line/60 py-1 text-right font-medium">
                {행.시장값 === null ? (
                  <span className="text-warning text-xs">자료 없음</span>
                ) : (
                  `${콤마(행.시장값)} ${행.시장라벨}`
                )}
              </td>
            </tr>
            <tr>
              <td className="border-b border-line/60 py-1 text-xs text-muted">
                사업계획 (가정치)
              </td>
              <td className="tnum border-b border-line/60 py-1 text-right font-medium">
                {행.계획값 === null
                  ? "-"
                  : `${콤마(행.계획값)} ${행.계획라벨}`}
              </td>
            </tr>
            <tr>
              <td className="py-1 text-xs text-muted">차이</td>
              <td
                className={`tnum py-1 text-right font-semibold ${
                  행.차이 === null
                    ? "text-muted"
                    : 행.차이 < 0
                      ? "text-negative"
                      : "text-positive"
                }`}
              >
                {행.차이 === null
                  ? "-"
                  : `${콤마(행.차이)} ${행.단위}` +
                    (행.괴리율 === null
                      ? ""
                      : ` (${콤마(행.괴리율 * 100, 1)}%)`)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <p
        className={`mt-2 text-[11px] leading-relaxed ${
          행.강조 ? "font-medium text-warning" : "text-muted"
        }`}
      >
        {행.강조 ? "⚠ " : ""}
        {행.문장}
      </p>

      {경고.map((w) => (
        <p key={w} className="mt-1 text-[11px] leading-relaxed text-warning/90">
          {w}
        </p>
      ))}

      {메타 ? <메타줄 메타={메타} /> : null}
    </div>
  );
}

/* ─── 본체 ─────────────────────────────────────────────────── */

interface 상권상태 {
  추천: 상권선택지[];
  시도목록: 상권선택지[];
  단위: "시군구" | "권역" | "판정불가";
  후보수: number;
  경고: string[];
}

export function MarketSection({ 입력 }: { 입력: 사업계획입력 }) {
  const 대상지 = 대상지전체이름(입력.시도, 입력.시군구);
  const [작업, 설정작업] = useState<작업표>(초기작업);
  const [지역확인, 설정지역확인] = useState<{
    상태: "대기" | "진행" | "완료" | "실패";
    문구: string;
  }>({ 상태: "대기", 문구: "" });
  const [상권, 설정상권] = useState<상권상태 | null>(null);
  const [선택CLS, 설정선택CLS] = useState<string | null>(null);
  const [실행중, 설정실행중] = useState(false);

  function 한칸갱신(키: 작업키, 값: 작업상태) {
    설정작업((이전) => ({ ...이전, [키]: 값 }));
  }

  /** 한 항목을 조회한다. 실패해도 다른 항목을 막지 않는다. */
  async function 한건조회(키: 작업키, cls: string | null) {
    한칸갱신(키, { 상태: "진행" });
    try {
      const 쿼리 =
        `area=${encodeURIComponent(대상지)}` +
        (cls && 키 !== "실거래" ? `&cls=${encodeURIComponent(cls)}` : "");
      const res = await fetch(`${라우트[키]}?${쿼리}`);
      const json = await res.json();
      if (키 === "실거래") {
        const r = json as 실거래응답;
        한칸갱신(키, {
          상태: r.ok ? "완료" : "실패",
          실거래: r,
          오류: r.오류 ?? undefined,
        });
      } else {
        const r = json as 시장지표응답;
        한칸갱신(키, {
          상태: r.ok ? "완료" : "실패",
          지표: r,
          오류: r.오류 ?? undefined,
        });
      }
    } catch (e) {
      한칸갱신(키, {
        상태: "실패",
        오류: e instanceof Error ? e.message : "요청 실패",
      });
    }
  }

  /** 동시 실행 수를 제한한다 (사양: 동시 4개까지) */
  async function 제한실행(키목록: 작업키[], cls: string | null, 동시수 = 4) {
    let 다음 = 0;
    const 일꾼 = async () => {
      while (다음 < 키목록.length) {
        const i = 다음++;
        await 한건조회(키목록[i], cls);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(동시수, 키목록.length) }, 일꾼),
    );
  }

  async function 만들기() {
    if (!대상지) {
      설정지역확인({ 상태: "실패", 문구: "사업대상지를 먼저 고를 것" });
      return;
    }
    설정실행중(true);
    설정작업(초기작업());
    설정상권(null);
    설정선택CLS(null);
    설정지역확인({ 상태: "진행", 문구: "지역 확인 중…" });

    // 1) 법정동코드 확인 — 브라우저는 이름만 보내고 코드 확인은 서버가 한다
    try {
      const res = await fetch(`/api/region?q=${encodeURIComponent(대상지)}`);
      const json = await res.json();
      if (!json.ok || (json.후보 ?? []).length === 0) {
        설정지역확인({
          상태: "실패",
          문구: json.오류 ?? `"${대상지}" 의 법정동코드를 찾지 못했다`,
        });
        설정실행중(false);
        return;
      }
      설정지역확인({ 상태: "완료", 문구: `${json.후보[0].전체이름} 확인` });
    } catch (e) {
      설정지역확인({
        상태: "실패",
        문구: e instanceof Error ? e.message : "지역 확인 실패",
      });
      설정실행중(false);
      return;
    }

    // 2) 상권 후보 추림 — 자동 1순위를 적용하되 확정은 사람이 한다
    let 자동CLS: string | null = null;
    try {
      const res = await fetch(
        `/api/market/office-region?area=${encodeURIComponent(대상지)}`,
      );
      const json = await res.json();
      const 공통 = json.공통 as 지역해석 | null;
      if (공통) {
        설정상권({
          추천: 공통.추천,
          시도목록: 공통.시도목록,
          단위: 공통.단위,
          후보수: 공통.후보수,
          경고: json.경고 ?? [],
        });
        자동CLS = 공통.CLS_ID;
        설정선택CLS(자동CLS);
      }
    } catch {
      // 상권 목록을 못 받아도 지표 조회는 그대로 시도한다 (서버가 자동 추림한다)
    }

    // 3) 끝난 표부터 화면에 올라간다.
    //    첫 조회는 cls 를 넘기지 않는다 — 서버가 같은 1순위를 자동으로 고르고
    //    "자동 선택"임을 응답에 표시한다. 사용자가 드롭다운을 건드린 뒤에야 확정으로 본다.
    void 자동CLS;
    await 제한실행(작업목록, null, 4);
    설정실행중(false);
  }

  /** 상권을 바꾸면 네 지표만 다시 받는다 (실거래는 상권과 무관하다) */
  async function 상권바꾸기(cls: string) {
    설정선택CLS(cls);
    설정실행중(true);
    await 제한실행(["임대료", "공실률", "순영업소득", "수익률"], cls, 4);
    설정실행중(false);
  }

  const 지표 = (키: 지표종류) => 작업[키].지표 ?? null;
  const 실거래 = 작업.실거래.실거래 ?? null;
  const 여유 = 시장대비여유계산(입력, 지표("수익률"));
  const 시작함 = 작업목록.some((k) => 작업[k].상태 !== "대기");

  const 표정의: {
    키: 작업키;
    제목: string;
    행: 비교행;
    메타: 표메타 | null;
  }[] = [
    {
      키: "임대료",
      제목: "① 인근 오피스 평당임대료 vs 계획 임대료",
      행: 임대료비교표(입력, 지표("임대료")),
      메타: 지표("임대료")?.메타 ?? null,
    },
    {
      키: "공실률",
      제목: "② 인근 오피스 공실률 vs 계획 임대율 가정",
      행: 공실률비교표(입력, 지표("공실률")),
      메타: 지표("공실률")?.메타 ?? null,
    },
    {
      키: "순영업소득",
      제목: "③ 인근 오피스 순영업소득 vs 앱 계산 NOI",
      행: 순영업소득비교표(입력, 지표("순영업소득")),
      메타: 지표("순영업소득")?.메타 ?? null,
    },
    {
      키: "수익률",
      제목: "④ 인근 오피스 수익률 vs 입력 캡레이트",
      행: 수익률비교표(입력, 지표("수익률")),
      메타: 지표("수익률")?.메타 ?? null,
    },
    {
      키: "실거래",
      제목: "⑤ (선택) 인근 상업업무용 실거래 평당매매가 vs 앱 자산가치",
      행: 실거래비교표(입력, 실거래),
      메타: 실거래?.메타 ?? null,
    },
  ];

  const 선택라벨 =
    상권?.시도목록.find((c) => c.CLS_ID === 선택CLS)?.전체이름 ??
    상권?.추천.find((c) => c.CLS_ID === 선택CLS)?.전체이름 ??
    "";

  return (
    <section className="rounded-lg border border-line bg-surface print-block">
      <header className="border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold text-foreground">
          <span className="mr-1.5 text-muted">Ⅱ</span>
          임대시장 분석
        </h2>
        <p className="mt-0.5 text-[11px] text-muted">
          공공데이터 기준치와 사업계획 가정치를 나란히 둔다 — 자동으로 대체하지
          않는다
        </p>
      </header>

      <div className="p-4">
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void 만들기()}
            disabled={실행중 || !대상지}
            className="rounded-md border border-accent bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent transition hover:brightness-95 disabled:opacity-40"
          >
            {실행중 ? "조회 중…" : "사업계획서 만들기"}
          </button>
          <span className="text-[11px] text-muted">
            {대상지 ? `대상지 ${대상지}` : "사업대상지를 먼저 고를 것"}
          </span>
        </div>

        {지역확인.상태 !== "대기" ? (
          <p
            className={`mt-2 text-[11px] ${
              지역확인.상태 === "실패" ? "text-negative" : "text-muted"
            }`}
          >
            지역 확인 — {지역확인.문구}
          </p>
        ) : null}

        {상권 ? (
          <div className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">
              상권 확정 — 자동 추림 결과를 확인하고 직접 고를 것
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              오피스 통계는 시군구가 아니라 <strong>상권 단위</strong>로
              공표된다 (후보 {상권.후보수}개). 아래는 시군구명과 이름이 겹치는
              상권을 자동으로 추린 것이며, 경계는{" "}
              <a
                className="font-medium text-accent underline underline-offset-2"
                href={상권구획도.링크}
                target="_blank"
                rel="noreferrer noopener"
              >
                {상권구획도.제목}
              </a>{" "}
              ({상권구획도.기준일} 기준) 에서 직접 확인할 수 있다.
            </p>

            <div className="no-print mt-2 flex flex-wrap items-center gap-2">
              <label className="text-[11px] font-medium text-muted">
                적용 상권
              </label>
              <select
                className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-foreground"
                value={선택CLS ?? ""}
                disabled={실행중}
                onChange={(e) => void 상권바꾸기(e.target.value)}
              >
                {상권.추천.length > 0 ? (
                  <optgroup label="자동 추림 (이름 부분일치)">
                    {상권.추천.map((c) => (
                      <option key={`r-${c.CLS_ID}`} value={c.CLS_ID}>
                        {c.전체이름}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                <optgroup label={`${입력.시도} 전체 상권`}>
                  {상권.시도목록.map((c) => (
                    <option key={`a-${c.CLS_ID}`} value={c.CLS_ID}>
                      {c.전체이름}
                    </option>
                  ))}
                </optgroup>
              </select>
              <span className="text-[11px] text-muted">
                {상권.추천.length === 0
                  ? "이름이 겹치는 상권이 없다 — 목록에서 직접 고를 것"
                  : `자동 추림 ${상권.추천.length}개`}
              </span>
            </div>

            {선택라벨 ? (
              <p className="mt-1.5 text-[11px] text-foreground">
                적용 중 — <strong>{선택라벨}</strong>
              </p>
            ) : null}

            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              [확인 필요] 2024년 3분기 상권 재구획으로 상권명이 예전과 달라졌을
              수 있다. 이 목록은 &ldquo;2024년3분기~&rdquo; 시리즈 응답에서만
              가져온다 — 구 시리즈(2022년~) 상권명과 섞지 말 것.
            </p>
            {상권.경고.map((w) => (
              <p key={w} className="mt-1 text-[11px] text-warning">
                {w}
              </p>
            ))}
          </div>
        ) : null}

        {시작함 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {작업목록.map((키) => (
              <진행칩
                key={키}
                이름={키 === "실거래" ? "실거래사례" : 키}
                상태={작업[키]}
              />
            ))}
          </div>
        ) : null}

        {시작함 ? (
          <div className="mt-3 flex flex-col gap-3">
            {표정의.map((t) =>
              작업[t.키].상태 === "대기" || 작업[t.키].상태 === "진행" ? (
                <div
                  key={t.키}
                  className="rounded-lg border border-dashed border-line px-3 py-2 text-[11px] text-muted"
                >
                  {t.제목} — {작업[t.키].상태 === "진행" ? "조회 중…" : "대기"}
                </div>
              ) : (
                <비교표
                  key={t.키}
                  제목={t.제목}
                  행={t.행}
                  메타={t.메타}
                  경고={작업[t.키].지표?.경고 ?? 작업[t.키].실거래?.경고 ?? []}
                  오류={작업[t.키].오류 ?? null}
                  재시도={() => void 한건조회(t.키, 선택CLS)}
                />
              ),
            )}

            <PyeongPriceChart
              여유={평당가여유계산(입력, 실거래)}
              메타={실거래?.메타 ?? null}
            />

            <div className="rounded-lg border border-accent/40 bg-accent-soft/50 px-3 py-2.5 print-block">
              <h4 className="text-xs font-semibold text-foreground">
                결론 — 시장 대비 여유
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                {여유.문장}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                상환 가능한 최대 캡레이트 {콤마(여유.한계캡레이트)}% · 인근 시장
                수익률 {콤마(여유.시장수익률)}% · 여유 {콤마(여유.여유)}%p
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] text-foreground">
            자료 없음 — [사업계획서 만들기] 를 눌러 공공데이터를 조회할 것.
          </p>
        )}
      </div>
    </section>
  );
}
