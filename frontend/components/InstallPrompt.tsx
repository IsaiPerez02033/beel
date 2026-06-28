"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

const DISMISS_KEY = "beel-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Ya instalada (standalone) → no mostrar
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const ios = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // iOS no dispara beforeinstallprompt: mostramos instrucciones
      const t = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(t);
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 sm:left-auto sm:right-4 sm:w-80">
      <div className="card p-4 shadow-lg flex items-start gap-3 border border-[var(--border-default)]">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-[var(--color-primary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-semibold text-[var(--text-primary)] mb-0.5">
            Instala Beel en tu celular
          </p>
          {isIOS ? (
            <p className="text-caption text-[var(--text-secondary)] leading-snug">
              Toca <Share size={12} className="inline -mt-0.5" /> abajo y elige{" "}
              <strong>“Agregar a inicio”</strong>.
            </p>
          ) : (
            <>
              <p className="text-caption text-[var(--text-secondary)] leading-snug mb-2">
                Acceso rápido, pantalla completa, como una app.
              </p>
              <button
                onClick={install}
                className="btn btn-primary text-caption px-3 py-1.5"
              >
                Instalar
              </button>
            </>
          )}
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
