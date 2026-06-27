"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import PhotoUploader from "@/components/PhotoUploader";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Home, MapPin, DollarSign,
  Settings, Check, Loader2, Plus, Minus, Camera,
} from "lucide-react";
import type { Amenity } from "@/types";
import LocationPicker from "@/components/LocationPicker";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type PropertyType = "casa" | "departamento" | "cabaña" | "villa" | "habitacion" | "hostal" | "otro";
type CancellationPolicy = "flexible" | "moderate" | "strict";

interface FormData {
  // Paso 1 — Básicos
  title: string;
  description: string;
  property_type: PropertyType;
  // Paso 2 — Ubicación
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  // Paso 3 — Capacidad y precio
  max_guests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  price_per_night: string;
  cleaning_fee: string;
  security_deposit: string;
  min_stay_nights: number;
  // Paso 4 — Políticas y amenidades
  cancellation_policy: CancellationPolicy;
  check_in_time: string;
  check_out_time: string;
  instant_booking: boolean;
  allows_pets: boolean;
  allows_smoking: boolean;
  allows_events: boolean;
  amenity_ids: string[];
}

const INITIAL: FormData = {
  title: "", description: "", property_type: "casa",
  address: "", neighborhood: "", city: "", state: "", lat: null, lng: null,
  max_guests: 2, bedrooms: 1, beds: 1, bathrooms: 1,
  price_per_night: "", cleaning_fee: "", security_deposit: "",
  min_stay_nights: 1,
  cancellation_policy: "flexible",
  check_in_time: "15:00", check_out_time: "11:00",
  instant_booking: false, allows_pets: false, allows_smoking: false, allows_events: false,
  amenity_ids: [],
};

const PROPERTY_TYPES: { value: PropertyType; label: string; icon: string }[] = [
  { value: "casa",         label: "Casa",          icon: "🏠" },
  { value: "departamento", label: "Departamento",  icon: "🏢" },
  { value: "cabaña",       label: "Cabaña",        icon: "🛖" },
  { value: "villa",        label: "Villa",          icon: "🏡" },
  { value: "habitacion",   label: "Habitación",    icon: "🛏️" },
  { value: "hostal",       label: "Hostal",        icon: "🏨" },
  { value: "otro",         label: "Otro",          icon: "✨" },
];

const STEPS = [
  { label: "Tu espacio",   icon: <Home size={16} /> },
  { label: "Ubicación",    icon: <MapPin size={16} /> },
  { label: "Capacidad",    icon: <DollarSign size={16} /> },
  { label: "Detalles",     icon: <Settings size={16} /> },
  { label: "Fotos",        icon: <Camera size={16} /> },
];

// ── Página principal ──────────────────────────────────────────────────────────

