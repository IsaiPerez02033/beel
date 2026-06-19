"use client";

/**
 * Sección de autenticación del Navbar.
 * Se importa con dynamic({ ssr: false }) — NUNCA se renderiza en el servidor.
 * Esto evita todos los errores de Clerk durante SSR/hidratación.
 */

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import { useState, useEffect } from "react";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Importar componentes de Clerk solo en cliente
let ClerkUI: {
  SignInButton: any;
  SignUpButton: any;
  UserButton: any;
} | null = null;

if (HAS_CLERK && typeof window !== "undefined") {
  const clerk = require("@clerk/nextjs");
  ClerkUI = {
    SignInButton: clerk.SignInButton,
    SignUpButton: clerk.SignUpButton,
    UserButton: clerk.UserButton,
  };
}

export default function NavbarAuth() {
  const { isSignedIn } = useAuth();
  const { get } = useApi();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !HAS_CLERK) return;
    get<{ role: string }>("/users/me")
      .then((d) => setIsAdmin(d.role === "admin"))
      .catch(() => {});
  }, [isSignedIn]);

  if (!HAS_CLERK || !ClerkUI) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/iniciar-sesion" className="btn btn-outline text-xs px-4 py-2">
          Iniciar sesión
        </Link>
        <Link href="/registro" className="btn btn-primary text-xs px-4 py-2">
          Registrarse
        </Link>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2">
        {isAdmin && (
          <Link
            href="/admin"
            className="hidden sm:flex items-center gap-1 btn btn-ghost text-xs px-3 py-2 text-[var(--color-primary)]"
          >
            <ShieldCheck size={14} />
            Admin
          </Link>
        )}
        <Link href="/mensajes" className="hidden sm:flex items-center gap-1.5 btn btn-ghost text-xs px-3 py-2">
          Mensajes
        </Link>
        <Link href="/reservaciones" className="hidden sm:flex items-center gap-1.5 btn btn-ghost text-xs px-3 py-2">
          Viajes
        </Link>
        <ClerkUI.UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ClerkUI.SignInButton mode="modal">
        <button className="btn btn-outline text-xs px-4 py-2">Iniciar sesión</button>
      </ClerkUI.SignInButton>
      <ClerkUI.SignUpButton mode="modal">
        <button className="btn btn-primary text-xs px-4 py-2">Registrarse</button>
      </ClerkUI.SignUpButton>
    </div>
  );
}

// Versión móvil
export function NavbarAuthMobile({ onClose }: { onClose: () => void }) {
  const { isSignedIn } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const { get } = useApi();

  useEffect(() => {
    if (!isSignedIn || !HAS_CLERK) return;
    get<{ role: string }>("/users/me")
      .then((d) => setIsAdmin(d.role === "admin"))
      .catch(() => {});
  }, [isSignedIn]);

  if (!isSignedIn) {
    return (
      <>
        <MobileLink href="/iniciar-sesion" onClick={onClose}>Iniciar sesión</MobileLink>
        <MobileLink href="/registro" onClick={onClose}>Registrarse</MobileLink>
      </>
    );
  }

  return (
    <>
      <MobileLink href="/mensajes" onClick={onClose}>Mensajes</MobileLink>
      <MobileLink href="/reservaciones" onClick={onClose}>Viajes</MobileLink>
      {isAdmin && <MobileLink href="/admin" onClick={onClose}>Panel Admin</MobileLink>}
    </>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="block px-4 py-3 rounded-lg text-body font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors">
      {children}
    </Link>
  );
}
