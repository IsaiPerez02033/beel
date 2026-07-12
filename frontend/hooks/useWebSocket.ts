"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useSafeAuth";

interface WSOptions {
  onMessage?: (data: any) => void;
  onSystem?: (data: any) => void;
  onTyping?: (data: { sender_id: string; is_typing: boolean }) => void;
  onMessageDeleted?: (data: { id: string }) => void;
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
  // En segundo plano cerramos el WS a propósito: mientras esté conectado el
  // backend asume que estás viendo el chat y no manda push de esos mensajes.
  const suspendedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  // getToken puede cambiar de identidad en cada render; lo guardamos en un ref
  // para que `connect` NO se recree y evitar un bucle de reconexión constante.
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const connect = useCallback(async () => {
    if (!conversationId || !activeRef.current || suspendedRef.current) return;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const token = await getTokenRef.current();
    if (!token) {
      // Al abrir la app en frío la sesión puede no estar lista todavía:
      // reintentar en breve en lugar de rendirse (sin esto, el tiempo real
      // quedaba muerto hasta cambiar de conversación).
      if (activeRef.current && !suspendedRef.current) {
        setTimeout(connect, 1500);
      }
      return;
    }

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
        } else if (data.type === "typing") {
          optionsRef.current.onTyping?.(data);
        } else if (data.type === "message_deleted") {
          optionsRef.current.onMessageDeleted?.(data);
        }
      } catch {}
    };

    ws.onerror = (err) => {
      optionsRef.current.onError?.(err);
    };

    ws.onclose = () => {
      if (!activeRef.current || suspendedRef.current) return;
      const delay = Math.min(1000 * 2 ** retryRef.current, 30_000);
      retryRef.current++;
      setTimeout(connect, delay);
    };
  }, [conversationId]);

  useEffect(() => {
    activeRef.current = true;
    connect();
    return () => {
      activeRef.current = false;
      wsRef.current?.close();
    };
  }, [connect]);

  // Suspender el WS cuando la app pasa a segundo plano y reconectar al volver.
  // Así los mensajes que lleguen mientras no estás viendo el chat SÍ generan
  // push, y al volver la reconexión dispara onConnected → recarga de mensajes.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        suspendedRef.current = true;
        wsRef.current?.close();
        wsRef.current = null;
      } else {
        suspendedRef.current = false;
        retryRef.current = 0;
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [connect]);

  /**
   * Envía un mensaje de texto al WebSocket.
   */
  const send = useCallback((body: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "message", body }));
    }
  }, []);

  /** Notifica al otro participante que estás escribiendo (o dejaste de hacerlo). */
  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", is_typing: isTyping }));
    }
  }, []);

  return { send, sendTyping };
}
