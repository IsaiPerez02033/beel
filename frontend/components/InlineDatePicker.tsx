"use client";

import { useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { es } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

interface Props {
  checkIn: string;
  checkOut: string;
  onCheckIn: (d: string) => void;
  onCheckOut: (d: string) => void;
  disabledDates?: Date[];
}

function toDate(s: string): Date | undefined {
  try { return s ? parseISO(s) : undefined; } catch { return undefined; }
}
function toStr(d?: Date): string {
  return d ? format(d, "yyyy-MM-dd") : "";
}
function fmtDisplay(s: string): string | null {
  try { return s ? format(parseISO(s), "d MMM", { locale: es }) : null; } catch { return null; }
}

type Step = "from" | "to" | "done";

export default function InlineDatePicker({ checkIn, checkOut, onCheckIn, onCheckOut, disabledDates = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("from");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const range: DateRange = { from: toDate(checkIn), to: toDate(checkOut) };

  function handleSelect(r?: DateRange) {
    if (!r) return;
    if (step === "from") {
      onCheckIn(toStr(r.from));
      onCheckOut("");
      setStep("to"); // automáticamente pasa a seleccionar salida
    } else {
      if (r.from && r.to) {
        onCheckIn(toStr(r.from));
        onCheckOut(toStr(r.to));
        setStep("done");
        setOpen(false); // cerrar al terminar
      } else if (r.from) {
        onCheckIn(toStr(r.from));
        onCheckOut("");
      }
    }
  }

  function clear() {
    onCheckIn(""); onCheckOut("");
    setStep("from");
    setOpen(true);
  }

  function openFrom() { setStep("from"); setOpen(true); }
  function openTo() { setStep(checkIn ? "to" : "from"); setOpen(true); }

  return (
    <div className="mb-3">
      {/* Triggers de fecha */}
      <div className="border border-[var(--border-default)] rounded-xl flex overflow-hidden">
        {/* Llegada */}
        <button
          type="button"
          onClick={openFrom}
          className={cn(
            "flex-1 p-3 text-left border-r border-[var(--border-default)] transition-colors",
            open && step === "from" ? "bg-[var(--color-primary-light)] ring-1 ring-inset ring-[var(--color-primary)]" : "hover:bg-[var(--bg-subtle)]"
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-0.5">Llegada</p>
          <p className={cn("text-body-sm", checkIn ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-tertiary)]")}>
            {fmtDisplay(checkIn) ?? "Añadir fecha"}
          </p>
        </button>

        {/* Salida */}
        <button
          type="button"
          onClick={openTo}
          className={cn(
            "flex-1 p-3 text-left transition-colors relative",
            open && step === "to" ? "bg-[var(--color-primary-light)] ring-1 ring-inset ring-[var(--color-primary)]" : "hover:bg-[var(--bg-subtle)]"
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-0.5">Salida</p>
          <p className={cn("text-body-sm", checkOut ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-tertiary)]")}>
            {fmtDisplay(checkOut) ?? "Añadir fecha"}
          </p>
          {(checkIn || checkOut) && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="absolute top-2 right-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              <X size={12} />
            </button>
          )}
        </button>
      </div>

      {/* Calendario inline — se expande debajo sin popups */}
      {open && (
        <div className="mt-2 border border-[var(--color-primary-border)] border-t-2 border-t-[var(--color-primary)] rounded-xl bg-white shadow-md p-4 select-none">
          <p className="text-caption font-semibold text-center text-[var(--color-primary)] mb-3">
            {step === "from" ? "¿Cuándo llegas?" : "¿Cuándo sales?"}
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
              month: "space-y-2",
              caption: "flex items-center justify-between px-1 mb-2",
              caption_label: "text-body-sm font-semibold text-[var(--text-primary)] capitalize",
              nav: "flex items-center gap-1",
              nav_button: "w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-25 disabled:cursor-not-allowed",
              nav_button_previous: "",
              nav_button_next: "",
              table: "w-full border-collapse",
              head_row: "flex w-full mb-1",
              head_cell: "flex-1 text-center text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide py-1",
              row: "flex w-full mt-0.5",
              cell: "flex-1 p-0",
              day: "w-full aspect-square max-h-8 flex items-center justify-center text-body-sm font-medium text-[var(--text-primary)] rounded-lg hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition-colors cursor-pointer",
              day_selected: "!bg-[var(--color-primary)] !text-white !rounded-lg hover:!bg-[var(--color-primary-dark)]",
              day_range_start: "!bg-[var(--color-primary)] !text-white !rounded-l-lg !rounded-r-none",
              day_range_end: "!bg-[var(--color-primary)] !text-white !rounded-r-lg !rounded-l-none",
              day_range_middle: "!bg-[var(--color-primary-light)] !text-[var(--color-primary)] !rounded-none",
              day_today: "font-bold ring-1 ring-[var(--color-primary)] ring-inset",
              day_outside: "opacity-0 pointer-events-none",
              day_disabled: "opacity-25 cursor-not-allowed hover:!bg-transparent hover:!text-[var(--text-primary)]",
            }}
            components={{
              IconLeft: () => <ChevronLeft size={14} />,
              IconRight: () => <ChevronRight size={14} />,
            }}
          />

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <button type="button" onClick={clear}
              className="text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-2">
              Borrar fechas
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="text-body-sm px-4 py-1.5 rounded-lg font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "var(--color-primary)" }}>
              Listo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
