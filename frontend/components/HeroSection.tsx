import Image from "next/image";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import SearchBar from "@/components/SearchBar";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Foto de fondo a pantalla completa (swappable: reemplaza /public/hero.jpg) */}
      <Image
        src="/hero.jpg"
        alt="Paisaje de México"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center hero-kenburns"
      />

      {/* Scrim para legibilidad del texto blanco sobre cualquier foto */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(18,28,23,0.55) 0%, rgba(18,28,23,0.30) 38%, rgba(18,28,23,0.60) 100%)",
        }}
      />

      {/* Desvanecimiento inferior suave hacia el color de fondo base (var(--bg-base)) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: "linear-gradient(to top, var(--bg-base) 0%, transparent 100%)",
        }}
      />

      {/* Contenido */}
      <div className="relative max-w-4xl mx-auto text-center px-4 pt-24 pb-20 sm:pt-32 sm:pb-24">
        <h1
          className="font-bold mb-4 leading-[1.05] animate-fade-in"
          style={{
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontSize: "var(--text-hero)",
            letterSpacing: "-0.025em",
            textWrap: "balance",
            textShadow: "0 2px 28px rgba(0,0,0,0.4)",
          }}
        >
          Tu próxima escapada en{" "}
          <span
            className="italic"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--color-accent)" }}
          >
            México
          </span>
        </h1>
        <p
          className="mb-8 max-w-xl mx-auto"
          style={{
            color: "rgba(255,255,255,0.92)",
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: "var(--text-body-lg)",
            textShadow: "0 1px 16px rgba(0,0,0,0.35)",
          }}
        >
          Hospedajes auténticos con anfitriones locales, en todo México.
        </p>

        <SearchBar />

        <Link
          href="/concierge"
          className="inline-flex items-center gap-2 mt-6 px-4 py-2 rounded-full text-body-sm font-medium text-white bg-white/15 border border-white/30 backdrop-blur-sm hover:bg-white/25 hover:scale-[1.03] transition-all active:scale-95"
        >
          <Sparkles size={15} className="text-white" />
          ¿No sabes a dónde ir? Planéalo con el Concierge IA
        </Link>
      </div>
    </section>
  );
}
