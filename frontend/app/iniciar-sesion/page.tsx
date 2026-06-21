"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signInWithGoogle } from "@/app/actions/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

const HAS_GOOGLE = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
// Proxy interno para evitar CORS
const API = typeof window !== "undefined" ? "/api/backend" : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000") + "/api/v1";

export default function IniciarSesionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") ?? "/";
  const motivo = searchParams.get("motivo");
  const emailParam = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice] = useState(
    motivo === "existe"
      ? "Esta cuenta ya existe. Inicia sesión con tu contraseña."
      : ""
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", { email, password, redirect: false });

    if (!result?.error) {
      setLoading(false);
      router.push(redirectUrl);
      return;
    }

    // Login falló — averiguar si la cuenta existe para redirigir correctamente
    try {
      const res = await fetch(`${API}/users/check-email?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!data.exists) {
        // No existe → redirigir a registro con aviso
        const params = new URLSearchParams();
        params.set("email", email);
        params.set("motivo", "nuevo");
        if (redirectUrl !== "/") params.set("redirect_url", redirectUrl);
        router.push(`/registro?${params.toString()}`);
        return;
      }
      if (data.provider === "google") {
        setError("Esta cuenta usa Google. Usa el botón 'Continuar con Google'.");
      } else {
        setError("Contraseña incorrecta. Intenta de nuevo.");
      }
    } catch {
      setError("Correo o contraseña incorrectos");
    }
    setLoading(false);
  }

  function handleGoogle() {
    setGoogleLoading(true);
    const callback = encodeURIComponent(redirectUrl);
    window.location.href = `/api/auth/signin/google?callbackUrl=${callback}`;
  }

  return (
    <div className="min-h-screen bg-[var(--color-arena)] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <span className="font-display font-semibold text-[40px] text-[var(--color-primary)]" style={{ letterSpacing: "-1.5px" }}>beel</span>
          </Link>
          <p className="text-body text-[var(--text-secondary)] mt-2">Inicia sesión en tu cuenta</p>
        </div>

        <div className="card p-6">
          {HAS_GOOGLE && (
            <>
              <form action={signInWithGoogle.bind(null, redirectUrl)}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-3 border border-[var(--border-default)] rounded-xl px-4 py-3 text-body-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors mb-4"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  Continuar con Google
                </button>
              </form>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                <span className="text-caption text-[var(--text-tertiary)]">o</span>
                <div className="flex-1 h-px bg-[var(--border-subtle)]" />
              </div>
            </>
          )}

          {notice && (
            <div className="bg-[var(--color-primary-light)] border border-[var(--color-primary)] text-[var(--color-primary-dark)] rounded-xl p-3 text-body-sm mb-4">
              {notice}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Correo electrónico</label>
              <input type="email" className="input w-full" placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">Contraseña</label>
              <input type="password" className="input w-full" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Entrando…</> : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p className="text-center text-body-sm text-[var(--text-secondary)] mt-6">
          ¿No tienes cuenta?{" "}
          <Link href={`/registro${redirectUrl !== "/" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`} className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium">
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  );
}
