import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ExperienceCard from "@/components/ExperienceCard";
import ExploreTabs from "@/components/ExploreTabs";
import type { Experience } from "@/types";

export const metadata: Metadata = {
  title: "Experiencias — Beel",
  description: "Vive experiencias auténticas con anfitriones locales en México.",
};

const CATEGORIES = [
  { key: "", label: "Todas" },
  { key: "gastronomia", label: "Gastronomía" },
  { key: "aventura", label: "Aventura" },
  { key: "cultura", label: "Cultura" },
  { key: "arte", label: "Arte" },
  { key: "naturaleza", label: "Naturaleza" },
  { key: "deporte", label: "Deporte" },
  { key: "bienestar", label: "Bienestar" },
  { key: "vida_nocturna", label: "Vida nocturna" },
  { key: "tour", label: "Tours" },
];

async function getExperiences(categoria?: string): Promise<Experience[]> {
  try {
    const qs = new URLSearchParams({ status: "active", per_page: "24" });
    if (categoria) qs.set("categoria", categoria);
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/experiences/search?${qs.toString()}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.experiences ?? [];
  } catch {
    return [];
  }
}

export default async function ExperienciasPage({ searchParams }: { searchParams: { categoria?: string } }) {
  const categoria = searchParams.categoria ?? "";
  const experiences = await getExperiences(categoria);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <ExploreTabs active="experiencias" />

        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-display font-display font-semibold text-[var(--text-primary)] mb-2">Experiencias</h1>
            <p className="text-body text-[var(--text-secondary)]">
              Actividades y tours con anfitriones locales en todo México.
            </p>
          </div>
          <Link href="/experiencias/reservas" className="text-body-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium whitespace-nowrap">
            Mis reservas →
          </Link>
        </div>

        {/* Filtros por categoría */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
          {CATEGORIES.map((c) => {
            const isActive = categoria === c.key;
            return (
              <Link
                key={c.key || "todas"}
                href={c.key ? `/experiencias?categoria=${c.key}` : "/experiencias"}
                className={`px-4 py-1.5 rounded-full text-body-sm font-medium whitespace-nowrap border transition-colors ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-default)]"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>

        {experiences.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {experiences.map((e) => (
              <ExperienceCard key={e.id} experience={e} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
              <Sparkles size={26} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Próximamente más experiencias</h2>
            <p className="text-body text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              Aún no hay experiencias en esta categoría. ¿Ofreces tours, clases o actividades?
              Publícalas gratis y sé de los primeros.
            </p>
            <Link href="/experiencias/nueva" className="btn btn-primary px-6 py-2.5">Publicar experiencia</Link>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
