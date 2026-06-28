"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import { cn } from "@/lib/utils";
import { ChevronLeft, User, Bell, Shield, CreditCard, ChevronRight, Check, Camera, Loader2, Phone, BadgeCheck, ShieldCheck, MessageCircle } from "lucide-react";

const API_BASE = typeof window !== "undefined" ? "/api/backend" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/v1";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  phone_country_code?: string;
  avatar_url?: string;
  is_phone_verified: boolean;
  is_identity_verified: boolean;
  identity_status?: string;
  preferred_language: string;
  host_since?: string;
  total_listings: number;
  bank_name?: string;
  bank_clabe?: string;
  bank_account_holder?: string;
}

type Section = "perfil" | "notificaciones" | "seguridad" | "pagos";

const SECTIONS: { key: Section; label: string; icon: React.ReactNode; description: string }[] = [
  { key: "perfil",          label: "Perfil",           icon: <User size={18} />,       description: "Nombre, teléfono, idioma" },
  { key: "notificaciones",  label: "Notificaciones",   icon: <Bell size={18} />,       description: "Email, WhatsApp, reservas" },
  { key: "seguridad",       label: "Seguridad",        icon: <Shield size={18} />,     description: "Verificación de identidad" },
  { key: "pagos",           label: "Pagos",            icon: <CreditCard size={18} />, description: "Método de cobro de tus reservas" },
];

