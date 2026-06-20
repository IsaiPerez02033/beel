"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

interface DateRangePickerProps {
  checkIn: string;   // "yyyy-MM-dd" o ""
  checkOut: string;  // "yyyy-MM-dd" o ""
  onCheckIn: (val: string) => void;
  onCheckOut: (val: string) => void;
}

function toDate(s: string): Date | undefined {
  if (!s) return undefined;
  try { return parseISO(s); } catch { return undefined; }
}

function toStr(d: Date | undefined): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

export default function DateRangePicker({
  checkIn, checkOut, onCheckIn, onCheckOut,
}: DateRangePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const ref = useRef<HTMLDivElement>(null);

  const range: DateRange = {
    from: toDate(checkIn),
    to: toDate(checkOut),
  };

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleSelect(r?: DateRange) {
    if (!r) return;
    if (selecting === "from") {
      onCheckIn(toStr(r.from));
      onCheckOut("");
      setSelecting("to");
    } else {
      if (r.from && r.to) {
        onCheckIn(toStr(r.from));
        onCheckOut(toStr(r.to));
        setOpen(false);
        setSelecting("from");
      } else if (r.from) {
        // Clicked before from — reset
        onCheckIn(toStr(r.from));
        onCheckOut("");
      }
    }
  }

  function clear() {
    onCheckIn("");
    onCheckOut("");
    setSelecting("from");
  }

  const fmtDisplay = (s: string) => {
    if (!s) return null;
    try {
      return format(parseISO(s), "d MMM", { locale: es });
    } catch { return null; }
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger — dos campos lado a lado */}
      <div className="flex items-stretch gap-px">
        <button
          type="button"
          onClick={() => { setOpen(true); setSelecting("from"); }}
          className={cn(
            "flex flex-col items-start px-4 py-2.5 rounded-l-xl border border-[var(--border-default)] bg-white hover:border-[var(--color-primary)] transition-colors min-w-[130px] flex-1",
            open && selecting === "from" && "border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
          )}
        >
          <span className="text-micro font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">
            Llegada
          </span>
          <span className={cn("text-body-sm font-medium", checkIn ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]")}>
            {fmtDisplay(checkIn) ?? "Añadir fecha"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setOpen(true); setSelecting("to"); }}
          className={cn(
            "flex flex-col items-start px-4 py-2.5 rounded-r-xl border border-[var(--border-default)] bg-white hover:border-[var(--color-primary)] transition-colors min-w-[130px] flex-1",
            open && selecting === "to" && "border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
          )}
        >
          <span className="text-micro font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">
            Salida
          </span>
          <div className="flex items-center justify-between w-full gap-2">
            <span className={cn("text-body-sm font-medium", checkOut ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]")}>
              {fmtDisplay(checkOut) ?? "Añadir fecha"}
            </span>
            {(checkIn || checkOut) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clear(); }}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </button>
      </div>

      {/* Popover calendario */}
      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-4 select-none"
          style={{ minWidth: 320 }}
        >
          <p className="text-caption text-[var(--text-secondary)] text-center mb-3">
            {selecting === "from"
              ? "Selecciona la fecha de llegada"
              : "Selecciona la fecha de salida"}
          </p>
          <DayPicker
            mode="range"
            locale={es}
            selected={range}
            onSelect={handleSelect}
            fromDate={today}
            numberOfMonths={1}
            showOutsideDays={false}
            classNames={{
              months: "flex flex-col gap-4",
              month: "space-y-3",
              caption: "flex items-center justify-between px-1",
              caption_label: "text-body-sm font-semibold text-[var(--text-primary)] capitalize",
              nav: "flex items-center gap-1",
              nav_button: "w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-30",
              nav_button_previous: "",
              nav_button_next: "",
              table: "w-full border-collapse",
              head_row: "flex w-full mb-1",
              head_cell: "flex-1 text-center text-caption font-medium text-[var(--text-tertiary)] uppercase py-1",
              row: "flex w-full mt-1",
              cell: "flex-1 relative",
              day: "w-full aspect-square max-h-9 rounded-lg flex items-center justify-center text-body-sm font-medium text-[var(--text-primary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors cursor-pointer mx-auto",
              day_selected: "!bg-[var(--color-primary)] !text-white hover:!bg-[var(--color-primary-dark)] rounded-lg",
              day_range_start: "!bg-[var(--color-primary)] !text-white rounded-l-lg",
              day_range_end: "!bg-[var(--color-primary)] !text-white rounded-r-lg",
              day_range_middle: "!bg-[var(--color-primary-light)] !text-[var(--color-primary)] rounded-none",
              day_today: "font-bold text-[var(--color-primary)] underline underline-offset-2",
              day_outside: "opacity-0 pointer-events-none",
              day_disabled: "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-[var(--text-primary)]",
            }}
            components={{
              IconLeft: () => <ChevronLeft size={15} />,
              IconRight: () => <ChevronRight size={15} />,
            }}
          />

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={clear}
              className="text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline transition-colors"
            >
              Borrar fechas
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-primary text-body-sm px-4 py-1.5"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