export default function NuevaPropiedadPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { get, post } = useApi();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdPropertyId, setCreatedPropertyId] = useState<string | null>(null);
  // Gate de verificación: null = cargando, true/false = resultado
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/iniciar-sesion?redirect_url=/p/nueva");
      return;
    }
    // Verificar que el usuario tenga teléfono e identidad verificados
    get<{ is_phone_verified: boolean; is_identity_verified: boolean }>("/users/me")
      .then((u) => setVerified(!!u.is_phone_verified && !!u.is_identity_verified))
      .catch(() => setVerified(false));
    get<Amenity[] | { amenities: Amenity[] }>("/properties/amenities")
      .then((d) => setAmenities(Array.isArray(d) ? d : (d.amenities ?? [])))
      .catch(() => {});
  }, [isSignedIn, isLoaded]);

  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }, []);

  // ── Validación por paso ───────────────────────────────────────────────────

  function validate(): string {
    if (step === 0) {
      if (form.title.trim().length < 5) return "El título debe tener al menos 5 caracteres";
      if (form.description.trim().length < 20) return "La descripción debe tener al menos 20 caracteres";
    }
    if (step === 1) {
      if (!form.address.trim()) return "La dirección es obligatoria";
      if (!form.city.trim()) return "La ciudad es obligatoria";
    }
    if (step === 2) {
      if (!form.price_per_night || Number(form.price_per_night) <= 0)
        return "El precio por noche debe ser mayor a 0";
    }
    return "";
  }

  function handleNext() {
    const err = validate();
    if (err) { setError(err); return; }
    setStep((s) => s + 1);
    setError("");
  }

  // ── Envío ─────────────────────────────────────────────────────────────────

  // Paso 3 → 4: crear la propiedad y avanzar a fotos
  async function handleCreateAndContinue() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        price_per_night: Number(form.price_per_night),
        cleaning_fee: Number(form.cleaning_fee || 0),
        security_deposit: Number(form.security_deposit || 0),
        latitude: form.lat ?? 19.4326,
        longitude: form.lng ?? -99.1332,
      };
      const property = await post<{ id: string }>("/properties", payload);
      setCreatedPropertyId(property.id);
      setStep(4); // avanzar al paso de fotos
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al publicar la propiedad");
    } finally {
      setSaving(false);
    }
  }

  function handleFinish() {
    router.push(`/anfitrion`);
  }

  // Gate: mientras carga el estado de verificación
  if (verified === null) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8">
          <div className="card p-6 animate-pulse space-y-3">
            <div className="skeleton h-6 w-1/2 rounded" />
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
        </main>
      </div>
    );
  }

  // Gate: usuario no verificado → pedir verificación antes de publicar
  if (!verified) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <main className="max-w-lg mx-auto px-4 py-16">
          <div className="card p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
              <Settings size={26} className="text-[var(--color-primary)]" />
            </div>
            <h1 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-2">
              Verifica tu cuenta para ser anfitrión
            </h1>
            <p className="text-body text-[var(--text-secondary)] mb-6">
              Para publicar una propiedad necesitas verificar tu número de teléfono
              y tu identidad. Es rápido y solo se hace una vez.
            </p>
            <div className="space-y-2 text-left mb-6">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-subtle)]">
                <span className="text-xl">📱</span>
                <div>
                  <p className="text-body-sm font-medium text-[var(--text-primary)]">Verificación de teléfono</p>
                  <p className="text-caption text-[var(--text-secondary)]">Código por SMS o WhatsApp</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-subtle)]">
                <span className="text-xl">🪪</span>
                <div>
                  <p className="text-body-sm font-medium text-[var(--text-primary)]">Verificación de identidad</p>
                  <p className="text-caption text-[var(--text-secondary)]">Documento oficial + verificación facial</p>
                </div>
              </div>
            </div>
            <Link href="/anfitrion/configuracion?seccion=seguridad" className="btn btn-primary w-full">
              Verificar mi cuenta
            </Link>
            <Link href="/anfitrion" className="block text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mt-4">
              Volver al panel
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/anfitrion" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-display font-display font-medium text-[var(--text-primary)]">
              Publicar propiedad
            </h1>
            <p className="text-body-sm text-[var(--text-secondary)]">
              Paso {step + 1} de {STEPS.length} — {STEPS[step].label}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors text-caption",
                  i < step
                    ? "bg-[var(--color-primary)] text-white cursor-pointer"
                    : i === step
                    ? "bg-[var(--color-primary-light)] text-[var(--color-primary)] border-2 border-[var(--color-primary)]"
                    : "bg-[var(--bg-subtle)] text-[var(--text-tertiary)]"
                )}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 rounded-full",
                  i < step ? "bg-[var(--color-primary)]" : "bg-[var(--border-subtle)]"
                )} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-5">
            {error}
          </div>
        )}

        {/* Steps */}
        <div className="card p-6">
          {step === 0 && <Step1 form={form} set={set} />}
          {step === 1 && <Step2 form={form} set={set} />}
          {step === 2 && <Step3 form={form} set={set} />}
          {step === 3 && <Step4 form={form} set={set} amenities={amenities} />}
          {step === 4 && createdPropertyId && (
            <Step5 propertyId={createdPropertyId} />
          )}
        </div>

        {/* Navegación */}
        <div className="flex justify-between mt-6">
          {step < 4 && (
            <button
              onClick={() => step > 0 ? setStep((s) => s - 1) : router.push("/anfitrion")}
              className="btn btn-outline flex items-center gap-2"
            >
              <ChevronLeft size={16} />
              {step === 0 ? "Cancelar" : "Atrás"}
            </button>
          )}

          {step < 3 && (
            <button onClick={handleNext} className="btn btn-primary flex items-center gap-2">
              Siguiente
              <ChevronRight size={16} />
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleCreateAndContinue}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2 min-w-[160px] justify-center"
            >
              {saving ? (
                <><Loader2 size={16} className="animate-spin" /> Creando…</>
              ) : (
                <><ChevronRight size={16} /> Continuar a fotos</>
              )}
            </button>
          )}

          {step === 4 && (
            <button onClick={handleFinish} className="btn btn-primary flex items-center gap-2 w-full justify-center">
              <Check size={16} /> Finalizar publicación
            </button>
          )}
        </div>

        {step < 4 && (
          <p className="text-caption text-[var(--text-tertiary)] text-center mt-4">
            Tu propiedad quedará en revisión antes de aparecer en búsquedas
          </p>
        )}
      </main>
    </div>
  );
}

