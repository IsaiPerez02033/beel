"use client";

import { useAuth } from "@/hooks/useSafeAuth";
import { useCallback, useEffect, useRef } from "react";

// Proxy interno: el browser llama a /api/backend/* (mismo origen, sin CORS).
// En local, si no hay proxy disponible, cae al backend directo.
const IS_BROWSER = typeof window !== "undefined";
const API_BASE = IS_BROWSER ? "/api/backend" : `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;

/**
 * Hook para hacer llamadas autenticadas a la API de Beel.
 * Incluye JWT de NextAuth y AbortController para cancelación.
 */
export function useApi() {
  const { getToken } = useAuth();
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const request = useCallback(
    async <T>(
      path: string,
      options: RequestInit = {}
    ): Promise<T> => {
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();

      const token = await getToken();
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        signal: controllerRef.current.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      // 204 No Content o cuerpo vacío (ej. DELETE): no intentar parsear JSON.
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    },
    [getToken]
  );

  const get = useCallback(
    <T>(path: string) => request<T>(path, { method: "GET" }),
    [request]
  );

  const post = useCallback(
    <T>(path: string, body: unknown) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body) }),
    [request]
  );

  const patch = useCallback(
    <T>(path: string, body: unknown) =>
      request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
    [request]
  );

  const del = useCallback(
    <T>(path: string) => request<T>(path, { method: "DELETE" }),
    [request]
  );

  return { get, post, patch, del };
}
