"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import Navbar from "@/components/Navbar";
import Price from "@/components/Price";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ShieldCheck, DollarSign, RefreshCw, CheckCircle,
  XCircle, Clock, AlertTriangle, ChevronRight, Search,
} from "lucide-react";

interface AdminPayment {
  id: string;
  reservation_id: string;
  amount: number;
  currency: string;
  platform_fee: number;
  host_payout: number;
  status: string;
  payout_status: string;
  beel_approved_at?: string;
  beel_approved_by?: string;
  refund_id?: string;
  refunded_at?: string;
  refund_reason?: string;
  created_at: string;
  reservation: {
    check_in: string;
    check_out: string;
    nights: number;
    guest: { full_name: string; email: string };
    host: { full_name: string; email: string };
    reservation_property: { title: string };
  };
}

const PAYOUT_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:                { label: "Pendiente",           color: "badge-neutral",  icon: <Clock size={12} /> },
  awaiting_beel_approval: { label: "Esperando aprobación", color: "badge-accent",  icon: <AlertTriangle size={12} /> },
  approved:               { label: "Aprobado",            color: "badge-verified", icon: <CheckCircle size={12} /> },
  completed:              { label: "Pagado al anfitrión", color: "badge-verified", icon: <CheckCircle size={12} /> },
  refunded:               { label: "Reembolsado",         color: "text-red-600 bg-red-50", icon: <XCircle size={12} /> },
  failed:                 { label: "Fallido",             color: "text-red-600 bg-red-50", icon: <XCircle size={12} /> },
};

type FilterTab = "pendientes" | "aprobados" | "reembolsados" | "todos";

