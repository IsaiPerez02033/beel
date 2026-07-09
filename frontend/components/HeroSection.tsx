"use client";

import { useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

export default function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const hero = heroRef.current;
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      hero.style.setProperty("--hero-mouse-x", `${x}px`);
      hero.style.setProperty("--hero-mouse-y", `${y}px`);
    };

    const hero = heroRef.current;
    if (hero) {
      hero.addEventListener("mousemove", handleMouseMove, { passive: true });
    }
    return () => {
      if (hero) {
        hero.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative pt-14 pb-12 px-4 overflow-hidden aurora-bg"
      style={{
        background: "var(--hero-gradient)",
      }}
    >
      {/* Patrón Maya SVG interactivo con máscara de luz radial y paralaje */}
      <div
        className="absolute inset-0 pointer-events-none transition-transform duration-300 ease-out"
        style={{
          transform: "translate(calc(var(--hero-mouse-x, 0px) * -0.012 - 4px), calc(var(--hero-mouse-y, 0px) * -0.012 - 4px))",
          maskImage: "radial-gradient(280px circle at var(--hero-mouse-x, -400px) var(--hero-mouse-y, -400px), black 30%, rgba(0,0,0,0.2) 100%)",
          WebkitMaskImage: "radial-gradient(280px circle at var(--hero-mouse-x, -400px) var(--hero-mouse-y, -400px), black 30%, rgba(0,0,0,0.2) 100%)",
          opacity: 0.18,
        }}
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="maya-pattern" x="0" y="0" width="160" height="160" patternUnits="userSpaceOnUse">
              {/* Pirámide Maya */}
              <g transform="translate(10, 10)">
                <polygon points="60,5 5,80 115,80" fill="none" stroke="#147A5C" strokeWidth="2.5" />
                <line x1="60" y1="5" x2="60" y2="80" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="5" y1="55" x2="115" y2="55" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="15" y1="68" x2="105" y2="68" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="27" y1="80" x2="93" y2="80" stroke="#147A5C" strokeWidth="2" />
                <rect x="48" y="0" width="24" height="10" fill="none" stroke="#147A5C" strokeWidth="1.5" />
              </g>

              {/* Sol Maya */}
              <g transform="translate(98, 98)">
                <circle cx="22" cy="22" r="12" fill="none" stroke="#147A5C" strokeWidth="2" />
                <circle cx="22" cy="22" r="5" fill="#147A5C" />
                <line x1="36" y1="22" x2="42" y2="22" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="8" y1="22" x2="2" y2="22" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="22" y1="8" x2="22" y2="2" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="22" y1="36" x2="22" y2="42" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="32" y1="12" x2="36" y2="8" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="12" y1="32" x2="8" y2="36" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="32" y1="32" x2="36" y2="36" stroke="#147A5C" strokeWidth="1.5" />
                <line x1="12" y1="12" x2="8" y2="8" stroke="#147A5C" strokeWidth="1.5" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#maya-pattern)" />
        </svg>
      </div>

      {/* Orbes decorativos de fondo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(245,166,35,0.3) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, rgba(20,122,92,0.4) 0%, transparent 70%)" }}
        />
      </div>

      <div className="max-w-4xl mx-auto text-center relative">
        <h1
          className="font-bold text-[var(--text-primary)] mb-3 leading-tight animate-fade-in"
          style={{ fontFamily: "var(--font-display)", fontSize: "clamp(26px, 4vw, 40px)", letterSpacing: "-0.02em" }}
        >
          Tu próxima escapada en{" "}
          <span className="relative inline-block">
            <span
              className="relative z-10 text-[var(--color-primary)]"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 600 }}
            >
              México
            </span>
            <span
              className="absolute -bottom-1 left-0 right-0 h-2 rounded-full opacity-30"
              style={{ background: "var(--color-accent)" }}
            />
          </span>
        </h1>
        <p
          className="text-body-lg text-[var(--text-secondary)] mb-2 max-w-xl mx-auto"
          style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 300 }}
        >
          Hospedajes auténticos con anfitriones locales.
        </p>
        <p className="text-body-sm text-[var(--text-tertiary)] mb-8">
          Casas, villas y departamentos en todo México.
        </p>

        <SearchBar />

        <Link
          href="/concierge"
          className="inline-flex items-center gap-2 mt-5 px-4 py-2 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-default)] text-body-sm font-medium text-[var(--text-primary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:scale-[1.03] transition-all shadow-sm active:scale-95"
        >
          <Sparkles size={15} className="text-[var(--color-primary)]" />
          ¿No sabes a dónde ir? Planéalo con el Concierge IA
        </Link>
      </div>
    </section>
  );
}
