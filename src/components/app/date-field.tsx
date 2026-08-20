import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** ISO (yyyy-MM-dd) <-> Date helpers that stay timezone-safe. */
export function isoToDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const parsed = parse(iso, "yyyy-MM-dd", new Date());
  return isValid(parsed) ? parsed : undefined;
}

export function formatIsoDate(iso: string | null | undefined) {
  const date = isoToDate(iso);
  return date ? format(date, "EEE, MMM d, yyyy") : "";
}

/**
 * Single, obvious way to pick a date: click the field, choose a day on a
 * calendar with month/year navigation. Value stays an ISO date string.
 */
export function DateField({
  value,
  onChange,
  id,
  placeholder = "Pick a date",
  className,
  compact = false,
  ariaLabel,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = isoToDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-label={ariaLabel ?? "Pick a date"}
          className={cn(
            "w-full justify-start gap-2 text-left font-normal",
            compact ? "h-9 px-2.5 text-xs" : "h-10",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarDays className={cn("shrink-0 text-muted-foreground", compact ? "size-3.5" : "size-4")} />
          <span className="truncate">
            {selected ? format(selected, compact ? "MMM d, yyyy" : "EEE, MMM d, yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          startMonth={new Date(new Date().getFullYear() - 5, 0)}
          endMonth={new Date(new Date().getFullYear() + 5, 11)}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : null);
            setOpen(false);
          }}
          autoFocus
          className={cn("p-3 pointer-events-auto")}
        />
        {value ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear date
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
