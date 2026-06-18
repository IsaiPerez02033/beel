"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useSafeAuth";

interface SSEOptions {
  onMessage?: (data: any) => void;
  onSystem?: (data: any) => void;
  onConnected?: () => void;
  onError?: (err: Event) => void;
}

/**
 * Hook para consumir el SSE de una conversación.
 * Reconecta automáticamente con exponential backoff.
 */
export function useSSE(conversationId: string | null, options: SSEOptions) {
  const { getToken } = useAuth();
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const activeRef = useRef(true);

  const connect = useCallback(async () => {
    if (!conversationId || !activeRef.current) return;

    const token = await getToken();
    if (!token) return;

    const url = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/messaging/${conversationId}/stream`;

    // EventSource no soporta headers nativamente — usamos query param como workaround
    // En producción considerar usar fetch streams o un proxy
    const es = new EventSource(`${url}?token=${token}`);
    esRef.current = es;

    es.addEventListener("connected", () => {
      retryRef.current = 0;
      options.onConnected?.();
    });

    es.addEventListener("message", (e) => {
      try {
        options.onMessage?.(JSON.parse(e.data));
      } catch {}
    });

    es.addEventListener("system", (e) => {
      try {
        options.onSystem?.(JSON.parse(e.data));
      } catch {}
    });

    es.onerror = (err) => {
      options.onError?.(err);
      es.close();
      if (!activeRef.current) return;
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
      retryRef.current++;
      setTimeout(connect, delay);
    };
  }, [conversationId, getToken]);

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      esRef.current?.close();
    };
  }, [connect]);
}
