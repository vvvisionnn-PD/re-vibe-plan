"use client";

/**
 * 사업수지 폭포 — 연임대수입에서 NOI 까지 무엇이 얼마나 깎아먹는지 보여준다.
 *
 * 막대의 시작·끝은 `수지폭포단계()` 가 이미 누적해 둔 값을 그대로 쓴다.
 * 여기서 더하거나 빼지 않는다.
 */

import type { 폭포단계 } from "../../lib/market";

import {
  ChartFrame,
  Legend,
  ValueTable,
  꼬리표만들기,
  눈금목록,
  색,
  콤마,
} from "./chartKit";

function 막대색(종류: 폭포단계["종류"]): string {
  if (종류 === "감소") return 색.불가;
  if (종류 === "합계") return 색.계획;
  return 색.가능;
}

export function WaterfallChart({ 단계 }: { 단계: 폭포단계[] }) {
  // 외부 조회가 아니라 앱 자체 계산이라 조회일이 없다. 출처에 그렇게 표시된다.
  // 렌더 중에 new Date() 를 부르면 서버·클라이언트 렌더가 어긋날 수 있어 쓰지 않는다.
  const 꼬리표 = 꼬리표만들기(
    "사업수지 폭포 — 연임대수입 → NOI",
    "억원",
    null,
    null,
  );

  const 값있음 = 단계.some((s) => Math.abs(s.값) > 0);
  const 자료없음 = !값있음 ? "임대수입과 비용이 모두 0 이다" : null;

  // ── 좌표계 ──
  const 폭 = 680;
  const 높이 = 260;
  const 여백 = { 상: 18, 하: 46, 좌: 54, 우: 12 };
  const 그림폭 = 폭 - 여백.좌 - 여백.우;
  const 그림높이 = 높이 - 여백.상 - 여백.하;

  const 최소 = Math.min(0, ...단계.map((s) => s.누적시작));
  const 최대 = Math.max(0, ...단계.map((s) => s.누적끝));
  const 눈금 = 눈금목록(최소, 최대, 5);
  const 축최소 = 눈금[0];
  const 축최대 = 눈금[눈금.length - 1];
  const 범위 = 축최대 - 축최소 || 1;
  const y = (v: number) => 여백.상 + ((축최대 - v) / 범위) * 그림높이;

  const 칸 = 그림폭 / Math.max(1, 단계.length);
  const 막대폭 = Math.min(56, 칸 * 0.62);

  const 표행 = 단계.map((s) => [
    s.이름,
    콤마(s.값, 2),
    s.종류 === "합계" ? "-" : 콤마(s.누적끝, 2),
  ]);

  return (
    <ChartFrame
      꼬리표={꼬리표}
      설명="초록은 더해지는 값, 빨강은 빠지는 값, 파랑은 결과다. 대손충당금은 임대수입과 기타수입을 합한 금액을 기준으로 산정되므로, 막대 순서상 기타수입이 뒤에 와도 이미 반영돼 있다."
      자료없음사유={자료없음}
      표={<ValueTable 머리={["항목", "증감(억원)", "누계(억원)"]} 행들={표행} />}
    >
      <svg
        viewBox={`0 0 ${폭} ${높이}`}
        className="h-auto w-full"
        role="img"
        aria-label={`사업수지 폭포. 연임대수입 ${콤마(단계[0]?.값, 0)}억원에서 NOI ${콤마(단계[단계.length - 1]?.값, 0)}억원까지`}
      >
        {/* 가로 눈금 */}
        {눈금.map((v) => (
          <g key={v}>
            <line
              x1={여백.좌}
              y1={y(v)}
              x2={여백.좌 + 그림폭}
              y2={y(v)}
              stroke={v === 0 ? 색.축 : 색.눈금}
              strokeWidth={1}
            />
            <text
              x={여백.좌 - 6}
              y={y(v) + 3}
              textAnchor="end"
              fontSize={10}
              fill={색.흐린글자}
            >
              {콤마(v)}
            </text>
          </g>
        ))}

        {단계.map((s, i) => {
          const cx = 여백.좌 + 칸 * i + 칸 / 2;
          const 위 = y(s.누적끝);
          const 아래 = y(s.누적시작);
          const 막대높이 = Math.max(1, 아래 - 위);
          const 다음 = 단계[i + 1];

          return (
            <g key={s.이름}>
              {/* 앞 막대 끝과 다음 막대를 잇는 점선 */}
              {다음 && s.종류 !== "합계" ? (
                <line
                  x1={cx}
                  y1={s.값 >= 0 ? 위 : 아래}
                  x2={cx + 칸}
                  y2={s.값 >= 0 ? 위 : 아래}
                  stroke={색.눈금}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ) : null}

              <rect
                x={cx - 막대폭 / 2}
                y={위}
                width={막대폭}
                height={막대높이}
                fill={막대색(s.종류)}
                opacity={s.종류 === "합계" ? 0.9 : 0.75}
                rx={2}
              />

              {/* 값 */}
              <text
                x={cx}
                y={위 - 4}
                textAnchor="middle"
                fontSize={10}
                fontWeight={s.종류 === "합계" ? 700 : 500}
                fill={색.글자}
              >
                {콤마(s.값, 1)}
              </text>

              {/* 이름 */}
              <text
                x={cx}
                y={여백.상 + 그림높이 + 14}
                textAnchor="middle"
                fontSize={10}
                fill={색.흐린글자}
              >
                {s.이름}
              </text>
            </g>
          );
        })}
      </svg>

      <Legend
        항목={[
          { 색: 색.가능, 이름: "더해지는 값", 모양: "면" },
          { 색: 색.불가, 이름: "빠지는 값", 모양: "면" },
          { 색: 색.계획, 이름: "결과 (NOI)", 모양: "면" },
        ]}
      />
    </ChartFrame>
  );
}
