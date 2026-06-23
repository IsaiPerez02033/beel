"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import BecomeHostModal from "@/components/BecomeHostModal";

/**
 * CTAs de la landing de anfitrión, adaptados a sesión + verificación:
 * - No logueado → Registrarse / Iniciar sesión
 * - Logueado verificado → Publicar propiedad / Ir a mi panel
 * - Logueado SIN verificar → abre el modal de verificación
 */
export default function HostCTAs({ variant = "hero" }: { variant?: "hero" | "single" }) {
  const { isSignedIn, isLoaded } = useAuth();
  const { get } = useApi();
  const router = useRouter();
  const [verified, setVerified] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const signedIn = isLoaded && isSignedIn;

  useEffect(() => {
    if (!signedIn) return;
    get<{ is_phone_verified: boolean; is_identity_verified: boolean }>("/users/me")
      .then((u) => setVerified(!!u.is_phone_verified && !!u.is_identity_verified))
      .catch(() => {});
  }, [signedIn, get]);

  // Acción principal "Publicar propiedad"
  function handlePublish() {
    if (!signedIn) {
      router.push("/registro?redirect_url=/p/nueva");
    } else if (verified) {
      router.push("/p/nueva");
    } else {
      setShowModal(true);
    }
  }

  // Acción secundaria "Ir a mi panel"
  function handlePanel() {
    if (!signedIn) {
      router.push("/iniciar-sesion?redirect_url=/p/nueva");
    } else if (verified) {
      router.push("/anfitrion");
    } else {
      setShowModal(true);
    }
  }

  return (
    <>
      <BecomeHostModal open={showModal} onClose={() => setShowModal(false)} />

      {variant === "single" ? (
        <button onClick={handlePublish} className="btn btn-primary text-body px-8 py-3">
          {signedIn ? "Publicar mi propiedad" : "Empezar gratis"}
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={handlePublish} className="btn btn-primary text-body px-8 py-3">
            Publicar mi propiedad
          </button>
          <button onClick={handlePanel} className="btn btn-outline text-body px-8 py-3">
            {signedIn ? "Ir a mi panel" : "Ya tengo cuenta"}
          </button>
        </div>
      )}
    </>
  );
}
