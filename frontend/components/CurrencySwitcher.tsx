"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { useMoney } from "@/contexts/CurrencyContext";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { code: "MXN" as const, label: "$ MXN — Peso mexicano" },
  { code: "USD" as const, label: "$ USD — Dólar estadounidense" },
];

export default function CurrencySwitcher() {
  const { currency, setCurrency } = useMoney();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
      >
        $ {currency}
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-2 bg-[var(--bg-elevated)] rounded-xl shadow-lg border border-[var(--border-subtle)] py-1 min-w-[220px] z-50">
          {OPTIONS.map((o) => (
            <button
              key={o.code}
              onClick={() => { setCurrency(o.code); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-body-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] text-left"
            >
              {o.label}
              {currency === o.code && <Check size={14} className="text-[var(--color-primary)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
