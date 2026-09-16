import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface print-block ${className}`}
    >
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-2.5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Table({
  head,
  children,
}: {
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead className="bg-surface-alt text-[11px] uppercase tracking-wide text-muted">
          {head}
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  align = "right",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  return (
    <th
      className={`border-b border-line px-2.5 py-1.5 font-medium ${className}`}
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "right",
  emphasis = false,
  className = "",
  colSpan,
}: {
  children: ReactNode;
  align?: "left" | "right" | "center";
  emphasis?: boolean;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-line/70 px-2.5 py-1.5 tnum ${
        emphasis ? "font-semibold text-foreground" : "text-foreground/90"
      } ${className}`}
      style={{ textAlign: align }}
    >
      {children}
    </td>
  );
}

/** 합계·소계 행 */
export function TotalRow({ children }: { children: ReactNode }) {
  return <tr className="bg-surface-alt/70">{children}</tr>;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "positive" | "negative" | "warning" | "accent";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-alt text-muted",
    positive: "bg-positive/10 text-positive",
    negative: "bg-negative/10 text-negative",
    warning: "bg-warning/10 text-warning",
    accent: "bg-accent-soft text-accent",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
