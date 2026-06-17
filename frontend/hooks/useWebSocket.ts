"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

interface WSOptions {
  onMessage?: (data: any) => void;
  onSystem?: (data: any) => void;
  onConnected?: () => void;
  onError?: (err: Event) => void;
}

/**
 * Hook para WebSocket en tiempo real.
 * Reconecta automáticamente con exponential backoff.
 * Reemplaza useSSE: el JWT ya no viaja en query string de EventSource,
 * sino en el handshake WebSocket (un solo uso).
 */
export function useWebSocket(conversationId: string | null, options: WSOptions) {
  const { getToken } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const activeRef = useRef(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async () => {
    if (!conversationId || !activeRef.current) return;

    const token = await getToken();
    if (!token) return;

    const baseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/^http/, "ws");
    const url = `${baseUrl}/api/v1/messaging/${conversationId}/ws?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
      optionsRef.current.onConnected?.();
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "message") {
          optionsRef.current.onMessage?.(data);
        } else if (data.type === "system") {
          optionsRef.current.onSystem?.(data);
        }
      } catch {}
    };

    ws.onerror = (err) => {
      optionsRef.current.onError?.(err);
    };

    ws.onclose = () => {
      if (!activeRef.current) return;
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
      wsRef.current?.close();
    };
  }, [connect]);

  /**
   * Envía un mensaje de texto al WebSocket.
   */
  const send = useCallback((body: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", body }));
    }
  }, []);

  return { send };
}
