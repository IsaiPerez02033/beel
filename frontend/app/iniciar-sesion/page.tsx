"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import Navbar from "@/components/Navbar";
import { Home } from "lucide-react";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

let ClerkComponents: any = null;
if (HAS_CLERK) {
  ClerkComponents = require("@clerk/nextjs");
}

export default function IniciarSesionPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") ?? "/";

  // Si ya está autenticado, redirigir
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace(redirectUrl);
    }
  }, [isLoaded, isSignedIn, redirectUrl, router]);

  return (
    <div className="min-h-screen bg-[var(--color-arena)]">
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-16">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center justify-center">
            <span
              className="font-display font-semibold text-[32px] text-[var(--color-primary)]"
              style={{ letterSpacing: "-1px" }}
            >
              beel
            </span>
          </Link>
          <p className="text-body text-[var(--text-secondary)] mt-2">
            Inicia sesión en tu cuenta
          </p>
        </div>

        <div className="card p-6">
          {HAS_CLERK && ClerkComponents ? (
            <ClerkComponents.SignIn
              routing="hash"
              afterSignInUrl={redirectUrl}
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none p-0 bg-transparent",
                  headerTitle: "text-h2 font-display font-semibold text-[var(--text-primary)]",
                  headerSubtitle: "text-body-sm text-[var(--text-secondary)]",
                  formButtonPrimary:
                    "btn btn-primary w-full text-body-sm !shadow-none",
                  formFieldInput: "input w-full",
                  footerActionLink:
                    "text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium",
                  dividerLine: "bg-[var(--border-subtle)]",
                  dividerText: "text-[var(--text-tertiary)] text-caption",
                  socialButtonsBlockButton:
                    "border border-[var(--border-default)] rounded-xl px-4 py-2.5 text-body-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors w-full flex items-center justify-center gap-2 mb-2",
                  identityPreviewEditButton:
                    "text-[var(--color-primary)] text-body-sm",
                  formResendCodeLink: "text-[var(--color-primary)] text-body-sm",
                  alertText: "text-body-sm",
                  formFieldErrorText: "text-red-600 text-caption",
                },
              }}
            />
          ) : (
            <DemoLogin redirectUrl={redirectUrl} />
          )}
        </div>

        <p className="text-center text-body-sm text-[var(--text-secondary)] mt-6">
          ¿No tienes cuenta?{" "}
          <Link
            href={`/registro${redirectUrl !== "/" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium"
          >
            Regístrate gratis
          </Link>
        </p>
      </main>
    </div>
  );
}

/** Fallback cuando Clerk no está configurado (modo demo) */
function DemoLogin({ redirectUrl }: { redirectUrl: string }) {
  const router = useRouter();
  return (
    <div className="text-center py-4 space-y-4">
      <div className="w-12 h-12 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto">
        <Home size={22} className="text-[var(--color-primary)]" />
      </div>
      <p className="text-body text-[var(--text-secondary)]">
        La autenticación no está configurada en este entorno.
      </p>
      <button
        onClick={() => router.push(redirectUrl)}
        className="btn btn-primary w-full"
      >
        Continuar en modo demo
      </button>
      <Link href="/" className="block text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        Volver al inicio
      </Link>
    </div>
  );
}