// ── Step 1: Básicos ───────────────────────────────────────────────────────────

function Step1({ form, set }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">¿Qué tipo de espacio es?</h2>
        <p className="text-body-sm text-[var(--text-secondary)]">Elige la opción que mejor describe tu propiedad</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {PROPERTY_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => set("property_type", t.value)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
              form.property_type === t.value
                ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
            )}
          >
            <span className="text-2xl">{t.icon}</span>
            <span className={cn(
              "text-caption font-medium",
              form.property_type === t.value ? "text-[var(--color-primary)]" : "text-[var(--text-secondary)]"
            )}>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="divider" />

      <div>
        <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
          Título del anuncio <span className="text-red-500">*</span>
        </label>
        <input
          className="input w-full"
          placeholder="Ej: Casa colonial con piscina en el centro"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={100}
        />
        <p className="text-caption text-[var(--text-tertiary)] mt-1">{form.title.length}/100</p>
      </div>

      <div>
        <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
          Descripción <span className="text-red-500">*</span>
        </label>
        <textarea
          className="input w-full resize-none"
          rows={5}
          placeholder="Describe tu propiedad: qué la hace especial, el ambiente, la ubicación, qué pueden hacer los huéspedes..."
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
        <p className={cn(
          "text-caption mt-1",
          form.description.length < 20 ? "text-[var(--text-tertiary)]" : "text-[var(--color-primary)]"
        )}>
          {form.description.length} caracteres (mínimo 20)
        </p>
      </div>
    </div>
  );
}

// ── Step 2: Ubicación ─────────────────────────────────────────────────────────

function Step2({ form, set }: StepProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">¿Dónde está tu propiedad?</h2>
        <p className="text-body-sm text-[var(--text-secondary)]">
          La dirección exacta solo se comparte con huéspedes confirmados
        </p>
      </div>

      <LocationPicker
        initialAddress={form.address}
        onSelect={(result) => {
          set("address", result.address);
          set("neighborhood", result.neighborhood);
          set("city", result.city);
          set("state", result.state);
          set("lat", result.lat);
          set("lng", result.lng);
        }}
      />
    </div>
  );
}

// ── Step 3: Capacidad y precio ────────────────────────────────────────────────

