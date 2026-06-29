"use client";

import { useAuth } from "@/hooks/useSafeAuth";
import { useCallback } from "react";

// Proxy interno: el browser llama a /api/backend/* (mismo origen, sin CORS).
// En local, si no hay proxy disponible, cae al backend directo.
const IS_BROWSER = typeof window !== "undefined";
const API_BASE = IS_BROWSER ? "/api/backend" : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Render (free tier) duerme el backend tras inactividad: el primer request
// puede tardar o dar 502/503/504 mientras despierta. Reintentamos con backoff.
const TRANSIENT = [502, 503, 504];
const MAX_ATTEMPTS = 3;

/**
 * Hook para hacer llamadas autenticadas a la API de Beel.
 * Incluye JWT de NextAuth y reintentos automáticos ante cold starts.
 */
export function useApi() {
  const { getToken } = useAuth();

  const request = useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      const token = await getToken();
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      };

      let res: Response | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          res = await fetch(`${API_BASE}${path}`, { ...options, headers });
        } catch {
          // Error de red (cold start / conexión caída): reintentar.
          if (attempt < MAX_ATTEMPTS) { await sleep(1200 * attempt); continue; }
          throw new Error("No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.");
        }
        // Backend despertando: reintentar antes de fallar.
        if (TRANSIENT.includes(res.status) && attempt < MAX_ATTEMPTS) {
          await sleep(1500 * attempt);
          continue;
        }
        break;
      }

      if (!res) throw new Error("Sin respuesta del servidor");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        let msg = err.detail;
        // FastAPI 422: detail es un array de errores de validación.
        if (Array.isArray(msg)) {
          msg = msg
            .map((d: { loc?: unknown[]; msg?: string }) => {
              const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
              return `${field ? field + ": " : ""}${d.msg ?? ""}`;
            })
            .join(" · ");
        } else if (msg && typeof msg === "object") {
          msg = JSON.stringify(msg);
        }
        throw new Error(msg || `HTTP ${res.status}`);
      }
      // 204 No Content o cuerpo vacío (ej. DELETE): no intentar parsear JSON.
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    },
    [getToken]
  );

  const get = useCallback(<T>(path: string) => request<T>(path, { method: "GET" }), [request]);
  const post = useCallback(
    <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    [request]
  );
  const patch = useCallback(
    <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    [request]
  );
  const put = useCallback(
    <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
    [request]
  );
  const del = useCallback(<T>(path: string) => request<T>(path, { method: "DELETE" }), [request]);

  return { get, post, patch, put, del };
}
