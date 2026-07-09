import type { Metadata } from "next";
import type { Property, Experience } from "@/types";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import HeroSection from "@/components/HeroSection";
import PropertyCard, { PropertyCardSkeleton } from "@/components/PropertyCard";
import ExperienceCard from "@/components/ExperienceCard";
import ExploreTabs from "@/components/ExploreTabs";
import { Suspense } from "react";
import { Shield, Star, MessageCircle, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Beel — Hospedajes únicos en México",
};

// ── Fetch propiedades destacadas ──────────────────────────────────────────────
async function getFeaturedProperties(): Promise<Property[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/properties/search?status=active&per_page=8`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.properties ?? [];
  } catch {
    return [];
  }
}

// ── Fetch experiencias destacadas ─────────────────────────────────────────────
async function getFeaturedExperiences(): Promise<Experience[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/experiences/search?status=active&per_page=4`,
      { next: { revalidate: 120 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.experiences ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [properties, experiences] = await Promise.all([
    getFeaturedProperties(),
    getFeaturedExperiences(),
  ]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <HeroSection />

      {/* ── Propiedades destacadas ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <ExploreTabs active="alojamientos" />
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-h1 text-[var(--text-primary)]">
            Hospedajes destacados
          </h2>
          <a
            href="/buscar"
            className="text-body-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium"
          >
            Ver todos →
          </a>
        </div>

        <Suspense fallback={<PropertyGridSkeleton />}>
          {properties.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 reveal-grid">
              {properties.map((property, idx) => (
                <PropertyCard key={property.id} property={property} priority={idx < 4} />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </Suspense>
      </section>

      {/* ── Experiencias destacadas ────────────────────────────────────────── */}
      {experiences.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-h1 text-[var(--text-primary)]">Experiencias para vivir</h2>
            <Link
              href="/experiencias"
              className="text-body-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium"
            >
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 reveal-grid">
            {experiences.map((e, idx) => (
              <ExperienceCard key={e.id} experience={e} priority={idx < 4} />
            ))}
          </div>
        </section>
      )}

      <section className="py-24 px-4 mt-0" style={{
        background: "linear-gradient(180deg, var(--bg-base) 0%, var(--bg-subtle) 100%)"
      }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-display font-display font-semibold text-[var(--text-primary)] mb-2">
              ¿Por qué Beel?
            </h2>
            <p className="text-body text-[var(--text-tertiary)]">
              Diseñado para México. Sin corporativo. Sin algoritmos.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            <TrustItem
              icon={<Shield size={24} />}
              accent="primary"
              title="Anfitriones verificados"
              description="Cada anfitrión pasa por verificación de identidad antes de publicar."
            />
            <TrustItem
              icon={<Star size={24} />}
              accent="accent"
              title="Reseñas 100% reales"
              description="Solo huéspedes que completaron su estancia pueden opinar."
            />
            <TrustItem
              icon={<MessageCircle size={24} />}
              accent="primary"
              title="Soporte en español"
              description="Atención humana por chat y correo, siempre en tu idioma."
            />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)]">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(circle at 50% 50%, rgba(20,122,92,0.12) 0%, transparent 65%)" }}
        />
        <div className="relative max-w-3xl mx-auto px-4 py-16 sm:py-20 text-center">
          <h2
            className="font-display font-semibold text-[var(--text-primary)] mb-3"
            style={{ fontSize: "clamp(1.75rem, 1.2rem + 2vw, 2.75rem)", letterSpacing: "-0.02em", textWrap: "balance" }}
          >
            Tu espacio también puede ser el hogar de alguien
          </h2>
          <p className="text-body-lg text-[var(--text-secondary)] max-w-lg mx-auto mb-8">
            Publica en minutos, recibe huéspedes verificados y quédate con el 100% de lo que ganas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/ser-anfitrion"
              className="btn btn-primary rounded-full px-6 py-3 hover:scale-[1.03] active:scale-95 transition-all text-white font-semibold shadow-md w-full max-w-[260px] sm:w-auto mx-auto sm:mx-0 justify-center"
            >
              Publicar mi espacio
            </Link>
            <Link
              href="/buscar"
              className="btn btn-outline rounded-full px-6 py-3 hover:scale-[1.03] active:scale-95 transition-all text-[var(--text-primary)] font-medium w-full max-w-[260px] sm:w-auto mx-auto sm:mx-0 justify-center"
            >
              Explorar hospedajes
            </Link>
          </div>
        </div>
      </section>

      <Footer className="mt-0" />
    </div>
  );
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function TrustItem({
  icon, title, description, accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "primary" | "accent";
}) {
  const color = accent === "primary" ? "var(--color-primary)" : "var(--color-accent)";
  const bg = accent === "primary" ? "var(--color-primary-light)" : "var(--color-accent-light)";
  return (
    <div className="text-center md:text-left">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 mx-auto md:mx-0"
        style={{ background: bg, color }}>
        {icon}
      </div>
      <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-1.5">{title}</h3>
      <p className="text-body-sm text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto md:mx-0">{description}</p>
    </div>
  );
}

function PropertyGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 reveal-grid">
      {Array.from({ length: 8 }).map((_, i) => (
        <PropertyCardSkeleton key={i} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state py-20">
      <div className="empty-state-icon text-5xl">🏡</div>
      <h3 className="text-h2 text-[var(--text-primary)]">Próximamente</h3>
      <p className="text-body text-[var(--text-secondary)] max-w-sm">
        Estamos incorporando los primeros hospedajes. ¡Regresa pronto!
      </p>
    </div>
  );
}
