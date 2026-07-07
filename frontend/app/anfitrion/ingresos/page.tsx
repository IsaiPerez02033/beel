"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import Price from "@/components/Price";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Wallet, Clock, TrendingUp } from "lucide-react";

interface HostReservation {
  id: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_amount: number;
  host_net_payout?: number;
  subtotal?: number;
  cleaning_fee_snapshot?: number;
  currency: string;
  status: string;
  guest: { full_name: string; avatar_url?: string };
  reservation_property: { title: string };
}

const thisMonth = new Date().toISOString().slice(0, 7);

export default function IngresosPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { get } = useApi();
  const [reservations, setReservations] = useState<HostReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/iniciar-sesion?callbackUrl=/anfitrion/ingresos");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    get<{ reservations: HostReservation[] }>("/reservations/host-requests?per_page=50")
      .then((d) => setReservations(d.reservations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSignedIn, get]);

  // Movimientos = reservas con dinero (confirmadas o completadas)
  const movimientos = reservations
    .filter((r) => r.status === "confirmed" || r.status === "completed")
    .sort((a, b) => (a.check_in < b.check_in ? 1 : -1));

  // Neto al anfitrión. Fallback para reservas viejas (sin host_net_payout):
  // usa habitación + limpieza (base sin retención, modelo previo).
  const net = (r: HostReservation) => {
    const hn = Number(r.host_net_payout);
    if (hn > 0) return hn;
    const base = Number(r.subtotal ?? 0) + Number(r.cleaning_fee_snapshot ?? 0);
    return base > 0 ? base : Number(r.total_amount) || 0;
  };
  const totalRecibido = movimientos.filter((r) => r.status === "completed").reduce((s, r) => s + net(r), 0);
  const pendiente = movimientos.filter((r) => r.status === "confirmed").reduce((s, r) => s + net(r), 0);
  const esteMes = movimientos.filter((r) => r.check_in.startsWith(thisMonth)).reduce((s, r) => s + net(r), 0);

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/anfitrion" className="inline-flex items-center gap-1.5 text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 transition-colors">
          <ChevronLeft size={16} /> Volver al panel
        </Link>
        <h1 className="text-display font-display font-semibold text-[var(--text-primary)] mb-1">Ingresos</h1>
        <p className="text-body-sm text-[var(--text-tertiary)] mb-6">
          Todos tus movimientos: lo que paga el huésped y lo que recibes tú (neto de impuestos).
        </p>

        {/* Resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard icon={<Wallet size={18} />} label="Total recibido" value={<Price amount={totalRecibido} />} />
          <SummaryCard icon={<Clock size={18} />} label="Pendiente de pago" value={<Price amount={pendiente} />} />
          <SummaryCard icon={<TrendingUp size={18} />} label="Este mes" value={<Price amount={esteMes} />} />
        </div>

        {/* Movimientos */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[var(--color-primary)]" size={30} />
          </div>
        ) : movimientos.length === 0 ? (
          <div className="card p-10 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-3">
              <Wallet size={24} className="text-[var(--color-primary)]" />
            </div>
            <p className="text-body font-semibold text-[var(--text-primary)] mb-1">Aún no tienes ingresos</p>
            <p className="text-body-sm text-[var(--text-secondary)]">
              Cuando confirmes reservas, tus movimientos aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="card divide-y divide-[var(--border-subtle)] overflow-hidden">
            {/* Encabezado (desktop) */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-3 text-caption font-semibold text-[var(--text-tertiary)] bg-[var(--bg-subtle)]">
              <span>Reserva</span>
              <span className="text-right w-28">Huésped pagó</span>
              <span className="text-right w-28">Tú recibes</span>
              <span className="w-6" />
            </div>
            {movimientos.map((r) => (
              <Link
                key={r.id}
                href={`/reservaciones/${r.id}`}
                className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1 px-5 py-4 items-center hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-[var(--text-primary)] truncate">
                    {r.reservation_property?.title}
                  </p>
                  <p className="text-caption text-[var(--text-tertiary)] truncate">
                    {r.guest?.full_name} · {format(parseISO(r.check_in), "d MMM", { locale: es })}
                    {" – "}{format(parseISO(r.check_out), "d MMM yyyy", { locale: es })}
                    {" · "}
                    <span className={r.status === "completed" ? "text-[var(--color-primary)]" : "text-[var(--text-tertiary)]"}>
                      {r.status === "completed" ? "Pagado" : "Por pagarte"}
                    </span>
                  </p>
                </div>
                <span className="text-right sm:w-28 text-body-sm text-[var(--text-secondary)] row-start-1 col-start-2 sm:row-auto">
                  <span className="sm:hidden text-caption text-[var(--text-tertiary)]">Huésped: </span>
                  <Price amount={r.total_amount} />
                </span>
                <span className="text-right sm:w-28 text-body-sm font-semibold text-[var(--color-primary)] col-span-2 sm:col-span-1">
                  <span className="sm:hidden text-caption text-[var(--text-tertiary)] font-normal">Recibes: </span>
                  <Price amount={net(r)} />
                </span>
                <ChevronRight size={16} className="text-[var(--text-tertiary)] hidden sm:block" />
              </Link>
            ))}
          </div>
        )}

        <p className="text-caption text-[var(--text-tertiary)] mt-4">
          &quot;Tú recibes&quot; es el neto después de retención de ISR e IVA (Beel los entera al SAT).
          Registra tu RFC en Configuración para que te retengamos menos.
        </p>
      </main>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center text-[var(--color-primary)] mb-3">
        {icon}
      </div>
      <p className="text-caption text-[var(--text-tertiary)]">{label}</p>
      <p className="text-h2 font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
