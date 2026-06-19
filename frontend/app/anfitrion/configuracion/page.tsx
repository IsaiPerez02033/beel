"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";
import { ChevronLeft, User, Bell, Shield, CreditCard, ChevronRight, Check } from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  is_phone_verified: boolean;
  is_identity_verified: boolean;
  preferred_language: string;
  host_since?: string;
  total_listings: number;
}

type Section = "perfil" | "notificaciones" | "seguridad" | "pagos";

const SECTIONS: { key: Section; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "perfil",          label: "Perfil",           icon: <User size={18} />,       description: "Nombre, teléfono, idioma" },
  { key: "notificaciones",  label: "Notificaciones",   icon: <Bell size={18} />,       description: "Email, WhatsApp, reservas" },
  { key: "seguridad",       label: "Seguridad",        icon: <Shield size={18} />,     description: "Verificación de identidad" },
  { key: "pagos",           label: "Pagos",            icon: <CreditCard size={18} />, description: "Método de cobro de tus reservas" },
];

export default function ConfiguracionAnfitrionPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { get, patch } = useApi();

  const [section, setSection] = useState<Section>("perfil");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("es");

  // Notification prefs (UI only — backend a futuro)
  const [notifReservations, setNotifReservations] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifReviews, setNotifReviews] = useState(true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/iniciar-sesion?redirect_url=/anfitrion/configuracion");
      return;
    }
    get<UserProfile>("/users/me")
      .then((data) => {
        setProfile(data);
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
        setLanguage(data.preferred_language ?? "es");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isSignedIn, isLoaded]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await patch<UserProfile>("/users/me", {
        full_name: fullName,
        phone: phone || null,
        preferred_language: language,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/anfitrion" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div>
            <h1 className="text-display font-display font-medium text-[var(--text-primary)]">
              Configuración
            </h1>
            <p className="text-body text-[var(--text-secondary)]">
              Gestiona tu cuenta de anfitrión
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar nav */}
          <nav className="md:w-56 flex-shrink-0">
            <ul className="space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.key}>
                  <button
                    onClick={() => setSection(s.key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors",
                      section === s.key
                        ? "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {s.icon}
                    <div>
                      <p className="text-body-sm font-medium">{s.label}</p>
                      <p className="text-micro text-[var(--text-tertiary)] hidden md:block">{s.description}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1">
            {loading ? (
              <div className="card p-6 space-y-4 animate-pulse">
                <div className="skeleton h-5 w-1/3 rounded" />
                <div className="skeleton h-10 w-full rounded-xl" />
                <div className="skeleton h-10 w-full rounded-xl" />
                <div className="skeleton h-10 w-2/3 rounded-xl" />
              </div>
            ) : section === "perfil" ? (
              <div className="card p-6">
                <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-6">Perfil</h2>

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div>
                    <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      className="input w-full"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      className="input w-full opacity-60 cursor-not-allowed"
                      value={profile?.email ?? ""}
                      disabled
                      title="El correo se gestiona desde tu cuenta de Clerk"
                    />
                    <p className="text-caption text-[var(--text-tertiary)] mt-1">
                      El correo se gestiona desde tu cuenta de autenticación
                    </p>
                  </div>

                  <div>
                    <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                      Teléfono
                      {profile?.is_phone_verified && (
                        <span className="ml-2 badge badge-verified text-micro">Verificado</span>
                      )}
                    </label>
                    <input
                      className="input w-full"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      type="tel"
                      placeholder="+52 999 000 0000"
                    />
                  </div>

                  <div>
                    <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                      Idioma preferido
                    </label>
                    <select
                      className="input w-full"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="btn btn-primary flex items-center gap-2"
                    >
                      {saved ? <><Check size={16} /> Guardado</> : saving ? "Guardando…" : "Guardar cambios"}
                    </button>
                  </div>
                </form>
              </div>
            ) : section === "notificaciones" ? (
              <div className="card p-6">
                <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-6">Notificaciones</h2>
                <div className="space-y-5">
                  <ToggleRow
                    label="Nuevas solicitudes de reserva"
                    description="Recibe un aviso cuando un huésped solicita reservar"
                    value={notifReservations}
                    onChange={setNotifReservations}
                  />
                  <div className="divider" />
                  <ToggleRow
                    label="Mensajes nuevos"
                    description="Notificación cuando un huésped te escribe"
                    value={notifMessages}
                    onChange={setNotifMessages}
                  />
                  <div className="divider" />
                  <ToggleRow
                    label="Reseñas recibidas"
                    description="Cuando un huésped deja una calificación"
                    value={notifReviews}
                    onChange={setNotifReviews}
                  />
                  <div className="divider" />
                  <ToggleRow
                    label="Notificaciones por WhatsApp"
                    description="Recibir avisos vía WhatsApp (próximamente)"
                    value={notifWhatsapp}
                    onChange={setNotifWhatsapp}
                    disabled
                  />
                </div>
                <p className="text-caption text-[var(--text-tertiary)] mt-6">
                  Las preferencias de notificación se guardarán en una próxima actualización
                </p>
              </div>
            ) : section === "seguridad" ? (
              <div className="card p-6">
                <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-6">Seguridad</h2>
                <div className="space-y-4">
                  <VerificationRow
                    label="Verificación de identidad"
                    description="Sube una identificación oficial para aumentar la confianza de los huéspedes"
                    verified={profile?.is_identity_verified ?? false}
                    action="Verificar identidad"
                    onAction={() => {}}
                    disabled
                  />
                  <div className="divider" />
                  <VerificationRow
                    label="Número de teléfono"
                    description="Verifica tu número para mayor seguridad"
                    verified={profile?.is_phone_verified ?? false}
                    action="Verificar teléfono"
                    onAction={() => {}}
                    disabled
                  />
                </div>
                <p className="text-caption text-[var(--text-tertiary)] mt-6">
                  La verificación de identidad estará disponible próximamente
                </p>
              </div>
            ) : (
              <div className="card p-6">
                <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-2">Pagos</h2>
                <p className="text-body text-[var(--text-secondary)] mb-6">
                  Cómo recibirás los pagos de tus reservas
                </p>

                <div className="bg-[var(--bg-subtle)] rounded-xl p-5 mb-4">
                  <div className="flex items-start gap-3">
                    <CreditCard size={20} className="text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-body font-medium text-[var(--text-primary)]">
                        Modelo de pagos actual
                      </p>
                      <p className="text-body-sm text-[var(--text-secondary)] mt-1">
                        Los pagos de los huéspedes son retenidos por Beel hasta confirmar que
                        la estancia fue exitosa. Una vez que el equipo de Beel da el visto bueno,
                        el pago se transfiere a tu cuenta.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
                    <div>
                      <p className="text-body-sm font-medium text-[var(--text-primary)]">Comisión de plataforma</p>
                      <p className="text-caption text-[var(--text-secondary)]">Porcentaje retenido por Beel</p>
                    </div>
                    <span className="badge badge-verified">0% — Gratuito</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-body-sm font-medium text-[var(--text-primary)]">Tiempo de pago</p>
                      <p className="text-caption text-[var(--text-secondary)]">Desde la aprobación de Beel</p>
                    </div>
                    <span className="text-body-sm text-[var(--text-secondary)]">1–3 días hábiles</span>
                  </div>
                </div>

                <p className="text-caption text-[var(--text-tertiary)] mt-6">
                  Próximamente: conecta tu cuenta de MercadoPago para recibir pagos automáticamente
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ToggleRow({
  label, description, value, onChange, disabled = false,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", disabled && "opacity-50")}>
      <div>
        <p className="text-body-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-caption text-[var(--text-secondary)]">{description}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!value)}
        className={cn(
          "relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200",
          value ? "bg-[var(--color-primary)]" : "bg-[var(--border-strong)]",
          disabled && "cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5",
            value ? "translate-x-5" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

function VerificationRow({
  label, description, verified, action, onAction, disabled = false,
}: {
  label: string;
  description: string;
  verified: boolean;
  action: string;
  onAction: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="text-body-sm font-medium text-[var(--text-primary)]">{label}</p>
          {verified && <span className="badge badge-verified text-micro">Verificado</span>}
        </div>
        <p className="text-caption text-[var(--text-secondary)] mt-0.5">{description}</p>
      </div>
      {!verified && (
        <button
          onClick={onAction}
          disabled={disabled}
          className="btn btn-outline text-body-sm px-4 py-1.5 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {action}
        </button>
      )}
    </div>
  );
}
