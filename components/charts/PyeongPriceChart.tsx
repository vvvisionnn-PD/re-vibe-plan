"use client";

/**
 * 시장 대비 여유 — 인근 실거래 평당가 점 분포 + 계획가 선 + 상환 한계 평당가 선.
 *
 * 숫자는 `평당가여유계산()` 이 만든 것만 쓴다. 여기서 다시 계산하지 않는다.
 * 점이 한계선 위에 있으면 그 가격에 팔아도 본PF 원리금을 갚는다는 뜻이다.
 */

import type { 평당가여유, 표메타 } from "../../lib/market";

import {
  ChartFrame,
  Legend,
  ValueTable,
  꼬리표만들기,
  눈금목록,
  색,
  콤마,
} from "./chartKit";

/** 점이 겹쳐 보이지 않게 세로로 흩뿌린다 (값은 가로축에만 싣는다) */
function 세로흩뿌리기(i: number, 개수: number, 높이: number): number {
  if (개수 <= 1) return 높이 / 2;
  // 결정적 의사난수 — 같은 입력이면 같은 그림이 나와야 한다
  const t = ((i * 9301 + 49297) % 233280) / 233280;
  return 높이 * (0.12 + 0.76 * t);
}

export function PyeongPriceChart({
  여유,
  메타,
}: {
  여유: 평당가여유;
  메타: 표메타 | null;
}) {
  const 꼬리표 = 꼬리표만들기(
    "시장 대비 여유 — 평당가 분포",
    "만원/평",
    메타,
    여유.건수,
  );

  const 값들 = [
    ...여유.시장점,
    ...(여유.계획평당 !== null ? [여유.계획평당] : []),
    ...(여유.한계평당 !== null ? [여유.한계평당] : []),
  ].filter((v) => Number.isFinite(v));

  const 자료없음 =
    값들.length === 0
      ? "실거래 사례와 계획 자산가치가 모두 비어 있다"
      : null;

  // ── 좌표계 ──
  const 폭 = 680;
  const 높이 = 210;
  const 여백 = { 상: 22, 하: 34, 좌: 12, 우: 12 };
  const 그림폭 = 폭 - 여백.좌 - 여백.우;
  const 그림높이 = 높이 - 여백.상 - 여백.하;

  const 최소 = Math.min(...값들, 0);
  const 최대 = Math.max(...값들);
  const 눈금 = 눈금목록(최소, 최대, 5);
  const 축최소 = 눈금[0];
  const 축최대 = 눈금[눈금.length - 1];
  const 폭범위 = 축최대 - 축최소 || 1;
  const x = (v: number) => 여백.좌 + ((v - 축최소) / 폭범위) * 그림폭;
  /** 가장자리에서 글자가 잘리지 않도록 기준점을 옮긴다 */
  const 글자기준 = (px: number): "start" | "middle" | "end" =>
    px < 56 ? "start" : px > 폭 - 56 ? "end" : "middle";

  const 표행 = [
    ["계획 평당가", 콤마(여유.계획평당, 1)],
    ["상환 한계 평당가", 콤마(여유.한계평당, 1)],
    ["여유 (계획 − 한계)", 콤마(여유.여유, 1)],
    ["시장 중앙값", 콤마(여유.시장중앙값, 1)],
    ["실거래 건수", 콤마(여유.건수)],
  ];

  return (
    <ChartFrame
      꼬리표={꼬리표}
      설명="점 하나가 실거래 한 건이다. 한계선 아래로 내려가면 본PF 원리금을 갚지 못한다."
      자료없음사유={자료없음}
      표={<ValueTable 머리={["항목", "만원/평"]} 행들={표행} />}
    >
      <svg
        viewBox={`0 0 ${폭} ${높이}`}
        className="h-auto w-full"
        role="img"
        aria-label={`평당가 분포. 계획 ${콤마(여유.계획평당, 0)}만원/평, 상환 한계 ${콤마(여유.한계평당, 0)}만원/평`}
      >
        {/* 눈금 */}
        {눈금.map((v) => (
          <g key={v}>
            <line
              x1={x(v)}
              y1={여백.상}
              x2={x(v)}
              y2={여백.상 + 그림높이}
              stroke={색.눈금}
              strokeWidth={1}
            />
            <text
              x={x(v)}
              y={높이 - 16}
              textAnchor="middle"
              fontSize={10}
              fill={색.흐린글자}
            >
              {콤마(v)}
            </text>
          </g>
        ))}

        {/* 상환 가능 구간 — 한계선 오른쪽 */}
        {여유.한계평당 !== null ? (
          <rect
            x={x(여유.한계평당)}
            y={여백.상}
            width={Math.max(0, 여백.좌 + 그림폭 - x(여유.한계평당))}
            height={그림높이}
            fill={색.가능}
            opacity={0.07}
          />
        ) : null}

        {/* 시장 점 */}
        {여유.시장점.map((v, i) => (
          <circle
            key={`${v}-${i}`}
            cx={x(v)}
            cy={여백.상 + 세로흩뿌리기(i, 여유.시장점.length, 그림높이)}
            r={3}
            fill={
              여유.한계평당 !== null && v < 여유.한계평당 ? 색.불가 : 색.시장
            }
            opacity={0.55}
          />
        ))}

        {/* 상환 한계 평당가 선 */}
        {여유.한계평당 !== null ? (
          <g>
            <line
              x1={x(여유.한계평당)}
              y1={여백.상}
              x2={x(여유.한계평당)}
              y2={여백.상 + 그림높이}
              stroke={색.불가}
              strokeWidth={2}
              strokeDasharray="5 3"
            />
            {/* 한계는 그림 위쪽 바깥에 */}
            <text
              x={x(여유.한계평당)}
              y={여백.상 - 8}
              textAnchor={글자기준(x(여유.한계평당))}
              fontSize={10}
              fontWeight={600}
              fill={색.불가}
            >
              한계 {콤마(여유.한계평당)}
            </text>
          </g>
        ) : null}

        {/* 계획 평당가 선 */}
        {여유.계획평당 !== null ? (
          <g>
            <line
              x1={x(여유.계획평당)}
              y1={여백.상}
              x2={x(여유.계획평당)}
              y2={여백.상 + 그림높이}
              stroke={색.계획}
              strokeWidth={2}
            />
            {/* 계획은 그림 안쪽 위에 — 두 선이 붙어도 세로로 어긋나 겹치지 않는다 */}
            <text
              x={x(여유.계획평당)}
              y={여백.상 + 11}
              textAnchor={글자기준(x(여유.계획평당))}
              fontSize={10}
              fontWeight={600}
              fill={색.계획}
            >
              계획 {콤마(여유.계획평당)}
            </text>
          </g>
        ) : null}

        {/* 축 */}
        <line
          x1={여백.좌}
          y1={여백.상 + 그림높이}
          x2={여백.좌 + 그림폭}
          y2={여백.상 + 그림높이}
          stroke={색.축}
          strokeWidth={1}
        />
      </svg>

      <Legend
        항목={[
          { 색: 색.시장, 이름: "실거래 (한계선 위)", 모양: "점" },
          { 색: 색.불가, 이름: "실거래 (한계선 아래)", 모양: "점" },
          { 색: 색.계획, 이름: "계획 평당가", 모양: "선" },
          { 색: 색.불가, 이름: "상환 한계 평당가", 모양: "선" },
        ]}
      />

      {여유.여유 !== null ? (
        <p className="mt-1.5 text-[11px] text-foreground">
          여유{" "}
          <strong className={여유.여유 >= 0 ? "text-positive" : "text-negative"}>
            {콤마(여유.여유, 1)} 만원/평
          </strong>{" "}
          (계획 {콤마(여유.계획평당, 1)} − 한계 {콤마(여유.한계평당, 1)})
        </p>
      ) : null}
    </ChartFrame>
  );
}