function Step3({ form, set }: StepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Capacidad y precio</h2>
        <p className="text-body-sm text-[var(--text-secondary)]">¿Cuántas personas caben y cuánto cobras?</p>
      </div>

      {/* Contadores */}
      <div className="space-y-4">
        {([
          { key: "max_guests", label: "Huéspedes máximos", min: 1, max: 30 },
          { key: "bedrooms",   label: "Habitaciones",       min: 0, max: 20 },
          { key: "beds",       label: "Camas",              min: 1, max: 30 },
          { key: "bathrooms",  label: "Baños",              min: 1, max: 20 },
        ] as { key: keyof FormData; label: string; min: number; max: number }[]).map(({ key, label, min, max }) => (
          <div key={key} className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)] last:border-0">
            <span className="text-body font-medium text-[var(--text-primary)]">{label}</span>
            <div className="flex items-center gap-4">
              <button
                onClick={() => set(key, Math.max(min, (form[key] as number) - 1) as any)}
                className="w-8 h-8 rounded-full border border-[var(--border-default)] flex items-center justify-center hover:border-[var(--text-primary)] transition-colors disabled:opacity-30"
                disabled={(form[key] as number) <= min}
              >
                <Minus size={14} />
              </button>
              <span className="text-body font-semibold text-[var(--text-primary)] w-6 text-center">
                {form[key] as number}
              </span>
              <button
                onClick={() => set(key, Math.min(max, (form[key] as number) + 1) as any)}
                className="w-8 h-8 rounded-full border border-[var(--border-default)] flex items-center justify-center hover:border-[var(--text-primary)] transition-colors disabled:opacity-30"
                disabled={(form[key] as number) >= max}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="divider" />

      {/* Precios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
            Precio por noche <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-[var(--text-tertiary)]">$</span>
            <input
              type="number"
              className="input w-full"
              style={{ paddingLeft: "1.75rem" }}
              placeholder="0"
              min={0}
              value={form.price_per_night}
              onChange={(e) => set("price_per_night", e.target.value)}
            />
          </div>
          <p className="text-caption text-[var(--text-tertiary)] mt-1">MXN / noche</p>
        </div>

        <div>
          <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
            Tarifa de limpieza
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-[var(--text-tertiary)]">$</span>
            <input
              type="number"
              className="input w-full"
              style={{ paddingLeft: "1.75rem" }}
              placeholder="0"
              min={0}
              value={form.cleaning_fee}
              onChange={(e) => set("cleaning_fee", e.target.value)}
            />
          </div>
          <p className="text-caption text-[var(--text-tertiary)] mt-1">Por estancia</p>
        </div>

        <div>
          <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
            Depósito de seguridad
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-[var(--text-tertiary)]">$</span>
            <input
              type="number"
              className="input w-full"
              style={{ paddingLeft: "1.75rem" }}
              placeholder="0"
              min={0}
              value={form.security_deposit}
              onChange={(e) => set("security_deposit", e.target.value)}
            />
          </div>
          <p className="text-caption text-[var(--text-tertiary)] mt-1">Reembolsable</p>
        </div>
      </div>

      <div>
        <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
          Mínimo de noches
        </label>
        <select
          className="input w-full sm:w-48"
          value={form.min_stay_nights}
          onChange={(e) => set("min_stay_nights", Number(e.target.value))}
        >
          {[1, 2, 3, 5, 7, 14, 30].map((n) => (
            <option key={n} value={n}>{n} {n === 1 ? "noche" : "noches"}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Step 4: Políticas y amenidades ────────────────────────────────────────────

// Emoji por slug de amenidad (consistente para todas). Fallback por categoría.
const AMENITY_EMOJI: Record<string, string> = {
  wifi: "📶", aire_acondicionado: "❄️", calefaccion: "🔥", estacionamiento: "🚗",
  televisor: "📺", tv: "📺", lavadora: "🧺", secadora: "🌀",
  cocina: "🍳", cocina_equipada: "🍳", microondas: "🍲", cafetera: "☕",
  refrigerador: "🧊", utensilios: "🍴",
  piscina: "🏊", alberca: "🏊", terraza: "🌿", jardin: "🌳", asador: "🍖", hamaca: "🌴",
  mascotas_ok: "🐾",
  toallas: "🧖", secador_pelo: "💨", articulos_bano: "🧴",
  ropa_cama: "🛏️", closet: "🗄️", cuna: "🍼",
  caja_seguridad: "🔒", extinguidor: "🧯", detector_humo: "🚨", botiquin: "🩹",
  netflix: "🎬", mesa_trabajo: "💻",
  acceso_silla_ruedas: "♿", sin_escaleras: "🚶",
  desayuno: "🥐", servicio_limpieza: "🧹", recepcion_24h: "🛎️",
};
const CATEGORY_EMOJI: Record<string, string> = {
  basicos: "✨", cocina: "🍳", exteriores: "🌿", exterior: "🌿", reglas: "📋",
  bano: "🚿", dormitorio: "🛏️", seguridad: "🛡️", entretenimiento: "🎬",
  accesibilidad: "♿", servicios: "🛎️",
};
function amenityEmoji(a: Amenity): string {
  return AMENITY_EMOJI[a.slug] ?? CATEGORY_EMOJI[a.category] ?? "•";
}

function Step4({ form, set, amenities }: StepProps & { amenities: Amenity[] }) {
  // Dedup por nombre (la BD tiene duplicados: Alberca, Cocina equipada, TV…)
  const seenNames = new Set<string>();
  const uniqueAmenities = amenities.filter((a) => {
    const key = a.name_es.trim().toLowerCase();
    if (seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });
  const grouped = uniqueAmenities.reduce<Record<string, Amenity[]>>((acc, a) => {
    (acc[a.category] = acc[a.category] ?? []).push(a);
    return acc;
  }, {});

  const POLICY_OPTIONS: { value: CancellationPolicy; label: string; desc: string }[] = [
    { value: "flexible", label: "Flexible", desc: "Reembolso completo hasta 24h antes del check-in" },
    { value: "moderate", label: "Moderada", desc: "Reembolso completo hasta 5 días antes del check-in" },
    { value: "strict",   label: "Estricta", desc: "Reembolso del 50% hasta 1 semana antes del check-in" },
  ];

  const RULES = [
    { key: "instant_booking", label: "Reserva inmediata",    desc: "Los huéspedes pueden reservar sin tu aprobación previa" },
    { key: "allows_pets",     label: "Se aceptan mascotas",  desc: "" },
    { key: "allows_smoking",  label: "Se permite fumar",     desc: "" },
    { key: "allows_events",   label: "Se permiten eventos",  desc: "" },
  ] as { key: keyof FormData; label: string; desc: string }[];

  function toggleAmenity(id: string) {
    const ids = form.amenity_ids;
    set("amenity_ids", ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Políticas y comodidades</h2>
        <p className="text-body-sm text-[var(--text-secondary)]">Define las reglas y lo que ofrece tu propiedad</p>
      </div>

      {/* Horarios */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Check-in</label>
          <input
            type="time"
            className="input w-full"
            value={form.check_in_time}
            onChange={(e) => set("check_in_time", e.target.value)}
          />
        </div>
        <div>
          <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Check-out</label>
          <input
            type="time"
            className="input w-full"
            value={form.check_out_time}
            onChange={(e) => set("check_out_time", e.target.value)}
          />
        </div>
      </div>

      {/* Política de cancelación */}
      <div>
        <p className="text-body-sm font-medium text-[var(--text-primary)] mb-3">Política de cancelación</p>
        <div className="space-y-2">
          {POLICY_OPTIONS.map((p) => (
            <label
              key={p.value}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all",
                form.cancellation_policy === p.value
                  ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
                  : "border-[var(--border-subtle)] hover:border-[var(--border-default)]"
              )}
            >
              <input
                type="radio"
                name="cancellation"
                className="mt-0.5 accent-[var(--color-primary)]"
                checked={form.cancellation_policy === p.value}
                onChange={() => set("cancellation_policy", p.value)}
              />
              <div>
                <p className="text-body-sm font-medium text-[var(--text-primary)]">{p.label}</p>
                <p className="text-caption text-[var(--text-secondary)]">{p.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Reglas */}
      <div>
        <p className="text-body-sm font-medium text-[var(--text-primary)] mb-3">Reglas y opciones</p>
        <div className="space-y-3">
          {RULES.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-body-sm font-medium text-[var(--text-primary)]">{label}</p>
                {desc && <p className="text-caption text-[var(--text-secondary)]">{desc}</p>}
              </div>
              <button
                onClick={() => set(key, !form[key] as any)}
                className={cn(
                  "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
                  form[key] ? "bg-[var(--color-primary)]" : "bg-[var(--border-strong)]"
                )}
              >
                <span className={cn(
                  "inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5",
                  form[key] ? "translate-x-5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Amenidades */}
      {Object.keys(grouped).length > 0 && (
        <div>
          <p className="text-body-sm font-medium text-[var(--text-primary)] mb-3">
            Comodidades ({form.amenity_ids.length} seleccionadas)
          </p>
          <div className="space-y-4">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <p className="text-caption font-medium text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
                  {category}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {items.map((a) => {
                    const selected = form.amenity_ids.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleAmenity(a.id)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all",
                          selected
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                            : "border-[var(--border-subtle)] hover:border-[var(--border-default)] text-[var(--text-secondary)]"
                        )}
                      >
                        <span className="text-base flex-shrink-0 w-5 text-center">{amenityEmoji(a)}</span>
                        <span className="text-caption font-medium truncate">{a.name_es}</span>
                        {selected && <Check size={12} className="ml-auto flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step 5: Fotos ─────────────────────────────────────────────────────────────

function Step5({ propertyId }: { propertyId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">
          ¡Propiedad creada! Ahora agrega fotos
        </h2>
        <p className="text-body-sm text-[var(--text-secondary)]">
          Las propiedades con fotos reciben hasta 5× más reservas. Sube al menos 3 fotos de buena calidad.
        </p>
      </div>

      <div className="bg-[var(--color-primary-light)] rounded-xl p-4 flex items-start gap-3">
        <Camera size={18} className="text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
        <div className="text-body-sm text-[var(--color-primary)]">
          <p className="font-medium mb-1">Consejos para mejores fotos</p>
          <ul className="space-y-0.5 text-body-sm opacity-80">
            <li>· Toma fotos con luz natural (mañana o tarde)</li>
            <li>· Captura la entrada, sala, cocina, baño y habitaciones</li>
            <li>· La primera foto será la portada que ven los huéspedes</li>
          </ul>
        </div>
      </div>

      <PhotoUploader propertyId={propertyId} maxPhotos={20} />
    </div>
  );
}

// ── Tipos internos ────────────────────────────────────────────────────────────

type SetFn = <K extends keyof FormData>(key: K, value: FormData[K]) => void;
interface StepProps { form: FormData; set: SetFn; }
