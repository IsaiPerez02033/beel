"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, Briefcase, MessageSquare, User, ShieldCheck, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

// Rutas donde NO se muestra la barra (flujos con CTA/input al fondo)
const HIDDEN_PREFIXES = [
  "/iniciar-sesion",
  "/registro",
  "/p/nueva",
  "/mensajes", // pantalla completa con su propio input al fondo
  "/concierge", // pantalla completa con su propio input al fondo
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
  { href: "/favoritos", label: "Favoritos", icon: Heart, match: (p) => p.startsWith("/favoritos"), authOnly: true },
  { href: "/reservaciones", label: "Viajes", icon: Briefcase, match: (p) => p.startsWith("/reservaciones"), authOnly: true },
  { href: "/mensajes", label: "Mensajes", icon: MessageSquare, match: (p) => p.startsWith("/mensajes"), authOnly: true },
  { href: "/cuenta", label: "Perfil", icon: User, match: (p) => p.startsWith("/cuenta"), authOnly: true },
];

const ADMIN_TAB: Tab = {
  href: "/admin", label: "Admin", icon: ShieldCheck, match: (p) => p.startsWith("/admin"), authOnly: true,
};

export default function BottomNav() {
  const pathname = usePathname();
  const { isSignedIn } = useAuth();
  const { get } = useApi();
  const [unread, setUnread] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isSignedIn) { setUnread(0); setIsAdmin(false); return; }
    // Solo notificaciones de mensajes: los avisos/reservas no deben inflar el
    // badge del tab Mensajes (en móvil no hay campana donde marcarlos leídos).
    const refresh = () =>
      get<{ messages: number }>("/notifications/unread-summary")
        .then((r) => setUnread(r.messages ?? 0))
        .catch(() => {});
    refresh();
    // Refrescar cuando el chat marca notificaciones como leídas, y con un sondeo
    // suave para reflejar mensajes nuevos sin recargar la app.
    window.addEventListener("beel:badges", refresh);
    const poll = setInterval(refresh, 20000);
    return () => {
      window.removeEventListener("beel:badges", refresh);
      clearInterval(poll);
    };
  }, [isSignedIn, get, pathname]);

  useEffect(() => {
    if (!isSignedIn) return;
    get<{ role: string }>("/users/me")
      .then((d) => setIsAdmin(d.role === "admin"))
      .catch(() => {});
  }, [isSignedIn, get]);

  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) || HIDDEN_MATCHES(pathname);

  useEffect(() => {
    document.body.classList.toggle("has-bottom-nav", !hidden);
    return () => document.body.classList.remove("has-bottom-nav");
  }, [hidden]);

  if (hidden) return null;

  return (
    <nav className="md:hidden fixed left-1/2 -translate-x-1/2 z-40 bottom-nav-float rounded-full max-w-[calc(100vw-24px)]">
      <div className="flex items-center px-2">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const href = tab.authOnly && !isSignedIn ? `/iniciar-sesion?callbackUrl=${encodeURIComponent(tab.href)}` : tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={href}
              aria-label={tab.label}
              className={cn(
                "flex items-center justify-center w-12 h-14 transition-all duration-150 active:scale-[0.88] active:opacity-85",
                active ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"
              )}
            >
              <span className="relative">
                <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                {tab.label === "Mensajes" && unread > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
