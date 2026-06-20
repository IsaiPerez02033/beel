"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const HAS_GOOGLE = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function RegistroPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") ?? "/";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Las contraseñas no coinciden"); return; }
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres"); return; }

    setLoading(true);
    setError("");

    let res: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
      res = await fetch(`${API}/api/v1/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch (e: any) {
      const msg = e?.name === "AbortError"
        ? "El servidor tardó demasiado. Si es la primera vez que lo usas, espera 30 segundos y reintenta."
        : "No se pudo conectar con el servidor. Verifica tu conexión.";
      setError(msg);
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.detail ?? "Error al crear la cuenta");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Cuenta creada pero no se pudo iniciar sesión. Intenta hacerlo manualmente.");
    } else {
      router.push(redirectUrl);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signIn("google", { callbackUrl: redirectUrl });
    } catch {
      setError("No se pudo conectar con Google. Intenta de nuevo.");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-arena)] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <Image src="/beel_logo_green_sand.png" alt="Beel" width={160} height={62} className="h-14 w-auto mx-auto" priority />
          </Link>
          <p className="text-body text-[var(--text-secondary)] mt-2">Crea tu cuenta gratuita</p>
        </div>

        <div className="card p-6">
          {HAS_GOOGLE && (
            <>
              <button
                onClick={handleGoogle}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 border border-[var(--border-default)] rounded-xl px-4 py-3 text-body-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors mb-4 disabled:opacity-60"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                {googleLoading ? "Redirigiendo…" : "Registrarse con Google"}
              </button>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                <span className="text-caption text-[var(--text-tertiary)]">o</span>
                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Nombre completo</label>
              <input type="text" className="input w-full" placeholder="Tu nombre" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
            </div>
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Correo electrónico</label>
              <input type="email" className="input w-full" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Contraseña</label>
              <input type="password" className="input w-full" placeholder="Mínimo 8 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Confirmar contraseña</label>
              <input type="password" className="input w-full" placeholder="Repite tu contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creando cuenta…</> : "Crear cuenta"}
            </button>
          </form>
        </div>

        <p className="text-center text-body-sm text-[var(--text-secondary)] mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link href={`/iniciar-sesion${redirectUrl !== "/" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`} className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

