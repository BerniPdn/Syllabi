import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { daysUntil, letterFor } from "@/lib/grade-engine";
import type { GradeScaleStep } from "@/lib/types";

type Tone = "positive" | "neutral" | "attention";

// Estilos vinculados a las variables dinámicas del tema CSS
const toneStyles: Record<Tone, string> = {
  positive: "bg-success-soft text-success",
  neutral: "bg-primary-soft text-primary",
  attention: "bg-warning-soft text-warning",
};

// Trazos del ProgressRing por tono (mismo mapeo semántico que toneStyles)
const ringStrokeStyles: Record<Tone, string> = {
  positive: "stroke-success",
  neutral: "stroke-primary",
  attention: "stroke-warning",
};

// Relleno del ProgressBar por tono
const barFillStyles: Record<Tone, string> = {
  positive: "bg-success",
  neutral: "bg-primary",
  attention: "bg-warning",
};

export function SectionCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-surface border border-border p-5 sm:p-6",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-sm font-semibold text-foreground">
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function GradeBadge({
  score,
  scale,
  tone = "neutral",
  className,
}: {
  score: number | null;
  scale: GradeScaleStep[];
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-200",
        toneStyles[tone],
        className,
      )}
    >
      <span>{score === null ? "—" : letterFor(score, scale)}</span>
    </span>
  );
}

export function GradeStat({
  label,
  value,
  suffix,
  sub,
  emphasis = false,
  tone,
}: {
  label: string;
  value: string;
  suffix?: string | undefined;
  sub?: string | undefined;
  emphasis?: boolean | undefined;
  tone?: Tone | undefined;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "numeric mt-1 font-display font-semibold tabular-nums",
          emphasis ? "text-3xl sm:text-4xl" : "text-xl",
          !tone && "text-foreground",
          tone === "positive" && "text-success",
          tone === "attention" && "text-warning",
        )}
      >
        {value}
        {suffix ? (
          <span className="ml-0.5 text-base font-medium text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function ProgressBar({ value, tone = "neutral" }: { value: number; tone?: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500 ease-out",
          barFillStyles[tone],
        )}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 76,
  label,
  tone = "neutral",
}: {
  value: number;
  size?: number;
  label?: string;
  tone?: Tone;
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, value)));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700", ringStrokeStyles[tone])}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeric font-display text-sm font-semibold text-foreground">
          {Math.round(value * 100)}%
        </span>
        {label ? (
          <span className="text-[10px] text-muted-foreground">{label}</span>
        ) : null}
      </span>
    </div>
  );
}

export function DeadlinePill({ dueDate, className }: { dueDate: string; className?: string }) {
  const days = daysUntil(dueDate);
  const tone: Tone = days <= 3 ? "attention" : days <= 10 ? "neutral" : "positive";
  const label =
    days < 0
      ? `${Math.abs(days)}d overdue`
      : days === 0
        ? "Due today"
        : days === 1
          ? "Due tomorrow"
          : `in ${days} days`;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-200",
        tone === "neutral" ? "bg-muted text-muted-foreground" : toneStyles[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary-soft text-primary">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function formatDate(iso: string | null) {
  if (!iso) return "No date";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