export default function AdminPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const { get, post } = useApi();

  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>("pendientes");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refundModal, setRefundModal] = useState<{ paymentId: string; amount: number } | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/iniciar-sesion?redirect_url=/admin");
      return;
    }
    fetchPayments();
  }, [isSignedIn, isLoaded]);

  async function fetchPayments() {
    setLoading(true);
    try {
      const data = await get<{ payments: AdminPayment[] }>("/payments/admin/list");
      setPayments(data.payments);
    } catch (e) {
      // Si el usuario no es admin, redirigir
      if (e instanceof Error && e.message.includes("403")) {
        router.push("/");
      }
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(paymentId: string) {
    setActionLoading(paymentId);
    setError("");
    try {
      await post(`/payments/${paymentId}/approve-payout`, { notes: "" });
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId
            ? { ...p, payout_status: "approved", beel_approved_at: new Date().toISOString() }
            : p
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al aprobar");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefund() {
    if (!refundModal || !refundReason.trim()) return;
    setActionLoading(refundModal.paymentId);
    setError("");
    try {
      await post(`/payments/${refundModal.paymentId}/refund`, { reason: refundReason });
      setPayments((prev) =>
        prev.map((p) =>
          p.id === refundModal.paymentId
            ? { ...p, payout_status: "refunded", refunded_at: new Date().toISOString(), refund_reason: refundReason }
            : p
        )
      );
      setRefundModal(null);
      setRefundReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al reembolsar");
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = payments.filter((p) => {
    const matchesTab =
      tab === "todos" ? true :
      tab === "pendientes" ? p.payout_status === "awaiting_beel_approval" :
      tab === "aprobados" ? ["approved", "completed"].includes(p.payout_status) :
      p.payout_status === "refunded";

    const q = search.toLowerCase();
    const matchesSearch = !q ||
      p.reservation?.reservation_property?.title?.toLowerCase().includes(q) ||
      p.reservation?.guest?.full_name?.toLowerCase().includes(q) ||
      p.reservation?.host?.full_name?.toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  const pendingCount = payments.filter((p) => p.payout_status === "awaiting_beel_approval").length;

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <ShieldCheck size={28} className="text-[var(--color-primary)]" />
            <div>
              <h1 className="text-display font-display font-medium text-[var(--text-primary)]">
                Panel de administración
              </h1>
              <p className="text-body text-[var(--text-secondary)]">
                Gestiona pagos, aprobaciones y reembolsos
              </p>
            </div>
          </div>
          <button
            onClick={fetchPayments}
            className="btn btn-outline flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw size={16} className={cn(loading && "animate-spin")} />
            Actualizar
          </button>
        </div>

        {/* Stats rápidos */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MiniStat label="Total pagos" value={payments.length} />
            <MiniStat
              label="Esperando aprobación"
              value={pendingCount}
              highlight={pendingCount > 0}
            />
            <MiniStat
              label="Aprobados"
              value={payments.filter((p) => ["approved", "completed"].includes(p.payout_status)).length}
            />
            <MiniStat
              label="Reembolsados"
              value={payments.filter((p) => p.payout_status === "refunded").length}
            />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">
            {error}
          </div>
        )}

        {/* Búsqueda */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            className="input w-full pl-9"
            placeholder="Buscar por propiedad, huésped o anfitrión…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border-subtle)]">
          {([
            { key: "pendientes", label: `Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { key: "aprobados",  label: "Aprobados" },
            { key: "reembolsados", label: "Reembolsados" },
            { key: "todos",     label: "Todos" },
          ] as { key: FilterTab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-4 py-2.5 text-body-sm font-medium border-b-2 transition-colors -mb-px",
                tab === t.key
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista de pagos */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-5 animate-pulse space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state py-16">
            <div className="text-5xl">✅</div>
            <h2 className="text-h1 text-[var(--text-primary)]">
              {tab === "pendientes" ? "Sin pagos pendientes" : "Sin resultados"}
            </h2>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <PaymentRow
                key={p.id}
                payment={p}
                actionLoading={actionLoading}
                onApprove={handleApprove}
                onRefund={(id, amount) => { setRefundModal({ paymentId: id, amount }); setError(""); }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal de reembolso */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-2">
              Emitir reembolso
            </h3>
            <p className="text-body text-[var(--text-secondary)] mb-4">
              Se reembolsarán <span className="font-semibold text-[var(--text-primary)]">
                {<Price amount={refundModal.amount} />}
              </span> al huésped a través de MercadoPago.
              La reserva quedará cancelada.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-body-sm text-amber-800">
                Esta acción no se puede deshacer. El reembolso puede tardar 1–15 días hábiles.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                Motivo del reembolso <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full resize-none"
                rows={3}
                placeholder="Ej: El anfitrión no puede recibir al huésped en las fechas acordadas"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setRefundModal(null); setRefundReason(""); setError(""); }}
                className="btn btn-outline flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={handleRefund}
                disabled={!refundReason.trim() || actionLoading !== null}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1 disabled:opacity-50"
              >
                {actionLoading ? "Procesando…" : "Confirmar reembolso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={cn("card p-4", highlight && "border-amber-300 bg-amber-50")}>
      <p className="text-caption text-[var(--text-secondary)] mb-1">{label}</p>
      <p className={cn("text-h2 font-semibold", highlight ? "text-amber-700" : "text-[var(--text-primary)]")}>
        {value}
      </p>
    </div>
  );
}

function PaymentRow({
  payment: p, actionLoading, onApprove, onRefund,
}: {
  payment: AdminPayment;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onRefund: (id: string, amount: number) => void;
}) {
  const statusInfo = PAYOUT_STATUS[p.payout_status] ?? { label: p.payout_status, color: "badge-neutral", icon: null };
  const isLoading = actionLoading === p.id;
  const canApprove = p.payout_status === "awaiting_beel_approval";
  const canRefund = ["awaiting_beel_approval", "approved"].includes(p.payout_status);
  const res = p.reservation;

  return (
    <div className="card p-5">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-body font-medium text-[var(--text-primary)] line-clamp-1">
              {res?.reservation_property?.title ?? "Propiedad desconocida"}
            </p>
            <span className={cn("badge flex-shrink-0 flex items-center gap-1", statusInfo.color)}>
              {statusInfo.icon}
              {statusInfo.label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-body-sm">
            <div>
              <span className="text-[var(--text-tertiary)]">Huésped: </span>
              <span className="text-[var(--text-secondary)]">{res?.guest?.full_name}</span>
            </div>
            <div>
              <span className="text-[var(--text-tertiary)]">Anfitrión: </span>
              <span className="text-[var(--text-secondary)]">{res?.host?.full_name}</span>
            </div>
            {res?.check_in && (
              <div>
                <span className="text-[var(--text-tertiary)]">Fechas: </span>
                <span className="text-[var(--text-secondary)]">
                  {format(parseISO(res.check_in), "d MMM", { locale: es })} →{" "}
                  {format(parseISO(res.check_out), "d MMM yyyy", { locale: es })}
                </span>
              </div>
            )}
            <div>
              <span className="text-[var(--text-tertiary)]">Pagado: </span>
              <span className="text-[var(--text-secondary)]">
                {format(parseISO(p.created_at), "d MMM yyyy", { locale: es })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <div>
              <p className="text-caption text-[var(--text-tertiary)]">Total pagado</p>
              <p className="text-body font-semibold text-[var(--text-primary)]">{<Price amount={p.amount} />}</p>
            </div>
            <div>
              <p className="text-caption text-[var(--text-tertiary)]">Al anfitrión</p>
              <p className="text-body font-semibold text-[var(--color-primary)]">{<Price amount={p.host_payout} />}</p>
            </div>
            {p.beel_approved_at && (
              <div>
                <p className="text-caption text-[var(--text-tertiary)]">Aprobado</p>
                <p className="text-caption text-[var(--text-secondary)]">
                  {format(parseISO(p.beel_approved_at), "d MMM HH:mm", { locale: es })}
                </p>
              </div>
            )}
            {p.refunded_at && (
              <div>
                <p className="text-caption text-[var(--text-tertiary)]">Reembolso</p>
                <p className="text-caption text-red-600">
                  {format(parseISO(p.refunded_at), "d MMM HH:mm", { locale: es })}
                </p>
              </div>
            )}
          </div>

          {p.refund_reason && (
            <p className="text-caption text-[var(--text-secondary)] mt-2">
              Motivo: {p.refund_reason}
            </p>
          )}
        </div>

        {(canApprove || canRefund) && (
          <div className="flex md:flex-col gap-2 flex-shrink-0">
            {canApprove && (
              <button
                onClick={() => onApprove(p.id)}
                disabled={isLoading}
                className="btn btn-primary flex items-center gap-2 whitespace-nowrap"
              >
                <CheckCircle size={15} />
                {isLoading ? "…" : "Aprobar payout"}
              </button>
            )}
            {canRefund && (
              <button
                onClick={() => onRefund(p.id, p.amount)}
                disabled={isLoading}
                className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-2 whitespace-nowrap"
              >
                <XCircle size={15} />
                Reembolsar
              </button>
            )}
          </div>
        )}
      </div>

      <Link
        href={`/reservaciones/${p.reservation_id}`}
        className="mt-3 flex items-center gap-1 text-caption text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
      >
        Ver reserva <ChevronRight size={12} />
      </Link>
    </div>
  );
}
