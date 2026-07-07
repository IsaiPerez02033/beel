"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronLeft, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import LocationPicker from "@/components/LocationPicker";
import PhotoUploader from "@/components/PhotoUploader";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

const CATEGORIES = [
  ["gastronomia", "Gastronomía"], ["aventura", "Aventura"], ["cultura", "Cultura"],
  ["arte", "Arte"], ["naturaleza", "Naturaleza"], ["deporte", "Deporte"],
  ["bienestar", "Bienestar"], ["vida_nocturna", "Vida nocturna"], ["tour", "Tour"], ["otro", "Otro"],
];

export default function NuevaExperienciaPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { post } = useApi();

  const [step, setStep] = useState<"info" | "fotos" | "listo">("info");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "", description: "", category: "gastronomia",
    price_per_person: "", duration_minutes: "90",
    min_participants: "1", max_participants: "10",
    languages: "", included: "", requirements: "",
    cancellation_policy: "flexible",
  });
  const [loc, setLoc] = useState<{ address: string; neighborhood: string; city: string; state: string; postal_code: string; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/iniciar-sesion?callbackUrl=/experiencias/nueva");
  }, [isLoaded, isSignedIn, router]);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function createExperience() {
    setError("");
    if (form.title.trim().length < 5) return setError("El título debe tener al menos 5 caracteres.");
    if (form.description.trim().length < 20) return setError("La descripción debe tener al menos 20 caracteres.");
    if (!Number(form.price_per_person)) return setError("Ingresa un precio por persona válido.");
    if (!loc?.city || loc.lat == null) return setError("Selecciona la ubicación (punto de encuentro).");

    setSaving(true);
    try {
      const created = await post<{ id: string }>("/experiences", {
        title: form.title, description: form.description, category: form.category,
        address: loc.address || `${loc.city}`, neighborhood: loc.neighborhood || null,
        city: loc.city, state: loc.state || loc.city, postal_code: loc.postal_code || null,
        latitude: loc.lat, longitude: loc.lng,
        price_per_person: Number(form.price_per_person),
        duration_minutes: Number(form.duration_minutes),
        min_participants: Number(form.min_participants),
        max_participants: Number(form.max_participants),
        languages: form.languages || null, included: form.included || null,
        requirements: form.requirements || null, instant_booking: false,
        cancellation_policy: form.cancellation_policy,
      });
      setCreatedId(created.id);
      setStep("fotos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la experiencia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/experiencias" className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4">
          <ChevronLeft size={16} /> Experiencias
        </Link>
        <h1 className="text-display font-display font-semibold text-[var(--text-primary)] mb-1">Publicar experiencia</h1>
        <p className="text-body-sm text-[var(--text-tertiary)] mb-6">
          {step === "info" ? "Paso 1 de 2 — Detalles" : step === "fotos" ? "Paso 2 de 2 — Fotos" : "¡Listo!"}
        </p>

        {step === "info" && (
          <div className="card p-6 space-y-4">
            <Field label="Título">
              <input className="input w-full" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej: Tour de tacos por el Centro" />
            </Field>
            <Field label="Categoría">
              <select className="input w-full" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </Field>
            <Field label="Descripción">
              <textarea className="input w-full min-h-[120px]" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Describe qué harán, qué verán, qué la hace especial…" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio por persona (MXN)">
                <input type="number" className="input w-full" value={form.price_per_person} onChange={(e) => set("price_per_person", e.target.value)} placeholder="500" />
              </Field>
              <Field label="Duración (min)">
                <input type="number" className="input w-full" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} placeholder="90" />
              </Field>
              <Field label="Mín. participantes">
                <input type="number" className="input w-full" value={form.min_participants} onChange={(e) => set("min_participants", e.target.value)} />
              </Field>
              <Field label="Máx. participantes">
                <input type="number" className="input w-full" value={form.max_participants} onChange={(e) => set("max_participants", e.target.value)} />
              </Field>
            </div>

            <Field label="Idiomas (opcional)">
              <input className="input w-full" value={form.languages} onChange={(e) => set("languages", e.target.value)} placeholder="Español, Inglés" />
            </Field>
            <Field label="Qué incluye (opcional)">
              <textarea className="input w-full" value={form.included} onChange={(e) => set("included", e.target.value)} placeholder="Degustaciones, guía, transporte…" />
            </Field>
            <Field label="Requisitos (opcional)">
              <textarea className="input w-full" value={form.requirements} onChange={(e) => set("requirements", e.target.value)} placeholder="Edad mínima, condición física…" />
            </Field>

            <div>
              <p className="text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Punto de encuentro</p>
              <LocationPicker onSelect={(r) => setLoc({ address: r.address, neighborhood: r.neighborhood, city: r.city, state: r.state, postal_code: r.postal_code, lat: r.lat, lng: r.lng })} />
            </div>

            {error && <p className="text-caption text-red-600">{error}</p>}
            <button onClick={createExperience} disabled={saving} className="btn btn-primary w-full py-3 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Continuar a fotos →"}
            </button>
          </div>
        )}

        {step === "fotos" && createdId && (
          <div className="card p-6 space-y-4">
            <p className="text-body-sm text-[var(--text-secondary)]">Agrega fotos atractivas de tu experiencia.</p>
            <PhotoUploader propertyId={createdId} basePath="experiences" />
            <button onClick={() => setStep("listo")} className="btn btn-primary w-full py-3">Finalizar</button>
          </div>
        )}

        {step === "listo" && (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
              <Check size={30} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-h1 font-display font-semibold text-[var(--text-primary)] mb-2">¡Experiencia enviada!</h2>
            <p className="text-body text-[var(--text-secondary)] mb-6">
              Quedará en revisión antes de aparecer en Beel. Te avisaremos cuando esté aprobada.
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/experiencias" className="btn btn-outline px-6 py-2.5">Ver experiencias</Link>
              <Link href="/anfitrion" className="btn btn-primary px-6 py-2.5">Ir a mi panel</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}
