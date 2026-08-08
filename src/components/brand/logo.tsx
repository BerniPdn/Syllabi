import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = 22,
  withWordmark = true,
}: {
  className?: string;
  size?: number;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size + 4}
        height={size + 4}
        viewBox="0 0 28 28"
        fill="none"
        className="text-primary shrink-0"
      >
        {/* Contorno del documento desplegado trazando una S */}
        <path
          d="M7 5H21L15 12H23L17 21H7C5.89543 21 5 20.1046 5 19V7C5 5.89543 5.89543 5 7 5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Líneas de contenido impreso dentro de la hoja */}
        <path d="M9 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M17 16H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {withWordmark ? (
        <span className="font-display text-[16px] font-bold tracking-tight text-foreground">
          Syllabi
        </span>
      ) : null}
    </span>
  );
}

export function LogoLink({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("focus-ring rounded-md", className)} aria-label="Syllabi home">
      <Logo />
    </Link>
  );
}