export default function ConfiguracionAnfitrionPage() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const router = useRouter();
  const { get, patch } = useApi();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sección inicial desde ?seccion=seguridad (al venir del gate o del menú)
  const validSections: Section[] = ["perfil", "notificaciones", "seguridad", "pagos"];
  const paramSection = searchParams.get("seccion") as Section | null;
  const initialSection: Section =
    paramSection && validSections.includes(paramSection) ? paramSection : "perfil";
  const [section, setSection] = useState<Section>(initialSection);

  // Sincroniza la sección cuando cambia el query param (?seccion=...) sin remontar.
  useEffect(() => {
    if (paramSection && validSections.includes(paramSection)) {
      setSection(paramSection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramSection]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("es");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Form state para datos bancarios
  const [bankName, setBankName] = useState("");
  const [bankClabe, setBankClabe] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [savingBank, setSavingBank] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankError, setBankError] = useState("");
  const [bankConfirmStep, setBankConfirmStep] = useState(false);

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
        setBankName(data.bank_name ?? "");
        setBankClabe(data.bank_clabe ?? "");
        setBankAccountHolder(data.bank_account_holder ?? "");
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

  function handleBankSubmitStep1(e: React.FormEvent) {
    e.preventDefault();
    setBankError("");
    const cleanedClabe = bankClabe.trim();
    if (!cleanedClabe) { setBankError("La CLABE es obligatoria"); return; }
    if (!/^\d{18}$/.test(cleanedClabe)) {
      setBankError("La cuenta CLABE debe contener exactamente 18 dígitos numéricos");
      return;
    }
    if (!bankAccountHolder.trim()) { setBankError("El nombre del titular es obligatorio"); return; }
    // Mostrar paso de confirmación
    setBankConfirmStep(true);
  }

  async function handleSaveBankDetails() {
    setSavingBank(true);
    setBankError("");
    setBankSaved(false);
    const cleanedClabe = bankClabe.trim();
    try {
      const updated = await patch<UserProfile>("/users/me", {
        bank_name: bankName || null,
        bank_clabe: cleanedClabe || null,
        bank_account_holder: bankAccountHolder || null,
      });
      setProfile(updated);
      setBankSaved(true);
      setBankConfirmStep(false);
      setTimeout(() => setBankSaved(false), 3000);
    } catch (err) {
      setBankError(err instanceof Error ? err.message : "Error al guardar los datos bancarios");
      setBankConfirmStep(false);
    } finally {
      setSavingBank(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError("Solo se permiten imágenes JPEG, PNG o WebP");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("La imagen debe pesar menos de 10 MB");
      return;
    }

    setUploadingAvatar(true);
    setError("");
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/users/me/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Error al subir la foto");
      }
      const updated = await res.json();
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir la foto");
    } finally {
      setUploadingAvatar(false);
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
          {/* Sidebar nav — horizontal scroll on mobile, vertical on desktop */}
          <nav className="md:w-56 flex-shrink-0">
            <ul className="flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
              {SECTIONS.map((s) => (
                <li key={s.key} className="flex-shrink-0 md:flex-shrink">
                  <button
                    onClick={() => setSection(s.key)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors whitespace-nowrap md:whitespace-normal",
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

                {/* Foto de perfil */}
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-[var(--border-subtle)]">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden bg-[var(--color-primary-light)] flex-shrink-0">
                    {profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt="Foto de perfil" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--color-primary)] text-h1 font-semibold">
                        {(fullName || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 size={22} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="btn btn-outline text-body-sm flex items-center gap-2 px-4 py-2"
                    >
                      <Camera size={15} />
                      {uploadingAvatar ? "Subiendo…" : "Cambiar foto"}
                    </button>
                    <p className="text-caption text-[var(--text-tertiary)] mt-1.5">
                      JPEG, PNG o WebP · Máximo 10 MB
                    </p>
                  </div>
                </div>

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
                      title="El correo se gestiona desde tu cuenta de autenticación"
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
              <SeguridadSection profile={profile} onRefresh={() => {
                get<UserProfile>("/users/me").then(setProfile).catch(() => {});
              }} />
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

                <p className="text-caption text-[var(--text-tertiary)] mt-6 mb-4">
                  Próximamente: conecta tu cuenta de MercadoPago para recibir pagos automáticamente
                </p>

                <div className="divider my-6" />

                <h3 className="text-body font-semibold text-[var(--text-primary)] mb-3">
                  Datos de Transferencia Bancaria (CLABE)
                </h3>
                <p className="text-caption text-[var(--text-secondary)] mb-4">
                  Registra tus datos bancarios para que el equipo administrativo de Beel pueda transferirte el dinero de tus reservaciones.
                </p>

                <form onSubmit={handleBankSubmitStep1} className="space-y-4">
                  {bankError && (
                    <div className="p-3 bg-[var(--color-error-subtle)] border border-[var(--color-error)] text-[var(--color-error)] text-body-sm rounded-lg">
                      {bankError}
                    </div>
                  )}
                  {bankSaved && (
                    <div className="p-3 bg-[var(--color-success-subtle)] border border-[var(--color-success)] text-[var(--color-success)] text-body-sm rounded-lg flex items-center gap-1.5">
                      <Check size={14} /> Datos bancarios guardados. Te enviamos un correo de confirmación.
                    </div>
                  )}

                  <div>
                    <label className="block text-caption font-medium text-[var(--text-secondary)] mb-1">
                      Nombre del Titular de la Cuenta
                    </label>
                    <input
                      type="text"
                      value={bankAccountHolder}
                      onChange={(e) => setBankAccountHolder(e.target.value)}
                      placeholder="Ej. Aram Pérez"
                      className="input w-full"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-caption font-medium text-[var(--text-secondary)] mb-1">
                        Banco
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Ej. BBVA, Santander"
                        className="input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-caption font-medium text-[var(--text-secondary)] mb-1">
                        Cuenta CLABE (18 dígitos)
                      </label>
                      <input
                        type="text"
                        value={bankClabe}
                        onChange={(e) => setBankClabe(e.target.value)}
                        maxLength={18}
                        placeholder="012345678901234567"
                        className="input w-full font-mono"
                      />
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-caption text-amber-800">
                      ⚠️ <strong>Eres responsable de ingresar correctamente tu CLABE.</strong> Beel no se hace responsable de transferencias a cuentas incorrectas. Al guardar, aceptas que los datos son correctos y recibirás un correo de confirmación.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={savingBank}
                    className="btn btn-primary"
                  >
                    {savingBank ? "Guardando..." : "Revisar y guardar CLABE"}
                  </button>
                </form>

                {/* Modal de confirmación — Punto 1 */}
                {bankConfirmStep && (
                  <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
                    <div className="bg-[var(--bg-elevated)] rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl">
                      <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Confirma tus datos bancarios</h3>
                      <p className="text-body-sm text-[var(--text-secondary)] mb-4">
                        Verifica que la información sea correcta antes de guardar. <strong>No nos hacemos responsables de errores en la CLABE.</strong>
                      </p>
                      <div className="bg-[var(--bg-subtle)] rounded-xl p-4 space-y-2 mb-5">
                        <div className="flex justify-between text-body-sm">
                          <span className="text-[var(--text-tertiary)]">Titular</span>
                          <span className="font-medium text-[var(--text-primary)]">{bankAccountHolder}</span>
                        </div>
                        <div className="flex justify-between text-body-sm">
                          <span className="text-[var(--text-tertiary)]">Banco</span>
                          <span className="font-medium text-[var(--text-primary)]">{bankName || "No especificado"}</span>
                        </div>
                        <div className="flex justify-between text-body-sm">
                          <span className="text-[var(--text-tertiary)]">CLABE</span>
                          <span className="font-mono font-bold text-[var(--color-primary)] text-base tracking-wider">
                            •••• •••• •••• •••• {bankClabe.trim().slice(-4)}
                          </span>
                        </div>
                      </div>
                      <p className="text-caption text-[var(--text-tertiary)] mb-4">
                        ¿Tu CLABE termina en <strong>{bankClabe.trim().slice(-4)}</strong>? Si es correcto, confirma. Si no, cancela y corrígela.
                      </p>
                      <div className="flex gap-3">
                        <button onClick={() => setBankConfirmStep(false)} className="btn btn-outline flex-1">
                          Cancelar y corregir
                        </button>
                        <button onClick={handleSaveBankDetails} disabled={savingBank} className="btn btn-primary flex-1">
                          {savingBank ? "Guardando..." : "Sí, es correcto. Guardar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
            "inline-block h-5 w-5 rounded-full bg-[var(--bg-elevated)] shadow transform transition-transform duration-200 mt-0.5",
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

// ── Sección de Seguridad: verificación de teléfono e identidad ────────────────

function SeguridadSection({
  profile, onRefresh,
}: {
  profile: UserProfile | null;
  onRefresh: () => void;
}) {
  const { post } = useApi();

  // Teléfono — número completo con código de país (E.164)
  const [phone, setPhone] = useState(profile?.phone ?? "+52 ");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // Identidad
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityError, setIdentityError] = useState("");

  const phoneVerified = profile?.is_phone_verified ?? false;
  const identityVerified = profile?.is_identity_verified ?? false;
  const identityStatus = profile?.identity_status ?? "none";

  async function sendCode() {
    // Normalizar a E.164: dejar solo dígitos y un "+" al inicio
    const digits = phone.replace(/[^\d]/g, "");
    const e164 = phone.trim().startsWith("+") ? `+${digits}` : `+${digits}`;
    if (digits.length < 10) {
      setPhoneError("Ingresa un número válido con código de país (ej. +52 999 123 4567)");
      return;
    }
    setPhoneLoading(true);
    setPhoneError("");
    try {
      await post("/users/me/phone/send", { phone: e164, country_code: "", channel });
      setCodeSent(true);
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Error al enviar el código");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function verifyCode() {
    setPhoneLoading(true);
    setPhoneError("");
    try {
      await post("/users/me/phone/verify", { code });
      setCodeSent(false);
      setCode("");
      onRefresh();
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Código incorrecto");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function startIdentity() {
    setIdentityLoading(true);
    setIdentityError("");
    try {
      const res = await post<{ url: string }>("/users/me/identity/start", {});
      if (res.url) {
        window.location.href = res.url; // Redirigir a la página de Didit
      } else {
        setIdentityError("No se pudo iniciar la verificación.");
        setIdentityLoading(false);
      }
    } catch (e) {
      setIdentityError(e instanceof Error ? e.message : "Error al iniciar verificación");
      setIdentityLoading(false);
    }
  }

  const fromHost =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("motivo") === "anfitrion";

  return (
    <div className="card p-6">
      <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Seguridad</h2>
      <p className="text-body-sm text-[var(--text-secondary)] mb-4">
        Verifica tu teléfono e identidad para reservar y publicar propiedades.
      </p>

      {fromHost && !(phoneVerified && identityVerified) && (
        <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary)] text-[var(--color-primary-dark)] rounded-xl p-3 text-body-sm mb-6">
          Para activar el <strong>modo anfitrión</strong> necesitas completar las dos verificaciones de abajo.
        </div>
      )}

      {/* ── Verificación de teléfono ── */}
      <div className="border border-[var(--border-subtle)] rounded-2xl p-5 mb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-[var(--color-primary)]" />
            <div>
              <p className="text-body font-medium text-[var(--text-primary)]">Número de teléfono</p>
              <p className="text-caption text-[var(--text-secondary)]">Te enviamos un código por SMS o WhatsApp</p>
            </div>
          </div>
          {phoneVerified && (
            <span className="badge badge-verified flex items-center gap-1 flex-shrink-0">
              <BadgeCheck size={12} /> Verificado
            </span>
          )}
        </div>

        {!phoneVerified && (
          <>
            {!codeSent ? (
              <div className="space-y-3">
                <input
                  className="input w-full"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+52 999 000 0000"
                  type="tel"
                />
                <p className="text-caption text-[var(--text-tertiary)]">
                  Incluye el código de país (ej. +52 para México)
                </p>
                {/* Canal */}
                <div className="flex gap-2">
                  {(["sms", "whatsapp"] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setChannel(ch)}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-body-sm font-medium transition-all",
                        channel === ch
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      )}
                    >
                      {ch === "sms" ? <MessageCircle size={15} /> : <MessageCircle size={15} />}
                      {ch === "sms" ? "SMS" : "WhatsApp"}
                    </button>
                  ))}
                </div>
                {phoneError && <p className="text-caption text-red-600">{phoneError}</p>}
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={phoneLoading}
                  className="btn btn-primary w-full flex items-center justify-center gap-2"
                >
                  {phoneLoading ? <Loader2 size={15} className="animate-spin" /> : "Enviar código"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-body-sm text-[var(--text-secondary)]">
                  Ingresa el código que enviamos a {phone}
                </p>
                <input
                  className="input w-full text-center text-h3 tracking-[0.3em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  maxLength={6}
                  inputMode="numeric"
                />
                {phoneError && <p className="text-caption text-red-600">{phoneError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setCodeSent(false); setPhoneError(""); }} className="btn btn-outline flex-1">
                    Cambiar número
                  </button>
                  <button
                    onClick={verifyCode}
                    disabled={phoneLoading || code.length < 4}
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {phoneLoading ? <Loader2 size={15} className="animate-spin" /> : "Verificar"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Verificación de identidad ── */}
      <div className="border border-[var(--border-subtle)] rounded-2xl p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[var(--color-primary)]" />
            <div>
              <p className="text-body font-medium text-[var(--text-primary)]">Verificación de identidad</p>
              <p className="text-caption text-[var(--text-secondary)]">
                Escanea tu identificación oficial (INE o pasaporte) y verifica tu rostro
              </p>
            </div>
          </div>
          {identityVerified && (
            <span className="badge badge-verified flex items-center gap-1 flex-shrink-0">
              <BadgeCheck size={12} /> Verificado
            </span>
          )}
        </div>

        {!identityVerified && (
          <>
            {identityStatus === "pending" && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-3 text-body-sm mb-3">
                Tu verificación está en revisión. Te avisaremos cuando se complete.
              </div>
            )}
            {identityStatus === "declined" && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-3">
                Tu verificación fue rechazada. Puedes intentarlo de nuevo.
              </div>
            )}
            {identityError && <p className="text-caption text-red-600 mb-2">{identityError}</p>}
            <button
              onClick={startIdentity}
              disabled={identityLoading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {identityLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <><ShieldCheck size={15} /> {identityStatus === "declined" ? "Reintentar verificación" : "Verificar mi identidad"}</>
              )}
            </button>
            <p className="text-caption text-[var(--text-tertiary)] mt-3 text-center">
              Se abrirá una verificación segura. Necesitas tu documento y la cámara.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
