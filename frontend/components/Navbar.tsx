"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

interface NavbarProps {
  transparent?: boolean;
}

export default function Navbar({ transparent = false }: NavbarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // mounted evita renderizar componentes de Clerk durante SSR
  const [mounted, setMounted] = useState(false);

  // Todos los hooks incondicionalmente al inicio
  const { isSignedIn } = useAuth();
  const { get } = useApi();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isSignedIn || !HAS_CLERK) return;
    get<{ role: string }>("/users/me")
      .then((d) => setIsAdmin(d.role === "admin"))
      .catch(() => {});
  }, [isSignedIn]);

  return (
    <header className={cn(
      "sticky top-0 z-50 w-full transition-colors duration-200",
      transparent && isHome ? "bg-transparent" : "bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]"
    )}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex-shrink-0 flex items-center">
          <Image src="/beel_logo_black_white.png" alt="Beel" width={72} height={28} className="h-7 w-auto" priority />
        </Link>

        {/* Links centro */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/buscar">Explorar</NavLink>
          <NavLink href={isSignedIn ? "/anfitrion" : "/ser-anfitrion"}>Ser anfitrión</NavLink>
        </div>

        {/* Auth — solo renderiza Clerk tras el montaje en cliente */}
        <div className="flex items-center gap-2">
          {mounted ? (
            isSignedIn ? (
              <AuthSignedIn isAdmin={isAdmin} />
            ) : (
              <AuthSignedOut />
            )
          ) : (
            // Placeholder durante SSR — evita flash y errores de Clerk
            <div className="flex items-center gap-2">
              <div className="w-24 h-8 rounded-xl bg-[var(--bg-subtle)]" />
              <div className="w-24 h-8 rounded-xl bg-[var(--bg-subtle)]" />
            </div>
          )}

          {/* Botón menú móvil */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            aria-label="Menú"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Menú móvil */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 space-y-2">
          <MobileLink href="/buscar" onClick={() => setMobileOpen(false)}>Explorar</MobileLink>
          <MobileLink href={isSignedIn ? "/anfitrion" : "/ser-anfitrion"} onClick={() => setMobileOpen(false)}>
            Ser anfitrión
          </MobileLink>
          {mounted && isSignedIn && (
            <>
              <MobileLink href="/mensajes" onClick={() => setMobileOpen(false)}>Mensajes</MobileLink>
              <MobileLink href="/reservaciones" onClick={() => setMobileOpen(false)}>Viajes</MobileLink>
              {isAdmin && (
                <MobileLink href="/admin" onClick={() => setMobileOpen(false)}>Panel Admin</MobileLink>
              )}
            </>
          )}
          {mounted && !isSignedIn && (
            <>
              <MobileLink href="/iniciar-sesion" onClick={() => setMobileOpen(false)}>Iniciar sesión</MobileLink>
              <MobileLink href="/registro" onClick={() => setMobileOpen(false)}>Registrarse</MobileLink>
            </>
          )}
        </div>
      )}
    </header>
  );
}

// Componente solo-cliente para usuario autenticado
function AuthSignedIn({ isAdmin }: { isAdmin: boolean }) {
  if (!HAS_CLERK) {
    return (
      <Link href="/iniciar-sesion" className="btn btn-outline text-xs px-4 py-2">
        Iniciar sesión
      </Link>
    );
  }
  const { UserButton } = require("@clerk/nextjs");
  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Link href="/admin" className="hidden sm:flex items-center gap-1 btn btn-ghost text-xs px-3 py-2 text-[var(--color-primary)]">
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

// Componente solo-cliente para usuario no autenticado
function AuthSignedOut() {
  if (!HAS_CLERK) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/iniciar-sesion" className="btn btn-outline text-xs px-4 py-2">Iniciar sesión</Link>
        <Link href="/registro" className="btn btn-primary text-xs px-4 py-2">Registrarse</Link>
      </div>
    );
  }
  const { SignInButton, SignUpButton } = require("@clerk/nextjs");
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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-4 py-2 rounded-full text-body text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors font-medium">
      {children}
    </Link>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="block px-4 py-3 rounded-lg text-body font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors">
      {children}
    </Link>
  );
}
