"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useSafeAuth";
import dynamic from "next/dynamic";

// NavbarAuth y NavbarAuthMobile se cargan SOLO en el cliente (ssr: false).
// Esto elimina cualquier error de auth durante SSR o hidratación.
const NavbarAuth = dynamic(() => import("./NavbarAuth"), { ssr: false });
const NavbarAuthMobile = dynamic(
  () => import("./NavbarAuth").then((m) => ({ default: m.NavbarAuthMobile })),
  { ssr: false }
);

interface NavbarProps {
  transparent?: boolean;
}

export default function Navbar({ transparent = false }: NavbarProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  // Área de anfitrión: el navbar cambia a modo anfitrión
  const isHostArea = pathname.startsWith("/anfitrion") || pathname.startsWith("/p/nueva") || pathname.includes("/editar");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSignedIn } = useAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-200",
        transparent && isHome
          ? "bg-transparent"
          : "bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]"
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/" className="flex-shrink-0 flex items-center">
          <Image
            src="/beel_logo_black_white.png"
            alt="Beel"
            width={110}
            height={42}
            className="h-10 w-auto"
            priority
          />
        </Link>

        {/* Links centro — cambian según el modo */}
        <div className="hidden md:flex items-center gap-1">
          {isHostArea ? (
            <>
              <NavLink href="/anfitrion">Panel</NavLink>
              <NavLink href="/anfitrion/configuracion">Configuración</NavLink>
            </>
          ) : (
            <NavLink href="/buscar">Explorar</NavLink>
          )}
        </div>

        {/* Auth — solo cliente, sin SSR */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <NavbarAuth />
          </div>
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
          {isHostArea ? (
            <>
              <MobileLink href="/anfitrion" onClick={() => setMobileOpen(false)}>Panel</MobileLink>
              <MobileLink href="/anfitrion/configuracion" onClick={() => setMobileOpen(false)}>Configuración</MobileLink>
            </>
          ) : (
            <MobileLink href="/buscar" onClick={() => setMobileOpen(false)}>Explorar</MobileLink>
          )}
          <NavbarAuthMobile onClose={() => setMobileOpen(false)} />
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
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
