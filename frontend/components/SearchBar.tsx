"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, MapPin, Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { DayPicker, DateRange } from "react-day-picker";
import DateRangePicker from "@/components/DateRangePicker";
import "react-day-picker/dist/style.css";

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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"destino" | "fechas" | "huespedes">("destino");

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

  // Al cerrar el modal movil, ocultar el dropdown de escritorio para que no
  // quede flotando sobre el hero con las sugerencias que se cargaron dentro.
  useEffect(() => {
    if (!mobileSearchOpen) setShowSug(false);
  }, [mobileSearchOpen]);

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
    mounted && !mobileSearchOpen && showSug && pos && (loadingSug || suggestions.length > 0)
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const range: DateRange = { from: toDate(checkIn), to: toDate(checkOut) };
  const handleSelect = (r: DateRange | undefined) => {
    if (!r) return;
    setCheckIn(r.from ? toStr(r.from) : "");
    setCheckOut(r.to ? toStr(r.to) : "");
  };

  return (
    <>
      {/* 1. Trigger en Móvil: Botón de búsqueda tipo píldora de Airbnb */}
      {!compact && (
        <button
          type="button"
          onClick={() => { setMobileSearchOpen(true); setActiveSection("destino"); }}
          className="md:hidden w-full max-w-md mx-auto flex items-center gap-3 px-4 py-3 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-full shadow-md text-left active:scale-[0.98] transition-transform mb-4"
        >
          <span className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
            <Search size={16} className="text-[var(--color-primary)]" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-semibold text-[var(--text-primary)]">¿A dónde quieres ir?</p>
            <p className="text-caption text-[var(--text-tertiary)] truncate">
              {destino ? `${destino} · ` : ""}
              {checkIn && checkOut ? `${fmtDisplay(checkIn)} – ${fmtDisplay(checkOut)}` : "Cualquier fecha"}
              {` · ${huespedes === 1 ? "1 huésped" : `${huespedes} huéspedes`}`}
            </p>
          </div>
        </button>
      )}

      {/* 2. Buscador en Escritorio */}
      <div className={cn("w-full max-w-3xl mx-auto", !compact && "hidden md:block", !compact && activeField !== null && "relative z-[48]")}>
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
              className="hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm animate-fade-in btn-specular">
              <Search size={16} />
            </button>
          </div>
        </div>

        <button onClick={handleSearch}
          className="sm:hidden mt-3 w-full h-12 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center gap-2 hover:bg-[var(--color-primary-dark)] transition-colors shadow-sm font-medium btn-specular">
          <Search size={16} />
          Buscar
        </button>

        {mounted && !compact && activeField !== null && createPortal(
          <div className="search-backdrop-overlay" onMouseDown={() => setActiveField(null)} />,
          document.body
        )}

        {dropdown}
      </div>

      {/* 3. Panel de Búsqueda de Pantalla Completa Móvil (Estilo Airbnb) */}
      {mounted && mobileSearchOpen && createPortal(
        <div className="fixed inset-0 bg-[var(--bg-subtle)] z-[100] flex flex-col animate-fade-in text-[var(--text-primary)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <button
              type="button"
              onClick={() => setMobileSearchOpen(false)}
              className="p-1 rounded-full hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] active:scale-90 transition-transform"
            >
              <X size={20} />
            </button>
            
            <div className="flex items-center gap-6 font-display font-medium text-sm">
              <span className="border-b-2 border-[var(--color-primary)] pb-1 text-[var(--text-primary)]">
                Alojamientos
              </span>
              <span className="text-[var(--text-tertiary)] pb-1">
                Experiencias
              </span>
            </div>
            
            <div className="w-8 h-8" />
          </div>

          {/* Body con Acordeón */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* SECCIÓN A: DESTINO */}
            <div className="card p-4 bg-[var(--bg-elevated)] shadow-md border border-[var(--border-subtle)] rounded-2xl transition-all">
              {activeSection === "destino" ? (
                <div className="space-y-3 animate-fade-in">
                  <span className="text-caption font-bold uppercase tracking-wider text-[var(--color-primary)]">¿A dónde vas?</span>
                  <div className="flex items-center gap-2 border border-[var(--border-default)] rounded-xl px-3 py-2 bg-[var(--bg-base)]">
                    <Search size={16} className="text-[var(--text-tertiary)]" />
                    <input
                      type="text"
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                      placeholder="Buscar destinos"
                      className="w-full bg-transparent outline-none text-body-sm"
                      autoFocus
                    />
                  </div>
                  {/* Sugerencias */}
                  <div className="divide-y divide-[var(--border-subtle)] max-h-56 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <button
                        key={`${s.label}-${i}`}
                        type="button"
                        onClick={() => { pickSuggestion(s); setActiveSection("fechas"); }}
                        className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-[var(--bg-subtle)] transition-colors active:bg-[var(--bg-subtle)]"
                      >
                        <MapPin size={15} className="text-[var(--text-secondary)]" />
                        <span className="text-body-sm text-[var(--text-primary)] truncate">{s.city || s.label}</span>
                      </button>
                    ))}
                    {suggestions.length === 0 && (
                      <div className="py-3 text-caption text-[var(--text-tertiary)] text-center">
                        Escribe el nombre de tu ciudad destino...
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSection("destino")}
                  className="w-full flex justify-between items-center text-left"
                >
                  <div>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Destino</p>
                    <p className="text-body-sm font-semibold text-[var(--text-primary)]">{destino || "Cualquier lugar"}</p>
                  </div>
                  <span className="text-caption text-[var(--color-primary)] font-medium">Cambiar</span>
                </button>
              )}
            </div>

            {/* SECCIÓN B: FECHAS */}
            <div className="card p-4 bg-[var(--bg-elevated)] shadow-md border border-[var(--border-subtle)] rounded-2xl transition-all">
              {activeSection === "fechas" ? (
                <div className="space-y-3 animate-fade-in">
                  <span className="text-caption font-bold uppercase tracking-wider text-[var(--color-primary)]">¿Cuándo viajas?</span>
                  <div className="flex justify-center select-none overflow-x-auto">
                    <DayPicker
                      mode="range"
                      locale={es}
                      selected={range}
                      onSelect={handleSelect}
                      fromDate={today}
                      numberOfMonths={1}
                      classNames={{
                        months: "flex flex-col",
                        month: "space-y-2",
                        caption: "flex items-center justify-between px-1 mb-1",
                        caption_label: "text-body-sm font-semibold text-[var(--text-primary)] capitalize",
                        nav: "flex items-center gap-1",
                        nav_button: "w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]",
                        table: "w-full border-collapse",
                        head_row: "flex w-full mb-1",
                        head_cell: "flex-1 text-center text-micro font-semibold text-[var(--text-tertiary)] uppercase tracking-wide py-1",
                        row: "flex w-full mt-1",
                        cell: "flex-1 p-0",
                        day: "w-full aspect-square max-h-8 flex items-center justify-center mx-auto text-body-sm font-medium text-[var(--text-primary)] rounded-xl hover:bg-[var(--color-primary-light)] cursor-pointer",
                        day_selected: "!bg-[var(--color-primary)] !text-white hover:!bg-[var(--color-primary-dark)]",
                        day_range_start: "!bg-[var(--color-primary)] !text-white !rounded-l-xl !rounded-r-none",
                        day_range_end: "!bg-[var(--color-primary)] !text-white !rounded-r-xl !rounded-l-none",
                        day_range_middle: "!bg-[var(--color-primary-light)] !text-[var(--color-primary)] !rounded-none",
                        day_today: "font-bold ring-1 ring-[var(--color-primary)] ring-inset",
                        day_outside: "opacity-0 pointer-events-none",
                        day_disabled: "opacity-25 cursor-not-allowed",
                      }}
                      components={{
                        IconLeft: () => <ChevronLeft size={15} />,
                        IconRight: () => <ChevronRight size={15} />,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-caption pt-2 border-t border-[var(--border-subtle)]">
                    <span>{checkIn ? `Llegada: ${fmtDisplay(checkIn)}` : "Añadir fechas"}</span>
                    {checkOut && <span>Salida: {fmtDisplay(checkOut)}</span>}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSection("fechas")}
                  className="w-full flex justify-between items-center text-left"
                >
                  <div>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Fechas</p>
                    <p className="text-body-sm font-semibold text-[var(--text-primary)]">
                      {checkIn && checkOut
                        ? `${fmtDisplay(checkIn)} – ${fmtDisplay(checkOut)}`
                        : "Cualquier fecha"}
                    </p>
                  </div>
                  <span className="text-caption text-[var(--color-primary)] font-medium">Cambiar</span>
                </button>
              )}
            </div>

            {/* SECCIÓN C: HUÉSPEDES */}
            <div className="card p-4 bg-[var(--bg-elevated)] shadow-md border border-[var(--border-subtle)] rounded-2xl transition-all">
              {activeSection === "huespedes" ? (
                <div className="space-y-3 animate-fade-in">
                  <span className="text-caption font-bold uppercase tracking-wider text-[var(--color-primary)]">¿Cuántos viajan?</span>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-body-sm font-semibold text-[var(--text-primary)]">Huéspedes</p>
                      <p className="text-caption text-[var(--text-tertiary)]">Total de huéspedes</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setHuespedes(Math.max(1, huespedes - 1))}
                        className="w-9 h-9 rounded-full border border-[var(--border-default)] flex items-center justify-center text-lg hover:border-[var(--text-primary)] active:scale-90 transition-all bg-[var(--bg-base)]"
                      >
                        −
                      </button>
                      <span className="text-body font-semibold min-w-[2ch] text-center">{huespedes}</span>
                      <button
                        type="button"
                        onClick={() => setHuespedes(Math.min(16, huespedes + 1))}
                        className="w-9 h-9 rounded-full border border-[var(--border-default)] flex items-center justify-center text-lg hover:border-[var(--text-primary)] active:scale-90 transition-all bg-[var(--bg-base)]"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSection("huespedes")}
                  className="w-full flex justify-between items-center text-left"
                >
                  <div>
                    <p className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Huéspedes</p>
                    <p className="text-body-sm font-semibold text-[var(--text-primary)]">
                      {huespedes === 1 ? "1 huésped" : `${huespedes} huéspedes`}
                    </p>
                  </div>
                  <span className="text-caption text-[var(--color-primary)] font-medium">Cambiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Footer Acciones */}
          <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-between safe-area-bottom">
            <button
              type="button"
              onClick={() => { setDestino(""); setCheckIn(""); setCheckOut(""); setHuespedes(1); }}
              className="text-body-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline"
            >
              Borrar todo
            </button>
            
            <button
              type="button"
              onClick={() => { setMobileSearchOpen(false); handleSearch(); }}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white font-semibold text-body-sm shadow-md active:scale-[0.97] transition-all btn-specular"
            >
              <Search size={16} />
              Buscar
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
