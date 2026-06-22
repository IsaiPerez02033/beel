"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useSafeAuth";

/**
 * Botones de CTA de la landing de anfitrión, adaptados al estado de sesión:
 * - No logueado → Registrarse / Iniciar sesión
 * - Logueado → Publicar propiedad (al wizard) / Ir a mi panel
 */
export default function HostCTAs({ variant = "hero" }: { variant?: "hero" | "single" }) {
  const { isSignedIn, isLoaded } = useAuth();

  // Mientras carga, mostrar el estado neutro (no logueado) para evitar flash
  const signedIn = isLoaded && isSignedIn;

  if (variant === "single") {
    return (
      <Link
        href={signedIn ? "/p/nueva" : "/registro?redirect_url=/p/nueva"}
        className="btn btn-primary text-body px-8 py-3"
      >
        {signedIn ? "Publicar mi propiedad" : "Empezar gratis"}
      </Link>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <Link
        href={signedIn ? "/p/nueva" : "/registro?redirect_url=/p/nueva"}
        className="btn btn-primary text-body px-8 py-3"
      >
        Publicar mi propiedad
      </Link>
      <Link
        href={signedIn ? "/anfitrion" : "/iniciar-sesion?redirect_url=/p/nueva"}
        className="btn btn-outline text-body px-8 py-3"
      >
        {signedIn ? "Ir a mi panel" : "Ya tengo cuenta"}
      </Link>
    </div>
  );
}
