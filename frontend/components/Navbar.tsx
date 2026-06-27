"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
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

  // En la home, la barra compacta del navbar aparece SOLO al scrollear
  // (cuando la barra grande del hero ya salió de vista). En otras páginas
  // siempre se muestra.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!isHome) return;
    const onScroll = () => setScrolled(window.scrollY > 280);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);
  const showSearch = !isHome || scrolled;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-200",
        transparent && isHome
          ? "bg-transparent"
          : "bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]"
      )}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">

        {/* Logo (zona izquierda, mismo peso que la derecha) */}
        <div className="flex-1 flex items-center min-w-0">
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
        </div>

        {/* Barra de búsqueda — centrada (oculta en el área de anfitrión) */}
        <div className="hidden md:flex items-center justify-center gap-1 flex-shrink-0">
          {!isHostArea && (
            <Link
              href="/buscar"
              className={cn(
                "group flex items-center rounded-full border border-[var(--border-default)] shadow-sm hover:shadow-md transition-all duration-300 py-1.5 pl-2 pr-1.5",
                showSearch
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 -translate-y-2 pointer-events-none"
              )}
            >
              <span className="px-4 py-1 text-body-sm font-medium text-[var(--text-primary)] rounded-full group-hover:bg-[var(--bg-subtle)] transition-colors">
                Cualquier lugar
              </span>
              <span className="w-px h-5 bg-[var(--border-default)]" />
              <span className="px-4 py-1 text-body-sm font-medium text-[var(--text-primary)] rounded-full group-hover:bg-[var(--bg-subtle)] transition-colors">
                Cualquier fecha
              </span>
              <span className="w-px h-5 bg-[var(--border-default)]" />
              <span className="px-4 py-1 text-body-sm text-[var(--text-secondary)]">
                ¿Cuántos?
              </span>
              <span className="ml-1 w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                <Search size={15} strokeWidth={2.5} />
              </span>
            </Link>
          )}
        </div>

        {/* Auth — solo cliente, sin SSR (zona derecha, mismo peso que izquierda) */}
        <div className="flex-1 flex items-center justify-end gap-2">
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
        <div className="md:hidden border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-4">
          <NavbarAuthMobile onClose={() => setMobileOpen(false)} />
        </div>
      )}
    </header>
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
