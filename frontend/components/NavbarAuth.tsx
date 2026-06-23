"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ShieldCheck, LogOut, Settings, User, Home, Briefcase } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import { cn } from "@/lib/utils";
import BecomeHostModal from "@/components/BecomeHostModal";

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

      {/* Toggle de modo anfitrión / huésped */}
      <button
        onClick={toggleMode}
        className="hidden sm:flex items-center gap-1.5 btn btn-ghost text-xs px-3 py-2 font-medium"
      >
        {isHostArea ? (
          <><Home size={14} /> Usar como huésped</>
        ) : (
          <><Briefcase size={14} /> Modo anfitrión</>
        )}
      </button>

      <Link href="/mensajes" className="hidden sm:flex items-center gap-1.5 btn btn-ghost text-xs px-3 py-2">
        Mensajes
      </Link>
      {!isHostArea && (
        <Link href="/reservaciones" className="hidden sm:flex items-center gap-1.5 btn btn-ghost text-xs px-3 py-2">
          Viajes
        </Link>
      )}
      {fullName && (
        <span className="hidden md:block text-body-sm text-[var(--text-secondary)] ml-1">
          Hola, <span className="font-medium text-[var(--text-primary)]">{shortName(fullName)}</span>
        </span>
      )}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="w-8 h-8 rounded-full overflow-hidden bg-[var(--color-primary)] text-white flex items-center justify-center text-body-sm font-medium hover:opacity-90 transition-opacity"
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
      <>
        <MobileLink href="/iniciar-sesion" onClick={onClose}>Iniciar sesión</MobileLink>
        <MobileLink href="/registro" onClick={onClose}>Registrarse</MobileLink>
      </>
    );
  }

  function toggleMode() {
    if (isHostArea) { onClose(); router.push("/"); }
    else if (verified) { onClose(); router.push("/anfitrion"); }
    else { setShowHostModal(true); } // abre el modal (no cierra el menú aún)
  }

  return (
    <>
      <BecomeHostModal open={showHostModal} onClose={() => { setShowHostModal(false); onClose(); }} />
      <button
        onClick={toggleMode}
        className="w-full text-left block px-4 py-3 rounded-lg text-body font-medium text-[var(--color-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
      >
        {isHostArea ? "Usar como huésped" : "Modo anfitrión"}
      </button>
      <MobileLink href="/mensajes" onClick={onClose}>Mensajes</MobileLink>
      {!isHostArea && <MobileLink href="/reservaciones" onClick={onClose}>Viajes</MobileLink>}
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
