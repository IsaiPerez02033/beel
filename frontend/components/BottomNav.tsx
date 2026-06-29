"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Briefcase, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

// Rutas donde NO se muestra la barra (flujos con CTA/input al fondo)
const HIDDEN_PREFIXES = [
  "/iniciar-sesion",
  "/registro",
  "/p/nueva",
];
const HIDDEN_MATCHES = (p: string) =>
  p.includes("/editar") || p.includes("/reservar");

interface Tab {
  href: string;
  label: string;
  icon: typeof Search;
  match: (p: string) => boolean;
  authOnly?: boolean;
}

const TABS: Tab[] = [
  { href: "/", label: "Explorar", icon: Search, match: (p) => p === "/" || p.startsWith("/buscar") },
  { href: "/reservaciones", label: "Viajes", icon: Briefcase, match: (p) => p.startsWith("/reservaciones"), authOnly: true },
  { href: "/mensajes", label: "Mensajes", icon: MessageSquare, match: (p) => p.startsWith("/mensajes"), authOnly: true },
  { href: "/anfitrion/configuracion?seccion=perfil", label: "Perfil", icon: User, match: (p) => p.startsWith("/anfitrion/configuracion"), authOnly: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const { get } = useApi();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!isSignedIn) { setUnread(0); return; }
    get<{ unread_count: number }>("/notifications?limit=1")
      .then((r) => setUnread(r.unread_count ?? 0))
      .catch(() => {});
  }, [isSignedIn, get, pathname]);

  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) || HIDDEN_MATCHES(pathname);

  useEffect(() => {
    document.body.classList.toggle("has-bottom-nav", !hidden);
    return () => document.body.classList.remove("has-bottom-nav");
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] safe-area-bottom">
      <div className="flex items-stretch justify-around pt-1.5">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const href = tab.authOnly && !isSignedIn ? `/iniciar-sesion?callbackUrl=${encodeURIComponent(tab.href)}` : tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 flex-1 py-1 transition-colors",
                active ? "text-[var(--color-primary)]" : "text-[var(--text-tertiary)]"
              )}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                {tab.label === "Mensajes" && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[var(--color-accent)] text-[#2C2C2A] text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
