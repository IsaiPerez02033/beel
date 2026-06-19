"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, LogOut, Settings, User } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

export default function NavbarAuth() {
  const { isSignedIn, signOut } = useAuth();
  const { get } = useApi();
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    get<{ role: string }>("/users/me")
      .then((d) => setIsAdmin(d.role === "admin"))
      .catch(() => {});
  }, [isSignedIn, get]);

  if (!isSignedIn) {
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
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-body-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <User size={16} />
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-10 z-20 bg-white rounded-xl shadow-lg border border-[var(--border-subtle)] py-1 min-w-[160px]">
              <Link
                href="/anfitrion/configuracion"
                className="flex items-center gap-2 px-4 py-2.5 text-body-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setShowMenu(false)}
              >
                <Settings size={14} />
                Configuración
              </Link>
              <button
                onClick={() => { setShowMenu(false); signOut(); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-body-sm text-red-600 hover:bg-red-50"
              >
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function NavbarAuthMobile({ onClose }: { onClose: () => void }) {
  const { isSignedIn, signOut } = useAuth();
  const { get } = useApi();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    get<{ role: string }>("/users/me").then((d) => setIsAdmin(d.role === "admin")).catch(() => {});
  }, [isSignedIn, get]);

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
      <button
        onClick={() => { onClose(); signOut(); }}
        className="w-full text-left block px-4 py-3 rounded-lg text-body font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        Cerrar sesión
      </button>
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
