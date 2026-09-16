"use client";

import { useId, useState } from "react";

const groupFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 4,
});

function formatForDisplay(value: number): string {
  return Number.isFinite(value) ? groupFormatter.format(value) : "";
}

const fieldShell =
  "w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-foreground " +
  "outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 " +
  "disabled:opacity-50";

interface LabelledProps {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}

function Labelled({ label, hint, htmlFor, children }: LabelledProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted leading-snug"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted/80">{hint}</p> : null}
    </div>
  );
}

export interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** 입력칸 오른쪽에 표시할 단위 */
  unit?: string;
  hint?: string;
  min?: number;
  max?: number;
}

/**
 * 천단위 구분기호가 들어간 숫자 입력.
 *
 * 편집 중(`draft !== null`)에는 사용자가 친 문자열을 그대로 보여주고,
 * 편집을 마치면 draft 를 버려 prop 값에서 바로 표시 문자열을 파생시킨다.
 * 표시용 문자열을 별도 state 로 두고 effect 로 동기화하면 값이 바뀔 때마다
 * 불필요한 연쇄 렌더가 생기고, 두 상태가 어긋날 여지도 남는다.
 */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  hint,
  min,
  max,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? formatForDisplay(value);

  function handleChange(raw: string) {
    setDraft(raw);
    const cleaned = raw.replace(/[,\s]/g, "");
    if (cleaned === "" || cleaned === "-") {
      onChange(0);
      return;
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return;
    let next = parsed;
    if (typeof min === "number") next = Math.max(min, next);
    if (typeof max === "number") next = Math.min(max, next);
    onChange(next);
  }

  return (
    <Labelled label={label} hint={hint} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          className={`${fieldShell} tnum text-right ${unit ? "pr-14" : ""}`}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={(e) => {
            // 편집 중에는 구분기호를 뺀 원시 숫자를 보여준다
            setDraft(String(value));
            e.currentTarget.select();
          }}
          onBlur={() => setDraft(null)}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-muted">
            {unit}
          </span>
        ) : null}
      </div>
    </Labelled>
  );
}

export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: TextFieldProps) {
  const id = useId();
  return (
    <Labelled label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type="text"
        className={fieldShell}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Labelled>
  );
}

export interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  hint?: string;
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <Labelled label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        className={fieldShell}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Labelled>
  );
}

export function FieldGroup({
  title,
  description,
  children,
  columns = 2,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4 print-block">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-[11px] text-muted">{description}</p>
        ) : null}
      </header>
      <div
        className={`grid gap-3 ${
          columns === 3
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2"
        }`}
      >
        {children}
      </div>
    </section>
  );
}
