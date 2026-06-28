"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

interface DateRangePickerProps {
  checkIn: string;
  checkOut: string;
  onCheckIn: (val: string) => void;
  onCheckOut: (val: string) => void;
  compact?: boolean;
  disabledDates?: Date[];
}

function toDate(s: string): Date | undefined {
  if (!s) return undefined;
  try { return parseISO(s); } catch { return undefined; }
}
function toStr(d: Date | undefined): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}
function fmtDisplay(s: string): string | null {
  if (!s) return null;
  try { return format(parseISO(s), "d MMM", { locale: es }); } catch { return null; }
}

// Posiciona el popover: siempre abajo del trigger, nunca arriba.
// Si no cabe en el viewport, se puede hacer scroll para verlo.
function computePos(r: DOMRect): { top: number; left: number } {
  const W = 320, M = 8;
  const top = r.bottom + M;
  let left = r.left;
  if (left + W > window.innerWidth - M) left = Math.max(M, window.innerWidth - W - M);
  return { top, left };
}

export default function DateRangePicker({
  checkIn, checkOut, onCheckIn, onCheckOut, compact = false, disabledDates = [],
}: DateRangePickerProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [open, setOpen] = useState(false);
  const [selecting, setSelecting] = useState<"from" | "to">("from");
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const range: DateRange = { from: toDate(checkIn), to: toDate(checkOut) };

  // Posicionar el popover bajo el trigger usando coordenadas fijas
  const openWithPos = useCallback((which: "from" | "to") => {
    setSelecting(which);
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPopoverPos(computePos(r));
      // Si el popover no cabe abajo, hacer scroll suave para que sea visible
      const calH = 380;
      if (window.innerHeight - r.bottom < calH + 16) {
        setTimeout(() => {
          window.scrollBy({ top: calH - (window.innerHeight - r.bottom) + 24, behavior: "smooth" });
        }, 50);
      }
    }
    setOpen(true);
  }, []);

  // Cerrar al click fuera — usar "click" en vez de "mousedown"
  // para evitar que el listener cierre el popover antes de que el onClick del trigger lo abra
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    // Pequeño delay para que el onClick del trigger se ejecute primero
    const timer = setTimeout(() => {
      document.addEventListener("click", handle);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handle);
    };
  }, [open]);

  // Reposicionar al scroll/resize
  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (triggerRef.current) {
        setPopoverPos(computePos(triggerRef.current.getBoundingClientRect()));
      }
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function handleSelect(r?: DateRange) {
    if (!r) return;

    if (disabledDates && disabledDates.length > 0 && r.from && r.to) {
      const current = new Date(r.from);
      current.setHours(0, 0, 0, 0);
      const end = new Date(r.to);
      end.setHours(0, 0, 0, 0);
      let hasBlockedDate = false;

      const disabledTimeStamps = new Set(
        disabledDates.map((d) => {
          const copy = new Date(d);
          copy.setHours(0, 0, 0, 0);
          return copy.getTime();
        })
      );

      while (current <= end) {
        if (disabledTimeStamps.has(current.getTime())) {
          hasBlockedDate = true;
          break;
        }
        current.setDate(current.getDate() + 1);
      }

      if (hasBlockedDate) {
        onCheckIn(toStr(r.from));
        onCheckOut("");
        setSelecting("to");
        return;
      }
    }

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
        onCheckIn(toStr(r.from));
        onCheckOut("");
      }
    }
  }

  function clear() {
    onCheckIn(""); onCheckOut(""); setSelecting("from");
  }

  return (
    <>
      {/* Triggers */}
      <div ref={triggerRef} className={cn("flex items-stretch", !compact && "flex-[2]")}>
        {compact ? (
          // Versión compacta: un solo botón con ambas fechas
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openWithPos("from"); }}
            className="flex items-center gap-1 text-body-sm text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors"
          >
            <span>{fmtDisplay(checkIn) ?? "Llegada"}</span>
            {checkOut && <><span className="text-[var(--border-strong)]">→</span><span>{fmtDisplay(checkOut)}</span></>}
            {(checkIn || checkOut) && (
              <button type="button" onClick={(e) => { e.stopPropagation(); clear(); }}
                className="ml-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
                <X size={11} />
              </button>
            )}
          </button>
        ) : (
          <>
            {/* Llegada */}
            <div
              onClick={(e) => { e.stopPropagation(); openWithPos("from"); }}
              className={cn(
                "search-bar-field flex flex-col justify-center cursor-pointer",
                open && selecting === "from" && "bg-white !border-r !border-r-[var(--color-primary)] ring-1 ring-[var(--color-primary)] ring-inset"
              )}
            >
              <span className="search-bar-label">Llegada</span>
              <span className={cn("search-bar-value", checkIn && "text-[var(--text-primary)] font-medium")}>
                {fmtDisplay(checkIn) ?? "Añadir fecha"}
              </span>
            </div>
            {/* Salida */}
            <div
              onClick={(e) => { e.stopPropagation(); openWithPos("to"); }}
              className={cn(
                "search-bar-field flex flex-col justify-center cursor-pointer",
                open && selecting === "to" && "bg-white ring-1 ring-[var(--color-primary)] ring-inset"
              )}
            >
              <span className="search-bar-label">Salida</span>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("search-bar-value", checkOut && "text-[var(--text-primary)] font-medium")}>
                  {fmtDisplay(checkOut) ?? "Añadir fecha"}
                </span>
                {(checkIn || checkOut) && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); clear(); }}
                    className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors flex-shrink-0">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Popover — position:fixed para escapar cualquier overflow */}
      {open && (
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: popoverPos.top,
            left: popoverPos.left,
            zIndex: 9999,
            borderTop: "3px solid var(--color-primary)",
          }}
          className="bg-white rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-4 select-none w-[320px]"
        >
          <p className="text-caption text-[var(--text-secondary)] text-center mb-3 font-medium">
            {selecting === "from" ? "¿Cuándo llegas?" : "¿Cuándo sales?"}
          </p>

          <DayPicker
            mode="range"
            locale={es}
            selected={range}
            onSelect={handleSelect}
            fromDate={today}
            disabled={disabledDates}
            numberOfMonths={1}
            showOutsideDays={false}
            classNames={{
              months: "flex flex-col",
              month: "space-y-3",
              caption: "flex items-center justify-between px-1 mb-2",
              caption_label: "text-body-sm font-semibold text-[var(--text-primary)] capitalize",
              nav: "flex items-center gap-1",
              nav_button: [
                "w-8 h-8 rounded-xl flex items-center justify-center",
                "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]",
                "hover:text-[var(--text-primary)] transition-colors",
                "disabled:opacity-25 disabled:cursor-not-allowed",
              ].join(" "),
              nav_button_previous: "",
              nav_button_next: "",
              table: "w-full border-collapse",
              head_row: "flex w-full mb-1",
              head_cell: "flex-1 text-center text-micro font-semibold text-[var(--text-tertiary)] uppercase tracking-wide py-1",
              row: "flex w-full mt-1",
              cell: "flex-1 p-0",
              day: [
                "w-full aspect-square max-h-9 flex items-center justify-center mx-auto",
                "text-body-sm font-medium text-[var(--text-primary)]",
                "rounded-xl hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]",
                "transition-colors cursor-pointer",
              ].join(" "),
              day_selected: "!bg-[var(--color-primary)] !text-white !rounded-xl hover:!bg-[var(--color-primary-dark)]",
              day_range_start: "!bg-[var(--color-primary)] !text-white !rounded-l-xl !rounded-r-none",
              day_range_end: "!bg-[var(--color-primary)] !text-white !rounded-r-xl !rounded-l-none",
              day_range_middle: "!bg-[var(--color-primary-light)] !text-[var(--color-primary)] !rounded-none",
              day_today: "font-bold ring-1 ring-[var(--color-primary)] ring-inset",
              day_outside: "opacity-0 pointer-events-none",
              day_disabled: "opacity-25 cursor-not-allowed hover:!bg-transparent hover:!text-[var(--text-primary)]",
            }}
            components={{
              IconLeft: () => <ChevronLeft size={15} />,
              IconRight: () => <ChevronRight size={15} />,
            }}
          />

          <div className="flex justify-between items-center mt-4 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={clear}
              className="text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2 transition-colors"
            >
              Borrar fechas
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-body-sm px-5 py-1.5 rounded-xl font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: "var(--color-primary)" }}
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
