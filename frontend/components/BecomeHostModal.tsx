"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import {
  X, Phone, ShieldCheck, BadgeCheck, Loader2, ArrowRight,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal "Conviértete en anfitrión" — minimalista.
 * Muestra los 2 pasos de verificación (teléfono + identidad).
 * Teléfono se verifica inline (OTP); identidad redirige a Didit.
 * Cuando ambos están listos → botón para entrar al panel.
 */
export default function BecomeHostModal({ open, onClose }: Props) {
  const { post, get } = useApi();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(false);

  // Teléfono
  const [phone, setPhone] = useState("+52 ");
  const channel: "sms" | "whatsapp" = "sms"; // WhatsApp deshabilitado por ahora (requiere sender propio en Meta)
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // Identidad
  const [idBusy, setIdBusy] = useState(false);
  const [idError, setIdError] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    get<{ is_phone_verified: boolean; is_identity_verified: boolean }>("/users/me")
      .then((u) => {
        setPhoneVerified(!!u.is_phone_verified);
        setIdentityVerified(!!u.is_identity_verified);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, get]);

  if (!open) return null;

  const bothDone = phoneVerified && identityVerified;

  async function sendCode() {
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length < 10) {
      setPhoneError("Ingresa un número válido con código de país");
      return;
    }
    setPhoneBusy(true);
    setPhoneError("");
    try {
      await post("/users/me/phone/send", { phone: `+${digits}`, country_code: "", channel });
      setCodeSent(true);
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Error al enviar el código");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function verifyCode() {
    setPhoneBusy(true);
    setPhoneError("");
    try {
      await post("/users/me/phone/verify", { code });
      setPhoneVerified(true);
      setCodeSent(false);
      setCode("");
    } catch (e) {
      setPhoneError(e instanceof Error ? e.message : "Código incorrecto");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function startIdentity() {
    setIdBusy(true);
    setIdError("");
    try {
      const res = await post<{ url: string }>("/users/me/identity/start", {});
      if (res.url) {
        window.location.href = res.url;
      } else {
        setIdError("No se pudo iniciar la verificación.");
        setIdBusy(false);
      }
    } catch (e) {
      setIdError(e instanceof Error ? e.message : "Error al iniciar verificación");
      setIdBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative p-6 pb-4 text-center border-b border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X size={18} />
          </button>
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={24} className="text-[var(--color-primary)]" />
          </div>
          <h2 className="text-h2 font-display font-medium text-[var(--text-primary)]">
            Conviértete en anfitrión
          </h2>
          <p className="text-body-sm text-[var(--text-secondary)] mt-1">
            Completa estos 2 pasos para publicar tu propiedad
          </p>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            <div className="skeleton h-16 w-full rounded-xl" />
            <div className="skeleton h-16 w-full rounded-xl" />
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* ── Paso 1: Teléfono ── */}
            <div className={cn(
              "rounded-xl border p-4 transition-colors",
              phoneVerified ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--border-subtle)]"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                  phoneVerified ? "bg-[var(--color-primary)] text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                )}>
                  {phoneVerified ? <BadgeCheck size={18} /> : <Phone size={16} />}
                </div>
                <div className="flex-1">
                  <p className="text-body-sm font-medium text-[var(--text-primary)]">1. Verifica tu teléfono</p>
                  <p className="text-caption text-[var(--text-secondary)]">
                    {phoneVerified ? "Teléfono verificado ✓" : "Código por SMS"}
                  </p>
                </div>
              </div>

              {!phoneVerified && (
                <div className="mt-3">
                  {!codeSent ? (
                    <div className="space-y-2">
                      <input
                        className="input w-full"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+52 999 000 0000"
                        type="tel"
                      />
                      {/* Canal WhatsApp oculto temporalmente: requiere un WhatsApp Sender propio
                          registrado con Meta. Por ahora solo SMS (channel default = "sms"). */}
                      {phoneError && <p className="text-caption text-red-600">{phoneError}</p>}
                      <button
                        type="button"
                        onClick={sendCode}
                        disabled={phoneBusy}
                        className="btn btn-primary w-full text-body-sm py-2 flex items-center justify-center gap-2"
                      >
                        {phoneBusy ? <Loader2 size={14} className="animate-spin" /> : "Enviar código"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
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
                        <button type="button" onClick={() => { setCodeSent(false); setPhoneError(""); }} className="btn btn-outline flex-1 text-body-sm py-2">
                          Atrás
                        </button>
                        <button type="button" onClick={verifyCode} disabled={phoneBusy || code.length < 4} className="btn btn-primary flex-1 text-body-sm py-2 flex items-center justify-center gap-2">
                          {phoneBusy ? <Loader2 size={14} className="animate-spin" /> : "Verificar"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Paso 2: Identidad ── */}
            <div className={cn(
              "rounded-xl border p-4 transition-colors",
              identityVerified ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]" : "border-[var(--border-subtle)]"
            )}>
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                  identityVerified ? "bg-[var(--color-primary)] text-white" : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                )}>
                  {identityVerified ? <BadgeCheck size={18} /> : <ShieldCheck size={16} />}
                </div>
                <div className="flex-1">
                  <p className="text-body-sm font-medium text-[var(--text-primary)]">2. Verifica tu identidad</p>
                  <p className="text-caption text-[var(--text-secondary)]">
                    {identityVerified ? "Identidad verificada ✓" : "Documento oficial + verificación facial"}
                  </p>
                </div>
              </div>

              {!identityVerified && (
                <div className="mt-3">
                  {idError && <p className="text-caption text-red-600 mb-2">{idError}</p>}
                  <button
                    type="button"
                    onClick={startIdentity}
                    disabled={idBusy}
                    className="btn btn-primary w-full text-body-sm py-2 flex items-center justify-center gap-2"
                  >
                    {idBusy ? <Loader2 size={14} className="animate-spin" /> : <><ShieldCheck size={14} /> Verificar identidad</>}
                  </button>
                </div>
              )}
            </div>

            {/* CTA final */}
            <button
              type="button"
              onClick={() => { onClose(); router.push("/anfitrion"); }}
              disabled={!bothDone}
              className={cn(
                "btn w-full flex items-center justify-center gap-2 mt-2",
                bothDone ? "btn-primary" : "btn-outline opacity-50 cursor-not-allowed"
              )}
            >
              {bothDone ? <>Ir a mi panel <ArrowRight size={16} /></> : "Completa los 2 pasos"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
