"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

/**
 * Candado de Términos y Condiciones.
 * Si el usuario está autenticado pero no ha aceptado los términos (típicamente
 * quien entró por Google, que no pasa por el checkbox del registro), muestra un
 * modal bloqueante hasta que acepte. Los usuarios previos quedaron "grandfathered"
 * en la migración, así que no lo ven.
 */
export default function TermsGate() {
  const { isSignedIn, isLoaded } = useAuth();
  const { get, post } = useApi();
  const [needsAccept, setNeedsAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) { setNeedsAccept(false); return; }
    let active = true;
    get<{ terms_accepted_at: string | null }>("/users/me")
      .then((me) => { if (active) setNeedsAccept(!me.terms_accepted_at); })
      .catch(() => {});
    return () => { active = false; };
  }, [isLoaded, isSignedIn, get]);

  if (!needsAccept) return null;

  async function accept() {
    setSubmitting(true);
    try {
      await post("/users/me/accept-terms", {});
      setNeedsAccept(false);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="card p-6 w-full max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-3">
          <ShieldCheck size={24} className="text-[var(--color-primary)]" />
        </div>
        <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-2">Un último paso</h2>
        <p className="text-body-sm text-[var(--text-secondary)] mb-5">
          Para usar Beel necesitas aceptar nuestros{" "}
          <Link href="/terminos" target="_blank" className="text-[var(--color-primary)] underline hover:no-underline">Términos y Condiciones</Link>{" "}
          y el{" "}
          <Link href="/privacidad" target="_blank" className="text-[var(--color-primary)] underline hover:no-underline">Aviso de Privacidad</Link>.
        </p>
        <button
          onClick={accept}
          disabled={submitting}
          className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : "Aceptar y continuar"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mt-3 text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
