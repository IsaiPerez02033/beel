"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ShieldCheck, LogOut, Settings, User, Home, Briefcase, MessageSquare, Map, HelpCircle, Bell, Check } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import BecomeHostModal from "@/components/BecomeHostModal";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Extrae primer nombre + primer apellido de un nombre completo.
// "Isai Aram Perez Flores" → "Isai Perez" | "Ana López" → "Ana López"
function shortName(full: string): string {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0];
  // 4+ palabras = 2 nombres + 2 apellidos → nombre[0] + apellido[2]
  const surname = words.length >= 4 ? words[2] : words[1];
  return `${words[0]} ${surname}`;
}

export default function NavbarAuth() {
  const { isSignedIn, signOut } = useAuth();
  const { get } = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string>("");
  const [verified, setVerified] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);

  // Modo anfitrión cuando estamos en su área
  const isHostArea =
    pathname.startsWith("/anfitrion") || pathname.startsWith("/p/nueva") || pathname.includes("/editar");

  useEffect(() => {
    if (!isSignedIn) return;
    get<{ role: string; avatar_url: string | null; full_name: string; is_phone_verified: boolean; is_identity_verified: boolean }>("/users/me")
      .then((d) => {
        setIsAdmin(d.role === "admin");
        setAvatarUrl(d.avatar_url ?? null);
        setFullName(d.full_name ?? "");
        setVerified(!!d.is_phone_verified && !!d.is_identity_verified);
      })
      .catch(() => {});
  }, [isSignedIn, get]);

  // Toggle de modo: entrar a anfitrión requiere verificación
  function toggleMode() {
    if (isHostArea) {
      router.push("/");
    } else if (verified) {
      router.push("/anfitrion");
    } else {
      setShowHostModal(true); // modal con los pasos de verificación
    }
  }

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
    <div className="flex items-center gap-1.5">
      {/* Toggle de modo anfitrión / huésped (el Admin vive en el menú del avatar) */}
      <button
        onClick={toggleMode}
        className="hidden sm:flex items-center gap-1.5 btn btn-ghost text-xs px-3 py-2 font-medium whitespace-nowrap"
      >
        {isHostArea ? (
          <><Home size={14} /> Usar como huésped</>
        ) : (
          <><Briefcase size={14} /> Modo anfitrión</>
        )}
      </button>

      {fullName && (
        <span className="hidden lg:block text-body-sm text-[var(--text-secondary)] ml-1 mr-0.5 whitespace-nowrap">
          ¡Hola, <span className="font-medium text-[var(--text-primary)]">{shortName(fullName)}</span>!
        </span>
      )}

      {/* Campana de Notificaciones */}
      <NotificationsDropdown />

      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-9 h-9 rounded-full overflow-hidden bg-[var(--color-primary)] text-white flex items-center justify-center text-body-sm font-medium hover:opacity-90 transition-opacity ring-1 ring-[var(--border-subtle)]"
          title={fullName}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
          ) : fullName ? (
            <span>{fullName.charAt(0).toUpperCase()}</span>
          ) : (
            <User size={16} />
          )}
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-12 z-20 bg-[var(--bg-elevated)] rounded-2xl shadow-xl border border-[var(--border-subtle)] py-2 min-w-[260px] overflow-hidden">
              {/* Encabezado */}
              {fullName && (
                <div className="px-4 py-2 mb-1">
                  <p className="text-body-sm text-[var(--text-tertiary)]">Hola,</p>
                  <p className="text-body font-semibold text-[var(--text-primary)] truncate">{shortName(fullName)}</p>
                </div>
              )}
              <Divider />

              {/* Grupo principal */}
              <MenuLink href="/reservaciones" icon={<Map size={17} />} onClick={() => setShowMenu(false)}>
                Viajes
              </MenuLink>
              <MenuLink href="/mensajes" icon={<MessageSquare size={17} />} onClick={() => setShowMenu(false)}>
                Mensajes
              </MenuLink>

              <Divider />

              <MenuLink href="/anfitrion/configuracion?seccion=perfil" icon={<User size={17} />} onClick={() => setShowMenu(false)}>
                Perfil
              </MenuLink>
              <MenuLink href="/anfitrion/configuracion?seccion=seguridad" icon={<Settings size={17} />} onClick={() => setShowMenu(false)}>
                Configuración y seguridad
              </MenuLink>
              <MenuLink href="/ayuda" icon={<HelpCircle size={17} />} onClick={() => setShowMenu(false)}>
                Centro de ayuda
              </MenuLink>
              {isAdmin && (
                <MenuLink href="/admin" icon={<ShieldCheck size={17} />} onClick={() => setShowMenu(false)}>
                  Panel de administración
                </MenuLink>
              )}

              <Divider />

              {/* Conviértete en anfitrión (bloque destacado) */}
              {!isHostArea && (
                <button
                  onClick={() => { setShowMenu(false); toggleMode(); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <p className="text-body-sm font-semibold text-[var(--text-primary)]">
                    {verified ? "Ir a mi panel de anfitrión" : "Conviértete en anfitrión"}
                  </p>
                  <p className="text-caption text-[var(--text-tertiary)] mt-0.5">
                    {verified ? "Gestiona tus propiedades y reservas." : "Es fácil empezar a hospedar y ganar dinero extra."}
                  </p>
                </button>
              )}
              {isHostArea && (
                <MenuLink href="/" icon={<Home size={17} />} onClick={() => setShowMenu(false)}>
                  Usar como huésped
                </MenuLink>
              )}

              <Divider />

              <button
                onClick={() => { setShowMenu(false); signOut(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-body-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
              >
                <LogOut size={17} className="text-[var(--text-secondary)]" />
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>

      <BecomeHostModal open={showHostModal} onClose={() => setShowHostModal(false)} />
    </div>
  );
}

export function NavbarAuthMobile({ onClose }: { onClose: () => void }) {
  const { isSignedIn, signOut } = useAuth();
  const { get } = useApi();
  const router = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [verified, setVerified] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);

  const isHostArea =
    pathname.startsWith("/anfitrion") || pathname.startsWith("/p/nueva") || pathname.includes("/editar");

  useEffect(() => {
    if (!isSignedIn) return;
    get<{ role: string; is_phone_verified: boolean; is_identity_verified: boolean }>("/users/me")
      .then((d) => {
        setIsAdmin(d.role === "admin");
        setVerified(!!d.is_phone_verified && !!d.is_identity_verified);
      })
      .catch(() => {});
  }, [isSignedIn, get]);

  if (!isSignedIn) {
    return (
      <div className="space-y-1 pt-2">
        <MobileLink href="/iniciar-sesion" onClick={onClose} icon={<User size={18} />}>Iniciar sesión</MobileLink>
        <MobileLink href="/registro" onClick={onClose} icon={<ShieldCheck size={18} />}>Registrarse</MobileLink>
      </div>
    );
  }

  function toggleMode() {
    if (isHostArea) { onClose(); router.push("/"); }
    else if (verified) { onClose(); router.push("/anfitrion"); }
    else { setShowHostModal(true); }
  }

  return (
    <>
      <BecomeHostModal open={showHostModal} onClose={() => { setShowHostModal(false); onClose(); }} />

      {/* Modo anfitrión/huésped — destacado arriba */}
      <button
        onClick={toggleMode}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-body font-semibold text-[var(--color-primary)] bg-[var(--color-primary-light)] hover:bg-[var(--color-primary-light)] transition-colors mb-2"
      >
        <Briefcase size={18} className="flex-shrink-0" />
        {isHostArea ? "Usar como huésped" : "Modo anfitrión"}
      </button>

      {/* Links principales */}
      <div className="space-y-0.5">
        <MobileLink href="/buscar" onClick={onClose} icon={<Map size={18} />}>Explorar</MobileLink>
        <MobileLink href="/reservaciones" onClick={onClose} icon={<Home size={18} />}>Viajes</MobileLink>
        <MobileLink href="/mensajes" onClick={onClose} icon={<MessageSquare size={18} />}>Mensajes</MobileLink>
      </div>

      <div className="border-t border-[var(--border-subtle)] my-3" />

      {/* Cuenta */}
      <div className="space-y-0.5">
        <MobileLink href="/anfitrion/configuracion?seccion=perfil" onClick={onClose} icon={<User size={18} />}>Perfil</MobileLink>
        <MobileLink href="/anfitrion/configuracion?seccion=seguridad" onClick={onClose} icon={<Settings size={18} />}>Configuración y seguridad</MobileLink>
        <MobileLink href="/ayuda" onClick={onClose} icon={<HelpCircle size={18} />}>Centro de ayuda</MobileLink>
        {isAdmin && <MobileLink href="/admin" onClick={onClose} icon={<ShieldCheck size={18} />}>Panel Admin</MobileLink>}
      </div>

      <div className="border-t border-[var(--border-subtle)] my-3" />

      {/* Cerrar sesión */}
      <button
        onClick={() => { onClose(); signOut(); }}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-body font-medium text-red-600 hover:bg-red-50 transition-colors"
      >
        <LogOut size={18} className="flex-shrink-0" />
        Cerrar sesión
      </button>
    </>
  );
}

// Ítem del menú desplegable (estilo Airbnb)
function MenuLink({ href, icon, onClick, children }: { href: string; icon: React.ReactNode; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-body-sm text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
    >
      <span className="text-[var(--text-secondary)]">{icon}</span>
      {children}
    </Link>
  );
}

function Divider() {
  return <div className="my-1.5 border-t border-[var(--border-subtle)]" />;
}

function MobileLink({ href, onClick, icon, children }: { href: string; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-3 px-4 py-3 rounded-xl text-body font-medium text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors">
      {icon && <span className="text-[var(--text-secondary)] flex-shrink-0">{icon}</span>}
      {children}
    </Link>
  );
}

interface NotificationItem {
  id: string;
  type: string;
  title?: string;
  body?: string;
  is_read: boolean;
  created_at: string;
  data?: {
    reservation_id?: string;
    property_id?: string;
    conversation_id?: string;
  };
}

function NotificationsDropdown() {
  const { get, post } = useApi();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isSignedIn) return;

    const fetchNotifs = () => {
      get<{ notifications: NotificationItem[]; unread_count: number }>("/notifications?limit=8")
        .then((res) => {
          setNotifications(res.notifications ?? []);
          setUnreadCount(res.unread_count ?? 0);
        })
        .catch(() => {});
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 45000);
    return () => clearInterval(interval);
  }, [isSignedIn, get]);

  async function handleMarkAllRead() {
    try {
      await post("/notifications/read-all", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleNotificationClick(notif: NotificationItem) {
    setShowNotifications(false);
    
    if (!notif.is_read) {
      post(`/notifications/${notif.id}/read`, {})
        .then(() => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
          );
          setUnreadCount((c) => Math.max(0, c - 1));
        })
        .catch(() => {});
    }

    if (notif.data?.reservation_id) {
      router.push(`/reservaciones/${notif.data.reservation_id}`);
    } else if (notif.data?.conversation_id) {
      router.push(`/mensajes?conv=${notif.data.conversation_id}`);
    } else if (notif.data?.property_id) {
      router.push(`/p/${notif.data.property_id}`);
    } else {
      router.push("/reservaciones");
    }
  }

  if (!isSignedIn) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 rounded-full hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        title="Notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[9px] font-bold ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
          <div className="absolute right-0 top-11 z-20 bg-[var(--bg-elevated)] rounded-2xl shadow-xl border border-[var(--border-subtle)] py-2 w-80 max-h-[420px] flex flex-col overflow-hidden animate-fade-in">
            <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-body font-semibold text-[var(--text-primary)]">Notificaciones</span>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-caption font-medium text-[var(--color-primary)] hover:underline"
                >
                  Marcar leídas
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-[100px] max-h-[300px]">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-caption text-[var(--text-tertiary)]">
                  No tienes notificaciones
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors border-b border-[var(--border-subtle)] flex items-start gap-3",
                      !n.is_read && "bg-[var(--color-primary-light)]/20 font-medium"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm font-semibold text-[var(--text-primary)] leading-snug">
                        {n.title ?? "Notificación"}
                      </p>
                      <p className="text-caption text-[var(--text-secondary)] line-clamp-2 mt-0.5 leading-relaxed">
                        {n.body}
                      </p>
                      <span className="text-[9px] text-[var(--text-tertiary)] mt-1 block">
                        {format(parseISO(n.created_at), "d MMM, HH:mm", { locale: es })}
                      </span>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] flex-shrink-0 mt-1.5" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
