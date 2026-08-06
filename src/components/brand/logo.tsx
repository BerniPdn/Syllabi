import { Link } from "@tanstack/react-router";
import mark from "@/assets/coursepilot-mark.png";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 28,
  withWordmark = true,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={mark}
        alt="CoursePilot"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0"
      />
      {withWordmark ? (
        <span className="font-display text-[15px] font-semibold tracking-tight">CoursePilot</span>
      ) : null}
    </span>
  );
}

export function LogoLink({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("focus-ring rounded-md", className)} aria-label="CoursePilot home">
      <Logo />
    </Link>
  );
}
