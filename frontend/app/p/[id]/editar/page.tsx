"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import PhotoUploader from "@/components/PhotoUploader";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, Save, Loader2, Check, Eye, EyeOff,
  AlertCircle, Plus, Minus, Info,
} from "lucide-react";
import type { Property } from "@/types";

interface EditForm {
  title: string;
  description: string;
  price_per_night: string;
  cleaning_fee: string;
  security_deposit: string;
  min_stay_nights: number;
  max_stay_nights: string;
  cancellation_policy: "flexible" | "moderate" | "strict";
  check_in_time: string;
  check_out_time: string;
  instant_booking: boolean;
  allows_pets: boolean;
  allows_smoking: boolean;
  allows_events: boolean;
  status: "active" | "inactive";
}

const POLICY_OPTIONS = [
  { value: "flexible", label: "Flexible", desc: "Reembolso completo hasta 24 h antes del check-in" },
  { value: "moderate", label: "Moderada", desc: "Reembolso completo hasta 5 días antes del check-in" },
  { value: "strict",   label: "Estricta", desc: "Reembolso del 50% hasta 1 semana antes" },
];

const TOGGLES = [
  { key: "instant_booking", label: "Reserva inmediata",    desc: "Los huéspedes reservan sin tu aprobación previa" },
  { key: "allows_pets",     label: "Se aceptan mascotas",  desc: "" },
  { key: "allows_smoking",  label: "Se permite fumar",     desc: "" },
  { key: "allows_events",   label: "Se permiten eventos",  desc: "" },
] as const;

