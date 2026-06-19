"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import Navbar from "@/components/Navbar";
import { Home } from "lucide-react";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

let ClerkComponents: any = null;
if (HAS_CLERK) {
  ClerkComponents = require("@clerk/nextjs");
}

export default function RegistroPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") ?? "/";

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
            <Image
              src="/beel_logo_green_sand.png"
              alt="Beel"
              width={160}
              height={62}
              className="h-14 w-auto"
              priority
            />
          </Link>
          <p className="text-body text-[var(--text-secondary)] mt-2">
            Crea tu cuenta gratuita
          </p>
        </div>

        <div className="card p-6">
          {HAS_CLERK && ClerkComponents ? (
            <ClerkComponents.SignUp
              routing="hash"
              afterSignUpUrl={redirectUrl}
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
                  formFieldErrorText: "text-red-600 text-caption",
                  alertText: "text-body-sm",
                },
              }}
            />
          ) : (
            <DemoRegister redirectUrl={redirectUrl} />
          )}
        </div>

        <p className="text-center text-body-sm text-[var(--text-secondary)] mt-6">
          ¿Ya tienes cuenta?{" "}
          <Link
            href={`/iniciar-sesion${redirectUrl !== "/" ? `?redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium"
          >
            Inicia sesión
          </Link>
        </p>
      </main>
    </div>
  );
}

function DemoRegister({ redirectUrl }: { redirectUrl: string }) {
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
