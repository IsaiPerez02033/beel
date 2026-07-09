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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {experiences.map((e, idx) => (
              <ExperienceCard key={e.id} experience={e} priority={idx < 4} />
            ))}
          </div>
        </section>
      )}

      {/* ── Señales de confianza ───────────────────────────────────────────── */}
      <section className="py-14 px-4 mt-4" style={{
        background: "linear-gradient(180deg, var(--bg-base) 0%, var(--color-arena) 100%)"
      }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-h1 font-bold text-[var(--text-primary)] mb-2">
              ¿Por qué Beel?
            </h2>
            <p className="text-body-sm text-[var(--text-tertiary)]">
              Diseñado para México. Sin corporativo. Sin algoritmos.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <TrustItem
              icon={<Shield size={26} />}
              accent="primary"
              title="Anfitriones verificados"
              description="Cada anfitrión pasa por verificación de identidad antes de publicar."
            />
            <TrustItem
              icon={<Star size={26} />}
              accent="accent"
              title="Reseñas 100% reales"
              description="Solo huéspedes que completaron su estancia pueden opinar."
            />
            <TrustItem
              icon={<MessageCircle size={26} />}
              accent="primary"
              title="Soporte en español"
              description="Atención humana por chat y correo, siempre en tu idioma."
            />
          </div>
        </div>
      </section>

      <Footer />
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
    <div className="bg-[var(--bg-elevated)] rounded-2xl p-6 border border-[var(--border-subtle)] hover:shadow-md transition-shadow duration-200"
      style={{ borderTop: `3px solid ${color}` }}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
        style={{ background: bg, color }}>
        {icon}
      </div>
      <h3 className="text-h3 font-semibold text-[var(--text-primary)] mb-1.5">{title}</h3>
      <p className="text-body-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function PropertyGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
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
