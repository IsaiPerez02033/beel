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
// Esto elimina cualquier error de Clerk durante SSR o hidratación.
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
            width={72}
            height={28}
            className="h-7 w-auto"
            priority
          />
        </Link>

        {/* Links centro */}
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/buscar">Explorar</NavLink>
          <NavLink href={isSignedIn ? "/anfitrion" : "/ser-anfitrion"}>
            Ser anfitrión
          </NavLink>
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
          <MobileLink href="/buscar" onClick={() => setMobileOpen(false)}>
            Explorar
          </MobileLink>
          <MobileLink
            href={isSignedIn ? "/anfitrion" : "/ser-anfitrion"}
            onClick={() => setMobileOpen(false)}
          >
            Ser anfitrión
          </MobileLink>
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
