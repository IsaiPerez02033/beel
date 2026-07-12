"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useApi } from "@/hooks/useApi";

const SUBSCRIBED_KEY = "beel-push-subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Fila con interruptor para activar/desactivar notificaciones push, pensada
 * para la página de cuenta. Permite activarlas manualmente aunque el banner
 * PushPrompt se haya cerrado.
 */
export default function PushToggle() {
  const { post, del } = useApi();
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // null = evaluando soporte; "unsupported" nunca se muestra
  const [state, setState] = useState<"loading" | "unsupported" | "needs-install" | "denied" | "on" | "off">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !vapidKey) { setState("unsupported"); return; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState("unsupported");
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (ios && !standalone) { setState("needs-install"); return; }
    if (Notification.permission === "denied") { setState("denied"); return; }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidKey]);

  async function toggle() {
    if (busy || !vapidKey) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (state === "on") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await del("/notifications/push-subscribe", { endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
        try { localStorage.removeItem(SUBSCRIBED_KEY); } catch {}
        setState("off");
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
          }));
        await post("/notifications/push-subscribe", sub.toJSON());
        try { localStorage.setItem(SUBSCRIBED_KEY, "1"); } catch {}
        setState("on");
      }
    } catch (e) {
      console.error("No se pudo cambiar el estado de push:", e);
    } finally {
      setBusy(false);
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  const subtitle =
    state === "needs-install"
      ? "Agrega Beel a tu pantalla de inicio para activarlas"
      : state === "denied"
        ? "Bloqueadas: actívalas en los ajustes de tu navegador"
        : state === "on"
          ? "Mensajes y reservas te llegan al instante"
          : "Entérate de mensajes y reservas al momento";

  const interactive = state === "on" || state === "off";

  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="text-[var(--text-secondary)]"><Bell size={18} /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-body text-[var(--text-primary)]">Notificaciones push</span>
        <span className="block text-caption text-[var(--text-secondary)] truncate">{subtitle}</span>
      </span>
      {interactive && (
        <button
          role="switch"
          aria-checked={state === "on"}
          aria-label="Notificaciones push"
          disabled={busy}
          onClick={toggle}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
            state === "on" ? "bg-[var(--color-primary)]" : "bg-[var(--border-default)]"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              state === "on" ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      )}
    </div>
  );
}
