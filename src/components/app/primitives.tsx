import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { daysUntil, letterFor } from "@/lib/grade-engine";
import type { GradeScaleStep } from "@/lib/types";

type Tone = "positive" | "neutral" | "attention";

const toneStyles: Record<Tone, string> = {
  positive: "bg-success-soft text-success",
  neutral: "bg-primary-soft text-primary",
  attention: "bg-warning-soft text-warning",
};

export function SectionCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card-surface p-5 sm:p-6", className)} {...props}>
      {children}
    </div>
  );
}

/** Page-level title block: title → supporting line → actions. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-4",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-[1.15] tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-[13px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
          {title}
        </h2>
        {hint ? <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p> : null}
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        toneStyles[tone],
        className,
      )}
    >
      <span className="numeric">{score === null ? "—" : score.toFixed(1)}</span>
      <span className="opacity-60">·</span>
      <span>{score === null ? "—" : letterFor(score, scale)}</span>
    </span>
  );
}

/**
 * Number-first stat: the value carries the weight, the label sits under it as
 * quiet metadata.
 */
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
    <div className="min-w-0">
      <p
        className={cn(
          "numeric font-display font-semibold leading-none tabular-nums tracking-tight",
          emphasis ? "text-[34px] sm:text-[40px]" : "text-[22px]",
          tone === "positive" && "text-success",
          tone === "attention" && "text-warning",
        )}
      >
        {value}
        {suffix ? (
          <span
            className={cn(
              "ml-0.5 font-medium opacity-40",
              emphasis ? "text-lg" : "text-sm",
            )}
          >
            {suffix}
          </span>
        ) : null}
      </p>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      {sub ? (
        <p className="mt-1 text-xs leading-snug text-muted-foreground/80">{sub}</p>
      ) : null}
    </div>
  );
}


export function ProgressBar({ value, tone = "neutral" }: { value: number; tone?: Tone }) {
  const fill: Record<Tone, string> = {
    positive: "bg-success",
    neutral: "bg-primary",
    attention: "bg-warning",
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", fill[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 76,
  label,
}: {
  value: number;
  size?: number;
  label?: string;
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
          className="stroke-primary transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeric font-display text-sm font-semibold">
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
  const tone: Tone = days < 0 ? "attention" : days <= 3 ? "attention" : days <= 10 ? "neutral" : "neutral";
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        days <= 3 ? toneStyles[tone] : "bg-muted text-muted-foreground",
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
      <h3 className="font-display text-base font-semibold">{title}</h3>
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