export default function EditarPropiedadPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { get, patch } = useApi();

  const [property, setProperty] = useState<Property | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push(`/iniciar-sesion?redirect_url=/p/${params.id}/editar`);
      return;
    }
    get<Property>(`/properties/${params.id}`)
      .then((p) => {
        setProperty(p);
        setForm({
          title: p.title,
          description: p.description,
          price_per_night: String(p.price_per_night),
          cleaning_fee: String(p.cleaning_fee ?? 0),
          security_deposit: String(p.security_deposit ?? 0),
          min_stay_nights: p.min_stay_nights ?? 1,
          max_stay_nights: p.max_stay_nights ? String(p.max_stay_nights) : "",
          cancellation_policy: (p.cancellation_policy as any) ?? "flexible",
          check_in_time: p.check_in_time ? String(p.check_in_time).slice(0, 5) : "15:00",
          check_out_time: p.check_out_time ? String(p.check_out_time).slice(0, 5) : "11:00",
          instant_booking: p.instant_booking ?? false,
          allows_pets: p.allows_pets ?? false,
          allows_smoking: p.allows_smoking ?? false,
          allows_events: p.allows_events ?? false,
          status: (p.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
        });
      })
      .catch(() => setError("No se pudo cargar la propiedad"))
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded, params.id]);

  function setField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
    setError("");
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        price_per_night: Number(form.price_per_night),
        cleaning_fee: Number(form.cleaning_fee || 0),
        security_deposit: Number(form.security_deposit || 0),
        min_stay_nights: form.min_stay_nights,
        cancellation_policy: form.cancellation_policy,
        check_in_time: form.check_in_time + ":00",
        check_out_time: form.check_out_time + ":00",
        instant_booking: form.instant_booking,
        allows_pets: form.allows_pets,
        allows_smoking: form.allows_smoking,
        allows_events: form.allows_events,
        status: form.status,
      };
      if (form.max_stay_nights) payload.max_stay_nights = Number(form.max_stay_nights);

      await patch(`/properties/${params.id}`, payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse space-y-3">
              <div className="skeleton h-5 w-1/3 rounded" />
              <div className="skeleton h-10 w-full rounded-xl" />
              <div className="skeleton h-10 w-full rounded-xl" />
            </div>
          ))}
        </main>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <Navbar />
        <div className="empty-state min-h-[60vh]">
          <AlertCircle size={40} className="text-red-400" />
          <p className="text-body text-[var(--text-secondary)]">{error}</p>
          <Link href="/anfitrion" className="btn btn-primary mt-2">Volver al dashboard</Link>
        </div>
      </div>
    );
  }

  if (!form || !property) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/anfitrion" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-display font-display font-medium text-[var(--text-primary)]">
                Editar propiedad
              </h1>
              <p className="text-body-sm text-[var(--text-secondary)] line-clamp-1 max-w-xs">
                {property.title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link
              href={`/p/${params.id}`}
              target="_blank"
              className="btn btn-outline text-body-sm flex items-center gap-1.5 px-3 py-2"
            >
              <Eye size={14} />
              Ver
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2 px-4 py-2"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : saved ? (
                <Check size={15} />
              ) : (
                <Save size={15} />
              )}
              {saving ? "Guardando…" : saved ? "Guardado" : "Guardar"}
            </button>
          </div>
        </div>

        {/* Status */}
        <div className={cn(
          "rounded-xl p-4 mb-6 flex items-center justify-between",
          form.status === "active"
            ? "bg-[var(--color-primary-light)] border border-[var(--color-primary)]"
            : "bg-amber-50 border border-amber-300"
        )}>
          <div className="flex items-center gap-2">
            {form.status === "active" ? (
              <Eye size={16} className="text-[var(--color-primary)]" />
            ) : (
              <EyeOff size={16} className="text-amber-600" />
            )}
            <p className={cn(
              "text-body-sm font-medium",
              form.status === "active" ? "text-[var(--color-primary)]" : "text-amber-700"
            )}>
              {form.status === "active" ? "Visible en búsquedas" : "Oculta (inactiva)"}
            </p>
          </div>
          <button
            onClick={() => setField("status", form.status === "active" ? "inactive" : "active")}
            className={cn(
              "text-body-sm font-medium px-3 py-1 rounded-lg transition-colors",
              form.status === "active"
                ? "text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
                : "text-amber-700 hover:bg-amber-200"
            )}
          >
            {form.status === "active" ? "Ocultar" : "Activar"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-6">

          {/* Información básica */}
          <Section title="Información básica">
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Título</label>
              <input
                className="input w-full"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                maxLength={100}
              />
              <p className="text-caption text-[var(--text-tertiary)] mt-1">{form.title.length}/100</p>
            </div>
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Descripción</label>
              <textarea
                className="input w-full resize-none"
                rows={5}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
              <p className="text-caption text-[var(--text-tertiary)] mt-1">
                {form.description.length} caracteres
              </p>
            </div>
          </Section>

          {/* Precios */}
          <Section title="Precios">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Precio por noche</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-[var(--text-tertiary)]">$</span>
                  <input
                    type="number"
                    className="input w-full"
                    style={{ paddingLeft: "1.75rem" }}
                    min={0}
                    value={form.price_per_night}
                    onChange={(e) => setField("price_per_night", e.target.value)}
                  />
                </div>
                <p className="text-caption text-[var(--text-tertiary)] mt-1">MXN / noche</p>
              </div>
              <div>
                <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Tarifa de limpieza</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-[var(--text-tertiary)]">$</span>
                  <input
                    type="number"
                    className="input w-full"
                    style={{ paddingLeft: "1.75rem" }}
                    min={0}
                    value={form.cleaning_fee}
                    onChange={(e) => setField("cleaning_fee", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Depósito de seguridad</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-body-sm text-[var(--text-tertiary)]">$</span>
                  <input
                    type="number"
                    className="input w-full"
                    style={{ paddingLeft: "1.75rem" }}
                    min={0}
                    value={form.security_deposit}
                    onChange={(e) => setField("security_deposit", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-primary-border)] p-3">
              <Info size={15} className="text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
              <p className="text-caption text-[var(--text-secondary)] leading-snug">
                El precio por noche es el <strong>monto que recibirás</strong> (Beel no te
                descuenta comisión) y se considera con <strong>IVA incluido</strong>. Cada
                anfitrión es responsable de su propia <strong>facturación e impuestos</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Mínimo de noches</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setField("min_stay_nights", Math.max(1, form.min_stay_nights - 1))}
                    className="w-8 h-8 rounded-full border border-[var(--border-default)] flex items-center justify-center hover:border-[var(--text-primary)] transition-colors"
                    disabled={form.min_stay_nights <= 1}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-body font-semibold w-8 text-center">{form.min_stay_nights}</span>
                  <button
                    onClick={() => setField("min_stay_nights", Math.min(365, form.min_stay_nights + 1))}
                    className="w-8 h-8 rounded-full border border-[var(--border-default)] flex items-center justify-center hover:border-[var(--text-primary)] transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Máximo de noches (opcional)</label>
                <input
                  type="number"
                  className="input w-full"
                  min={1}
                  placeholder="Sin límite"
                  value={form.max_stay_nights}
                  onChange={(e) => setField("max_stay_nights", e.target.value)}
                />
              </div>
            </div>
          </Section>

          {/* Horarios */}
          <Section title="Horarios">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Check-in</label>
                <input
                  type="time"
                  className="input w-full"
                  value={form.check_in_time}
                  onChange={(e) => setField("check_in_time", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Check-out</label>
                <input
                  type="time"
                  className="input w-full"
                  value={form.check_out_time}
                  onChange={(e) => setField("check_out_time", e.target.value)}
                />
              </div>
            </div>
          </Section>

          {/* Política de cancelación */}
          <Section title="Política de cancelación">
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
                    name="policy"
                    className="mt-0.5 accent-[var(--color-primary)]"
                    checked={form.cancellation_policy === p.value}
                    onChange={() => setField("cancellation_policy", p.value as any)}
                  />
                  <div>
                    <p className="text-body-sm font-medium text-[var(--text-primary)]">{p.label}</p>
                    <p className="text-caption text-[var(--text-secondary)]">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </Section>

          {/* Reglas */}
          <Section title="Reglas y opciones">
            <div className="space-y-4">
              {TOGGLES.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-body-sm font-medium text-[var(--text-primary)]">{label}</p>
                    {desc && <p className="text-caption text-[var(--text-secondary)]">{desc}</p>}
                  </div>
                  <button
                    onClick={() => setField(key, !form[key] as any)}
                    className={cn(
                      "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
                      form[key] ? "bg-[var(--color-primary)]" : "bg-[var(--border-strong)]"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-5 w-5 rounded-full bg-[var(--bg-elevated)] shadow transform transition-transform duration-200 mt-0.5",
                      form[key] ? "translate-x-5" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </Section>

          {/* Fotos */}
          <Section title="Fotos">
            <p className="text-body-sm text-[var(--text-secondary)] mb-4">
              Arrastra para reordenar. La foto con ★ es la portada que ven los huéspedes.
            </p>
            <PhotoUploader
              propertyId={params.id}
              initialPhotos={property.photos?.map((ph) => ({
                id: ph.id,
                url: ph.url,
                is_primary: ph.is_primary,
                display_order: ph.display_order,
                caption: ph.caption,
              })) ?? []}
            />
          </Section>

          {/* Info no editable */}
          <Section title="Información de la propiedad" collapsible defaultCollapsed>
            <div className="grid grid-cols-2 gap-3 text-body-sm">
              <InfoRow label="Tipo" value={property.property_type} />
              <InfoRow label="Ciudad" value={`${property.city}, ${property.state}`} />
              <InfoRow label="Huéspedes" value={`Hasta ${property.max_guests}`} />
              <InfoRow label="Habitaciones" value={String(property.bedrooms)} />
              <InfoRow label="Camas" value={String(property.beds)} />
              <InfoRow label="Baños" value={String(property.bathrooms)} />
            </div>
            <p className="text-caption text-[var(--text-tertiary)] mt-3">
              Para cambiar tipo, dirección o capacidad contacta a soporte.
            </p>
          </Section>

        </div>

        {/* Guardar sticky abajo en móvil */}
        <div className="sticky bottom-4 mt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary w-full flex items-center justify-center gap-2 py-3 shadow-lg"
          >
            {saving ? (
              <><Loader2 size={16} className="animate-spin" /> Guardando…</>
            ) : saved ? (
              <><Check size={16} /> ¡Cambios guardados!</>
            ) : (
              <><Save size={16} /> Guardar cambios</>
            )}
          </button>
        </div>

      </main>
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Section({
  title,
  children,
  collapsible = false,
  defaultCollapsed = false,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="card p-6">
      <div
        className={cn("flex items-center justify-between mb-5", collapsible && "cursor-pointer")}
        onClick={() => collapsible && setCollapsed(!collapsed)}
      >
        <h2 className="text-h3 font-semibold text-[var(--text-primary)]">{title}</h2>
        {collapsible && (
          <span className="text-caption text-[var(--text-tertiary)]">
            {collapsed ? "Mostrar" : "Ocultar"}
          </span>
        )}
      </div>
      {!collapsed && <div className="space-y-4">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 border-b border-[var(--border-subtle)] last:border-0">
      <p className="text-caption text-[var(--text-tertiary)]">{label}</p>
      <p className="text-body-sm font-medium text-[var(--text-primary)] capitalize">{value}</p>
    </div>
  );
}
