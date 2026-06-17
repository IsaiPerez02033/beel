"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton, SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavbarProps {
  /** Fondo transparente sobre hero image (solo en home) */
  transparent?: boolean;
}

export default function Navbar({ transparent = false }: NavbarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSignedIn } = useAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-[var(--z-dropdown)] w-full transition-colors duration-200",
        transparent && isHome
          ? "bg-transparent"
          : "bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]"
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0 flex items-center gap-2">
          <span
            className="font-display font-semibold text-[20px] text-[var(--color-primary)]"
            style={{ letterSpacing: "-0.5px" }}
          >
            beel
          </span>
        </Link>

        {/* Links centro (desktop) */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/buscar">Explorar</NavLink>
          <NavLink href={isSignedIn ? "/anfitrion" : "/iniciar-sesion"}>Ser anfitrión</NavLink>
        </div>

        {/* Acciones derecha */}
        <div className="flex items-center gap-2">
          <SignedIn>
            <Link
              href="/mensajes"
              className="hidden sm:flex items-center gap-1.5 btn btn-ghost text-xs px-3 py-2"
            >
              Mensajes
            </Link>
            <Link
              href="/reservaciones"
              className="hidden sm:flex items-center gap-1.5 btn btn-ghost text-xs px-3 py-2"
            >
              Viajes
            </Link>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          </SignedIn>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn btn-outline text-xs px-4 py-2">
                Iniciar sesión
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="btn btn-primary text-xs px-4 py-2">
                Registrarse
              </button>
            </SignUpButton>
          </SignedOut>

          {/* Menú móvil */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            aria-label="Menú"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 space-y-2">
          <MobileLink href="/buscar" onClick={() => setMobileOpen(false)}>Explorar</MobileLink>
          <MobileLink href={isSignedIn ? "/anfitrion" : "/iniciar-sesion"} onClick={() => setMobileOpen(false)}>Ser anfitrión</MobileLink>
          <SignedIn>
            <MobileLink href="/mensajes" onClick={() => setMobileOpen(false)}>Mensajes</MobileLink>
            <MobileLink href="/reservaciones" onClick={() => setMobileOpen(false)}>Viajes</MobileLink>
          </SignedIn>
        </div>
      )}
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="px-4 py-2 rounded-full text-body text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors font-medium"
    >
      {children}
    </Link>
  );
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-3 rounded-lg text-body font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
    >
      {children}
    </Link>
  );
}
