"use client";

/**
 * Sección de auth del Navbar — importado con dynamic({ssr:false}).
 * NUNCA se ejecuta en el servidor, por lo que es seguro importar
 * directamente de @clerk/nextjs sin causar errores de SSR.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

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

  if (!HAS_CLERK) {
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
        <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignInButton mode="modal">
        <button className="btn btn-outline text-xs px-4 py-2">Iniciar sesión</button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="btn btn-primary text-xs px-4 py-2">Registrarse</button>
      </SignUpButton>
    </div>
  );
}

export function NavbarAuthMobile({ onClose }: { onClose: () => void }) {
  const { isSignedIn } = useAuth();
  const { get } = useApi();
  const [isAdmin, setIsAdmin] = useState(false);

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
