"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import DateRangePicker from "@/components/DateRangePicker";

interface SearchBarProps {
  compact?: boolean;
  initialValues?: {
    destino?: string;
    checkIn?: string;
    checkOut?: string;
    huespedes?: number;
  };
  onSearchSuccess?: () => void;
}

interface GeoSuggestion {
  label: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export default function SearchBar({ compact = false, initialValues = {}, onSearchSuccess }: SearchBarProps) {
  const router = useRouter();
  const destinoInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [destino, setDestino] = useState(initialValues.destino ?? "");
  const [checkIn, setCheckIn] = useState(initialValues.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initialValues.checkOut ?? "");
  const [huespedes, setHuespedes] = useState(initialValues.huespedes ?? 1);
  const [activeField, setActiveField] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Autocompletado de destino (OpenStreetMap)
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [loadingSug, setLoadingSug] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => setMounted(true), []);

  function updatePos() {
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
  }

  useEffect(() => {
    if (!showSug) return;
    updatePos();
    const onScroll = () => updatePos();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [showSug, suggestions]);

  useEffect(() => {
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    const q = destino.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setSuggestions([]); setShowSug(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSug(true);
      setShowSug(true);
      try {
        const res = await fetch(`/api/geo/autocomplete?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSug(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [destino]);

  function pickSuggestion(s: GeoSuggestion) {
    justSelectedRef.current = true;
    setDestino(s.city || s.label);
    setShowSug(false);
    setSuggestions([]);
  }

  function handleSearch() {
    setShowSug(false);
    const params = new URLSearchParams();
    if (destino) params.set("destino", destino);
    if (checkIn) params.set("check_in", checkIn);
    if (checkOut) params.set("check_out", checkOut);
    if (huespedes > 1) params.set("huespedes", String(huespedes));
    router.push(`/buscar?${params.toString()}`);
    if (onSearchSuccess) onSearchSuccess();
  }

  const dropdown =
    mounted && showSug && pos && (loadingSug || suggestions.length > 0)
      ? createPortal(
          <div
            style={{ position: "absolute", top: pos.top, left: pos.left, width: Math.max(pos.width, 260), zIndex: 9999 }}
            className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl shadow-xl overflow-hidden max-h-72 overflow-y-auto"
          >
            {loadingSug && suggestions.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-3 text-body-sm text-[var(--text-tertiary)]">
                <Loader2 size={14} className="animate-spin" /> Buscando destinos...
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-4 py-3 text-body-sm text-[var(--text-tertiary)]">Sin resultados</div>
            ) : (
              suggestions.map((s, i) => (
                <button
                  key={`${s.label}-${i}`}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(s); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-[var(--bg-subtle)] flex items-center justify-center flex-shrink-0">
                    <MapPin size={15} className="text-[var(--text-secondary)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-body-sm font-medium text-[var(--text-primary)] truncate">{s.city || s.label}</span>
                    {s.state && <span className="block text-caption text-[var(--text-tertiary)] truncate">{s.state}, México</span>}
                  </span>
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl shadow-sm px-3 py-1.5">
        <Search size={15} className="text-[var(--color-primary)] flex-shrink-0" />
        <div ref={anchorRef} className="relative">
          <input
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="¿A dónde vas?"
            className="text-body-sm text-[var(--text-primary)] bg-transparent outline-none w-28 placeholder:text-[var(--text-tertiary)]"
            style={{ border: "none", outline: "none", background: "transparent", boxShadow: "none" }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            onFocus={() => suggestions.length && setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
          />
        </div>
        <span className="text-[var(--border-strong)] text-body-sm">·</span>
        <DateRangePicker checkIn={checkIn} checkOut={checkOut} onCheckIn={setCheckIn} onCheckOut={setCheckOut} compact />
        <span className="text-[var(--border-strong)] text-body-sm">·</span>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setHuespedes(Math.max(1, huespedes - 1))}
            className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-caption hover:border-[var(--text-primary)] transition-colors">−</button>
          <span className="text-body-sm text-[var(--text-primary)] min-w-[1ch] text-center">{huespedes}</span>
          <button type="button" onClick={() => setHuespedes(Math.min(16, huespedes + 1))}
            className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-caption hover:border-[var(--text-primary)] transition-colors">+</button>
        </div>
        <button onClick={handleSearch}
          className="ml-1 w-7 h-7 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors flex-shrink-0">
          <Search size={13} />
        </button>
        {dropdown}
      </div>
    );
  }

  return (
    <div className={cn("w-full max-w-3xl mx-auto", !compact && activeField !== null && "relative z-[48]")}>
      <div className="search-bar rounded-2xl">
        <div
          ref={anchorRef}
          className={cn(
            "search-bar-field flex-[2] flex flex-col justify-center cursor-pointer rounded-l-2xl relative",
            activeField === "destino" && "bg-[var(--bg-elevated)] ring-1 ring-[var(--color-primary)] ring-inset"
          )}
          onClick={() => { setActiveField("destino"); destinoInputRef.current?.focus(); }}
        >
          <span className="search-bar-label">¿A dónde?</span>
          <input
            ref={destinoInputRef}
            type="text"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Destino o ciudad"
            className="search-bar-value bg-transparent outline-none w-full text-center"
            style={{ border: "none", outline: "none", background: "transparent", boxShadow: "none" }}
            onFocus={() => { setActiveField("destino"); if (suggestions.length) setShowSug(true); }}
            onBlur={() => { setActiveField(null); setTimeout(() => setShowSug(false), 150); }}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>

        <DateRangePicker checkIn={checkIn} checkOut={checkOut} onCheckIn={setCheckIn} onCheckOut={setCheckOut} />

        <div
          className={cn(
            "search-bar-field flex items-center justify-between gap-3 rounded-r-2xl border-r-0",
            activeField === "guests" && "bg-[var(--bg-elevated)] ring-1 ring-[var(--color-primary)] ring-inset"
          )}
        >
          <div className="flex flex-col justify-center flex-1 cursor-pointer items-center sm:items-start" onClick={() => setActiveField("guests")}>
            <span className="search-bar-label">Huéspedes</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={(e) => { e.stopPropagation(); setHuespedes(Math.max(1, huespedes - 1)); }}
                className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-sm leading-none hover:border-[var(--border-strong)] transition-colors">−</button>
              <span className="search-bar-value min-w-[1.5ch] text-center">{huespedes}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); setHuespedes(Math.min(16, huespedes + 1)); }}
                className="w-5 h-5 rounded-full border border-[var(--border-default)] flex items-center justify-center text-sm leading-none hover:border-[var(--border-strong)] transition-colors">+</button>
            </div>
          </div>

          <button onClick={handleSearch} aria-label="Buscar"
            className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm">
            <Search size={16} />
          </button>
        </div>
      </div>

      <button onClick={handleSearch}
        className="sm:hidden mt-3 w-full h-12 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center gap-2 hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm font-medium">
        <Search size={16} />
        Buscar
      </button>

      {mounted && !compact && activeField !== null && createPortal(
        <div className="search-backdrop-overlay" onMouseDown={() => setActiveField(null)} />,
        document.body
      )}

      {dropdown}
    </div>
  );
}
