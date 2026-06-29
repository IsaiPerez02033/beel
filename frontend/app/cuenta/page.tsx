"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck, Briefcase, Settings, HelpCircle, LogOut,
  ChevronRight, Map, Heart, User as UserIcon, BadgeCheck,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import BecomeHostModal from "@/components/BecomeHostModal";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

export default function CuentaPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded, signOut, userId } = useAuth();
  const { get } = useApi();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("guest");
  const [verified, setVerified] = useState(false);
  const [showHostModal, setShowHostModal] = useState(false);

  const isAdmin = role === "admin";
  const isHost = role === "host" || role === "admin";

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/iniciar-sesion?callbackUrl=/cuenta");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    get<{ role: string; avatar_url: string | null; full_name: string; is_phone_verified: boolean; is_identity_verified: boolean }>("/users/me")
      .then((d) => {
        setRole(d.role ?? "guest");
        setAvatarUrl(d.avatar_url ?? null);
        setFullName(d.full_name ?? "");
        setVerified(!!d.is_phone_verified && !!d.is_identity_verified);
      })
      .catch(() => {});
  }, [isSignedIn, get]);

  function goHostMode() {
    if (verified || isHost) router.push("/anfitrion");
    else setShowHostModal(true);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-display font-display font-semibold text-[var(--text-primary)] mb-6">Perfil</h1>

        {/* Tarjeta de perfil */}
        <Link href={userId ? `/u/${userId}` : "#"} className="card p-6 flex flex-col items-center text-center mb-5 hover:shadow-md transition-shadow">
          <div className="relative mb-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={fullName} className="w-24 h-24 rounded-full object-cover ring-2 ring-[var(--color-primary-border)]" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center text-3xl font-bold text-[var(--color-primary)]">
                {fullName.charAt(0).toUpperCase() || <UserIcon size={32} />}
              </div>
            )}
            {verified && (
              <span className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center border-2 border-[var(--bg-elevated)]">
                <ShieldCheck size={14} className="text-white" />
              </span>
            )}
          </div>
          <p className="text-h2 font-semibold text-[var(--text-primary)]">{fullName || "Tu perfil"}</p>
          <p className="text-body-sm text-[var(--text-tertiary)]">{isHost ? "Anfitrión" : "Huésped"}</p>
          <span className="mt-2 text-caption text-[var(--color-primary)] font-medium">Ver perfil público →</span>
        </Link>

        {/* Accesos rápidos */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <HubCard href="/reservaciones" icon={<Map size={22} />} label="Viajes" />
          <HubCard href="/mensajes" icon={<Heart size={22} />} label="Favoritos" disabled />
        </div>

        {/* Conviértete en anfitrión / Modo anfitrión */}
        <button
          onClick={goHostMode}
          className="w-full card p-5 flex items-center gap-4 mb-5 text-left hover:shadow-md transition-shadow"
        >
          <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
            <Briefcase size={20} className="text-[var(--color-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body font-semibold text-[var(--text-primary)]">
              {isHost ? "Modo anfitrión" : "Conviértete en anfitrión"}
            </p>
            <p className="text-body-sm text-[var(--text-secondary)]">
              {isHost ? "Administra tus propiedades y reservas." : "Es fácil empezar a hospedar y ganar dinero extra."}
            </p>
          </div>
          <ChevronRight size={18} className="text-[var(--text-tertiary)] flex-shrink-0" />
        </button>

        {/* Menú de opciones */}
        <div className="card divide-y divide-[var(--border-subtle)] overflow-hidden">
          <MenuRow href="/anfitrion/configuracion?seccion=perfil" icon={<UserIcon size={18} />} label="Información personal" />
          <MenuRow href="/anfitrion/configuracion?seccion=seguridad" icon={<Settings size={18} />} label="Configuración y seguridad" />
          <MenuRow href="/ayuda" icon={<HelpCircle size={18} />} label="Centro de ayuda" />
          {isAdmin && (
            <MenuRow href="/admin" icon={<BadgeCheck size={18} />} label="Panel de administrador" highlight />
          )}
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <span className="text-red-500"><LogOut size={18} /></span>
            <span className="text-body text-red-500 font-medium">Cerrar sesión</span>
          </button>
        </div>
      </main>

      <BecomeHostModal open={showHostModal} onClose={() => setShowHostModal(false)} />
    </div>
  );
}

function HubCard({ href, icon, label, disabled }: { href: string; icon: React.ReactNode; label: string; disabled?: boolean }) {
  const content = (
    <div className="card p-5 flex flex-col items-start gap-3 h-full">
      <span className="text-[var(--color-primary)]">{icon}</span>
      <span className="text-body font-semibold text-[var(--text-primary)]">{label}</span>
      {disabled && <span className="text-caption text-[var(--text-tertiary)]">Próximamente</span>}
    </div>
  );
  if (disabled) return <div className="opacity-60 pointer-events-none">{content}</div>;
  return <Link href={href} className="hover:shadow-md transition-shadow rounded-2xl">{content}</Link>;
}

function MenuRow({ href, icon, label, highlight }: { href: string; icon: React.ReactNode; label: string; highlight?: boolean }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors">
      <span className={highlight ? "text-[var(--color-primary)]" : "text-[var(--text-secondary)]"}>{icon}</span>
      <span className={`flex-1 text-body ${highlight ? "text-[var(--color-primary)] font-semibold" : "text-[var(--text-primary)]"}`}>{label}</span>
      <ChevronRight size={18} className="text-[var(--text-tertiary)]" />
    </Link>
  );
}
