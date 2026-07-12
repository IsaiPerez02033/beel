"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

const DISMISS_KEY = "beel-push-dismissed";
const SUBSCRIBED_KEY = "beel-push-subscribed";

/** Convierte la clave pública VAPID (base64url) al Uint8Array que pide pushManager. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Banner de opt-in a notificaciones push (Web Push).
 * Solo aparece si: hay sesión, el navegador soporta push, el permiso no fue
 * denegado, no está ya suscrito, y en iOS solo si la PWA está instalada
 * (iOS únicamente soporta Web Push en apps agregadas a inicio, 16.4+).
 */
export default function PushPrompt() {
  const { isSignedIn, getToken } = useAuth();
  const { post } = useApi();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined" || !isSignedIn || !vapidKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission === "denied") return;
    try {
      if (localStorage.getItem(SUBSCRIBED_KEY)) return;
      // El "cerrar" solo silencia el banner 7 días; después vuelve a ofrecerse.
      // (Valores viejos como "1" cuentan como expirados.)
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    } catch {}

    // iOS: solo funciona con la PWA instalada (standalone)
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (ios && !standalone) return;

    // Si ya hay una suscripción activa en este navegador, no molestar.
    let cancelled = false;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (cancelled) return;
        if (sub) {
          try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch {}
          return;
        }
        const t = setTimeout(() => setShow(true), 4000);
        return () => clearTimeout(t);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isSignedIn, vapidKey]);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  }

  async function enable() {
    if (busy || !vapidKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { dismiss(); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
        }));
      await post("/notifications/push-subscribe", sub.toJSON());
      try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch {}
      setShow(false);
    } catch (e) {
      console.error("No se pudo activar push:", e);
      dismiss();
    } finally {
      setBusy(false);
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 sm:left-auto sm:right-4 sm:w-80">
      <div className="card p-4 shadow-lg flex items-start gap-3 border border-[var(--border-default)]">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
          <Bell size={18} className="text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-semibold text-[var(--text-primary)] mb-0.5">
            Activa las notificaciones
          </p>
          <p className="text-caption text-[var(--text-secondary)] leading-snug mb-2">
            Entérate al momento de mensajes y reservas, aunque la app esté cerrada.
          </p>
          <button
            onClick={enable}
            disabled={busy}
            className="btn btn-primary text-caption px-3 py-1.5 disabled:opacity-60"
          >
            {busy ? "Activando…" : "Activar"}
          </button>
        </div>
        <button
          onClick={dismiss}
          aria-label="Cerrar"
          className="flex-shrink-0 p-1 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
