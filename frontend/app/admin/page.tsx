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
  XCircle, Clock, AlertTriangle, ChevronRight, Search, ChevronDown, ChevronUp,
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
    host: {
      full_name: string;
      email: string;
      bank_name?: string;
      bank_clabe?: string;
      bank_account_holder?: string;
    };
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
    if (!isSignedIn) { router.push("/iniciar-sesion?redirect_url=/admin"); return; }
    get<{ role: string }>("/users/me")
      .then((u) => { if (u.role !== "admin") { router.replace("/"); return; } fetchPayments(); })
      .catch(() => router.replace("/"));
  }, [isSignedIn, isLoaded]);

  async function fetchPayments() {
    setLoading(true);
    try {
      const data = await get<{ payments: AdminPayment[] }>("/payments/admin/list");
      setPayments(data.payments);
    } catch (e) {
      if (e instanceof Error && e.message.includes("403")) router.push("/");
      console.error(e);
    } finally { setLoading(false); }
  }

  async function handleApprove(paymentId: string) {
    setActionLoading(paymentId); setError("");
    try {
      await post(`/payments/${paymentId}/approve-payout`, { notes: "" });
      setPayments((prev) => prev.map((p) => p.id === paymentId
        ? { ...p, payout_status: "approved", beel_approved_at: new Date().toISOString() } : p));
    } catch (e) { setError(e instanceof Error ? e.message : "Error al aprobar"); }
    finally { setActionLoading(null); }
  }

  async function handleRefund() {
    if (!refundModal || !refundReason.trim()) return;
    setActionLoading(refundModal.paymentId); setError("");
    try {
      await post(`/payments/${refundModal.paymentId}/refund`, { reason: refundReason });
      setPayments((prev) => prev.map((p) => p.id === refundModal.paymentId
        ? { ...p, payout_status: "refunded", refunded_at: new Date().toISOString(), refund_reason: refundReason } : p));
      setRefundModal(null); setRefundReason("");
    } catch (e) { setError(e instanceof Error ? e.message : "Error al reembolsar"); }
    finally { setActionLoading(null); }
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
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck size={22} className="text-[var(--color-primary)] flex-shrink-0" />
              <div>
                <h1 className="text-h1 sm:text-display font-display font-medium text-[var(--text-primary)] leading-tight">
                  Panel Admin
                </h1>
                <p className="text-caption sm:text-body-sm text-[var(--text-secondary)]">
                  Pagos, aprobaciones y reembolsos
                </p>
              </div>
            </div>
            <button
              onClick={fetchPayments}
              className="btn btn-outline flex items-center gap-1.5 flex-shrink-0 text-body-sm px-3 py-2"
              disabled={loading}
            >
              <RefreshCw size={14} className={cn(loading && "animate-spin")} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
          </div>
          <Link href="/admin/propiedades" className="btn btn-primary flex items-center gap-2 mt-3 w-full sm:w-auto justify-center sm:justify-start">
            <ShieldCheck size={15} />
            Moderar propiedades
          </Link>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <MiniStat label="Total" value={payments.length} />
            <MiniStat label="Pendientes" value={pendingCount} highlight={pendingCount > 0} />
            <MiniStat label="Aprobados" value={payments.filter((p) => ["approved","completed"].includes(p.payout_status)).length} />
            <MiniStat label="Reembolsados" value={payments.filter((p) => p.payout_status === "refunded").length} />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">{error}</div>
        )}

        {/* Búsqueda */}
        <div className="input w-full flex items-center gap-2 p-0 overflow-hidden focus-within:ring-1 focus-within:ring-neutral-900 focus-within:border-neutral-900 mb-4">
          <span className="pl-3 flex-shrink-0 text-[var(--text-tertiary)]"><Search size={15} /></span>
          <input
            className="flex-1 py-2.5 pr-3 outline-none border-none bg-transparent text-sm placeholder-[var(--text-tertiary)]"
            placeholder="Buscar por propiedad, huésped o anfitrión…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabs — scroll horizontal en móvil */}
        <div className="flex gap-0 mb-6 border-b border-[var(--border-subtle)] overflow-x-auto scrollbar-hide -mx-4 px-4">
          {([
            { key: "pendientes",   label: `Pendientes${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
            { key: "aprobados",    label: "Aprobados" },
            { key: "reembolsados", label: "Reembolsados" },
            { key: "todos",        label: "Todos" },
          ] as { key: FilterTab; label: string }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3 sm:px-4 py-2.5 text-body-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap flex-shrink-0",
                tab === t.key
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map((i) => (
              <div key={i} className="card p-4 animate-pulse space-y-2">
                <div className="skeleton h-4 w-1/3 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
                <div className="skeleton h-3 w-1/4 rounded" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state py-16 text-center">
            <div className="text-5xl mb-3">✅</div>
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

      {/* Modal reembolso */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-md shadow-xl">
            <h3 className="text-h2 font-semibold text-[var(--text-primary)] mb-2">Emitir reembolso</h3>
            <p className="text-body text-[var(--text-secondary)] mb-4">
              Se reembolsarán <strong><Price amount={refundModal.amount} /></strong> al huésped. La reserva quedará cancelada.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
              <p className="text-body-sm text-amber-800">Esta acción no se puede deshacer. El reembolso puede tardar 1–15 días hábiles.</p>
            </div>
            <div className="mb-4">
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                Motivo <span className="text-red-500">*</span>
              </label>
              <textarea
                className="input w-full resize-none"
                rows={3}
                placeholder="Ej: El anfitrión no puede recibir al huésped"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm mb-4">{error}</div>}
            <div className="flex gap-3">
              <button onClick={() => { setRefundModal(null); setRefundReason(""); setError(""); }} className="btn btn-outline flex-1">Cancelar</button>
              <button onClick={handleRefund} disabled={!refundReason.trim() || actionLoading !== null} className="btn bg-red-600 text-white hover:bg-red-700 flex-1 disabled:opacity-50">
                {actionLoading ? "Procesando…" : "Confirmar"}
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
    <div className={cn("card p-3 sm:p-4", highlight && "border-amber-300 bg-amber-50")}>
      <p className="text-caption text-[var(--text-secondary)] mb-0.5 truncate">{label}</p>
      <p className={cn("text-h2 font-semibold", highlight ? "text-amber-700" : "text-[var(--text-primary)]")}>{value}</p>
    </div>
  );
}

function PaymentRow({ payment: p, actionLoading, onApprove, onRefund }: {
  payment: AdminPayment; actionLoading: string | null;
  onApprove: (id: string) => void; onRefund: (id: string, amount: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusInfo = PAYOUT_STATUS[p.payout_status] ?? { label: p.payout_status, color: "badge-neutral", icon: null };
  const isLoading = actionLoading === p.id;
  const canApprove = p.payout_status === "awaiting_beel_approval";
  const canRefund = ["awaiting_beel_approval", "approved"].includes(p.payout_status);
  const res = p.reservation;

  return (
    <div className="card p-4">
      {/* Cabecera siempre visible */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-body font-medium text-[var(--text-primary)] truncate">
            {res?.reservation_property?.title ?? "Propiedad desconocida"}
          </p>
          <p className="text-caption text-[var(--text-secondary)] mt-0.5">
            {res?.guest?.full_name} → {res?.host?.full_name}
          </p>
        </div>
        <span className={cn("badge flex-shrink-0 flex items-center gap-1 text-[11px]", statusInfo.color)}>
          {statusInfo.icon}{statusInfo.label}
        </span>
      </div>

      {/* Montos siempre visibles */}
      <div className="flex items-center gap-4 mb-3">
        <div>
          <p className="text-caption text-[var(--text-tertiary)]">Total</p>
          <p className="text-body-sm font-semibold text-[var(--text-primary)]"><Price amount={p.amount} /></p>
        </div>
        <div>
          <p className="text-caption text-[var(--text-tertiary)]">Al anfitrión</p>
          <p className="text-body-sm font-semibold text-[var(--color-primary)]"><Price amount={p.host_payout} /></p>
        </div>
        <div className="ml-auto">
          <p className="text-caption text-[var(--text-tertiary)]">Fecha</p>
          <p className="text-caption text-[var(--text-secondary)]">
            {format(parseISO(p.created_at), "d MMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Botón expandir detalles */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-caption text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-3"
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {expanded ? "Ocultar detalles" : "Ver detalles"}
      </button>

      {/* Detalles expandibles */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] pt-3 mb-3 space-y-2">
          {res?.check_in && (
            <div className="flex justify-between text-body-sm">
              <span className="text-[var(--text-tertiary)]">Fechas</span>
              <span className="text-[var(--text-secondary)]">
                {format(parseISO(res.check_in), "d MMM", { locale: es })} → {format(parseISO(res.check_out), "d MMM yyyy", { locale: es })}
              </span>
            </div>
          )}
          <div className="flex justify-between text-body-sm">
            <span className="text-[var(--text-tertiary)]">Huésped</span>
            <span className="text-[var(--text-secondary)]">{res?.guest?.email}</span>
          </div>
          {res?.host?.bank_clabe && (
            <div className="bg-[var(--bg-subtle)] rounded-xl p-3 border border-[var(--border-subtle)] space-y-1">
              <p className="text-caption font-semibold text-[var(--text-primary)]">Datos de transferencia</p>
              <p className="text-caption text-[var(--text-secondary)]">Titular: {res.host.bank_account_holder}</p>
              <p className="text-caption text-[var(--text-secondary)]">Banco: {res.host.bank_name}</p>
              <p className="text-caption font-mono bg-white px-2 py-0.5 rounded border border-[var(--border-subtle)] select-all w-fit">
                CLABE: {res.host.bank_clabe}
              </p>
            </div>
          )}
          {p.beel_approved_at && (
            <div className="flex justify-between text-body-sm">
              <span className="text-[var(--text-tertiary)]">Aprobado</span>
              <span className="text-[var(--text-secondary)]">{format(parseISO(p.beel_approved_at), "d MMM HH:mm", { locale: es })}</span>
            </div>
          )}
          {p.refunded_at && (
            <div className="flex justify-between text-body-sm">
              <span className="text-[var(--text-tertiary)]">Reembolsado</span>
              <span className="text-red-600">{format(parseISO(p.refunded_at), "d MMM HH:mm", { locale: es })}</span>
            </div>
          )}
          {p.refund_reason && (
            <p className="text-caption text-[var(--text-secondary)]">Motivo: {p.refund_reason}</p>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row gap-2">
        {canApprove && (
          <button onClick={() => onApprove(p.id)} disabled={isLoading}
            className="btn btn-primary flex items-center justify-center gap-2 flex-1">
            <CheckCircle size={14} />
            {isLoading ? "Procesando…" : "Aprobar payout"}
          </button>
        )}
        {canRefund && (
          <button onClick={() => onRefund(p.id, p.amount)} disabled={isLoading}
            className="btn btn-outline text-red-600 border-red-200 hover:bg-red-50 flex items-center justify-center gap-2 flex-1">
            <XCircle size={14} />
            Reembolsar
          </button>
        )}
        <Link href={`/reservaciones/${p.reservation_id}`}
          className="btn btn-outline flex items-center justify-center gap-1 text-caption sm:flex-shrink-0">
          Ver reserva <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  );
}
