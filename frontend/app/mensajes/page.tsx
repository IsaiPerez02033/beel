"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";
import {
  Send,
  ArrowLeft,
  Search,
  Info,
  X,
  CheckCircle2,
  Check,
  CheckCheck,
  MessageSquare,
  Calendar,
  Users,
  CreditCard,
  ExternalLink,
  CornerUpLeft,
  Paperclip,
  Loader2,
} from "lucide-react";
import MessageReactions from "@/components/MessageReactions";
import ReportButton from "@/components/ReportButton";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";

interface Participant {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface Conversation {
  id: string;
  guest_id: string;
  host_id: string;
  last_message_at?: string;
  last_message_preview?: string;
  unread_count_guest: number;
  unread_count_host: number;
  guest: Participant;
  host: Participant;
  reservation_id?: string;
}

interface ReplyPreview {
  id: string;
  sender_id: string;
  content?: string;
  sender_name?: string;
}

interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

interface Message {
  id: string;
  sender_id: string;
  body?: string;
  content?: string;
  message_type: string;
  created_at: string;
  is_read?: boolean;
  read_at?: string | null;
  sender?: Participant;
  reactions?: Reaction[];
  reply_to_id?: string;
  reply_to?: ReplyPreview;
  metadata?: { image_url?: string; storage_key?: string } | null;
  /** Solo cliente: mensaje optimista aún no confirmado por el servidor. */
  pending?: boolean;
}

interface PropertyPhoto {
  url: string;
  is_primary: boolean;
}

interface PropertySnapshot {
  id: string;
  title: string;
  city: string;
  neighborhood?: string;
  photos: PropertyPhoto[];
}

interface ReservationDetails {
  id: string;
  property_id: string;
  guest_id: string;
  host_id: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  nights: number;
  price_per_night_snapshot: number;
  cleaning_fee_snapshot: number;
  security_deposit_snapshot: number;
  platform_fee_snapshot: number;
  total_amount: number;
  currency: string;
  status: string;
  reservation_property?: PropertySnapshot;
  guest?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    is_identity_verified?: boolean;
    is_phone_verified?: boolean;
  };
  host?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    is_identity_verified?: boolean;
    is_phone_verified?: boolean;
  };
}

export default function MensajesPage() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { get, post, del } = useApi();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    searchParams.get("conv")
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localUserId, setLocalUserId] = useState<string>("");
  const [otherTyping, setOtherTyping] = useState(false);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef(false);
  const typingStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Carga inicial de mensajes de la conversación activa (spinner en vez de
  // pantalla vacía al abrir desde una notificación con la app en frío).
  const [messagesLoading, setMessagesLoading] = useState(false);
  const loadedConvRef = useRef<string | null>(null);

  // Visor de fotos a pantalla completa (tipo WhatsApp)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  
  // Sidebar de reservación
  // El panel de detalles de reserva inicia cerrado; se abre con el botón ⓘ.
  const [showInfoSidebar, setShowInfoSidebar] = useState(false);
  const [reservationDetails, setReservationDetails] = useState<ReservationDetails | null>(null);
  const [loadingReservation, setLoadingReservation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Control de scroll: distinguir "abrí la conversación" de "llegó mensaje nuevo".
  const scrollConvRef = useRef<string | null>(null);
  const prevMsgCountRef = useRef(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  // Envío de fotos en el chat
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref a la función que recarga los mensajes (para llamarla desde el WS sin
  // recrear el handler en cada render).
  const reloadMessagesRef = useRef<(() => void) | null>(null);

  const activeConv = conversations.find(
    (c) => c.id === activeConvId || c.reservation_id === activeConvId
  );

  // Sincronizar el estado del chat activo con los parámetros de la URL
  const convParam = searchParams.get("conv");
  useEffect(() => {
    setActiveConvId(convParam);
  }, [convParam]);

  // Normalizar el ID activo al ID de la conversación si coincidió por ID de reserva
  useEffect(() => {
    if (activeConv && activeConv.id !== activeConvId) {
      setActiveConvId(activeConv.id);
    }
  }, [activeConv, activeConvId]);

  // Obtener ID del usuario local
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      // Al abrir la PWA en frío (p. ej. tocando una notificación) la sesión
      // puede reportarse vacía un instante. Confirmar contra el servidor antes
      // de mandar a login, y conservar el destino para volver tras entrar.
      let cancelled = false;
      (async () => {
        try {
          const { getSession } = await import("next-auth/react");
          const session = await getSession();
          if (cancelled || session) return; // sí hay sesión: el provider se actualiza solo
        } catch {}
        if (!cancelled) {
          const dest = window.location.pathname + window.location.search;
          router.push(`/iniciar-sesion?callbackUrl=${encodeURIComponent(dest)}`);
        }
      })();
      return () => { cancelled = true; };
    }
    get<{ id: string }>("/users/me")
      .then((d) => setLocalUserId(d.id))
      .catch(console.error);
  }, [isSignedIn, isLoaded, get, router]);

  // Cargar lista de conversaciones
  useEffect(() => {
    if (!isSignedIn) return;
    get<{ conversations: Conversation[] }>("/messaging")
      .then((d) => setConversations(d.conversations))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isSignedIn, get]);

  // Recarga los mensajes de la conversación activa. El GET también marca como
  // leídos en el backend (mensajes y sus notificaciones), así que tras llamarlo
  // avisamos para que el badge global se refresque.
  const reloadMessages = useCallback(() => {
    if (!activeConvId) return;
    // Primer intento de esta conversación: mostrar indicador de carga.
    setMessagesLoading((prev) => prev || loadedConvRef.current !== activeConvId);
    get<{ messages: Message[] }>(`/messaging/${activeConvId}/messages`)
      .then((d) => {
        loadedConvRef.current = activeConvId;
        setMessagesLoading(false);
        // Conservar burbujas optimistas aún en vuelo (el POST las resolverá).
        // Y si nada cambió, conservar el array anterior: evita re-render y el
        // auto-scroll que se sentía como pantalla trabada durante el sondeo.
        setMessages((prev) => {
          const temps = prev.filter((m) => m.pending);
          const next = temps.length ? [...d.messages, ...temps] : d.messages;
          const sig = (list: Message[]) =>
            list
              .map((m) => `${m.id}:${m.is_read || m.read_at ? 1 : 0}:${(m.reactions ?? []).length}`)
              .join("|");
          return sig(prev) === sig(next) ? prev : next;
        });
        // Sincronizar la lista lateral: sin no-leídos y con el preview del
        // último mensaje real (los mensajes que llegan por este sondeo, y no
        // por WS, dejaban un preview viejo en la lista).
        const last = d.messages[d.messages.length - 1];
        const lastPreview = !last
          ? null
          : last.message_type === "image"
            ? "📷 Foto"
            : (last.content ?? last.body ?? "");
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConvId || c.reservation_id === activeConvId
              ? {
                  ...c,
                  unread_count_guest: 0,
                  unread_count_host: 0,
                  ...(lastPreview !== null
                    ? {
                        last_message_preview: lastPreview,
                        last_message_at: last.created_at ?? c.last_message_at,
                      }
                    : {}),
                }
              : c
          )
        );
        // Refrescar el badge de notificaciones (campana / tab Mensajes).
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("beel:badges"));
        }
      })
      .catch(console.error);
  }, [activeConvId, get]);

  reloadMessagesRef.current = reloadMessages;

  // Refleja el último mensaje en la lista lateral al instante (al enviar o
  // recibir), para que al regresar con la flecha no se vea un preview viejo.
  const bumpConversationPreview = useCallback((convId: string, preview: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId || c.reservation_id === convId
          ? { ...c, last_message_preview: preview, last_message_at: new Date().toISOString() }
          : c
      )
    );
  }, []);

  // Cargar mensajes al seleccionar conversación. También se re-dispara cuando
  // la sesión termina de cargar (isSignedIn / get cambian): al abrir la PWA en
  // frío desde una notificación, el primer intento salía sin token y fallaba,
  // dejando el chat vacío hasta el siguiente sondeo.
  useEffect(() => {
    if (!activeConvId || !isSignedIn) return;
    // Al cambiar de conversación, no mostrar mensajes de la anterior.
    if (loadedConvRef.current !== activeConvId) setMessages([]);
    reloadMessages();
    // Si no tenemos esta conversación en la lista lateral, recargar la lista.
    const exists = conversations.some(c => c.id === activeConvId || c.reservation_id === activeConvId);
    if (!exists) {
      get<{ conversations: Conversation[] }>("/messaging")
        .then((res) => setConversations(res.conversations))
        .catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId, isSignedIn, reloadMessages]);

  // Fallback de tiempo real: recargar al volver el foco / visibilidad y con un
  // sondeo suave, por si el WebSocket perdió mensajes mientras estuvo caído.
  useEffect(() => {
    if (!activeConvId) return;
    const onFocus = () => reloadMessages();
    const onVisible = () => { if (document.visibilityState === "visible") reloadMessages(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(reloadMessages, 8000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(poll);
    };
  }, [activeConvId, reloadMessages]);

  // Cargar detalles de la reservación correspondiente al chat activo
  useEffect(() => {
    if (!activeConv?.reservation_id) {
      setReservationDetails(null);
      return;
    }
    setLoadingReservation(true);
    get<ReservationDetails>(`/reservations/${activeConv.reservation_id}`)
      .then((d) => setReservationDetails(d))
      .catch((e) => {
        console.error("Error loading reservation details:", e);
        setReservationDetails(null);
      })
      .finally(() => setLoadingReservation(false));
  }, [activeConv?.reservation_id, get]);

  // WebSocket: recibir mensajes en tiempo real
  const { send: wsSend, sendTyping } = useWebSocket(activeConvId, {
    onTyping: (data) => {
      if (data.sender_id === localUserId) return;
      setOtherTyping(data.is_typing);
      if (typingClearRef.current) clearTimeout(typingClearRef.current);
      if (data.is_typing) {
        typingClearRef.current = setTimeout(() => setOtherTyping(false), 4000);
      }
    },
    onMessage: (data) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [
          ...prev,
          {
            id: data.id,
            sender_id: data.sender_id,
            body: data.body,
            message_type: data.message_type ?? "text",
            created_at: data.created_at,
            sender: { id: data.sender_id, full_name: data.sender_name },
            reply_to: data.reply_to ?? undefined,
            reply_to_id: data.reply_to?.id,
            metadata: data.metadata ?? undefined,
          },
        ];
      });
      if (activeConvId) {
        bumpConversationPreview(
          activeConvId,
          data.message_type === "image" ? "📷 Foto" : (data.body ?? "")
        );
      }
    },
    onConnected: () => {
      // Al (re)conectar el WS pueden haberse perdido mensajes mientras estuvo
      // caído (p. ej. la app estuvo en segundo plano). Recargamos para recuperar.
      reloadMessagesRef.current?.();
    },
  });

  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setHasNewMessages(false);
    }
  };

  // Auto-scroll: al abrir/cargar la conversación salta al fondo SIN marcar
  // "nuevos"; solo marca "nuevos" cuando llega un mensaje de verdad (crece el
  // conteo) estando la conversación ya abierta.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || messages.length === 0) return;

    // Al (re)abrir la conversación: salto instantáneo al fondo, SIN banner.
    // Doble pasada (ahora + próximo frame) por si el layout aún se acomoda.
    if (scrollConvRef.current !== activeConvId) {
      scrollConvRef.current = activeConvId;
      prevMsgCountRef.current = messages.length;
      messagesEndRef.current?.scrollIntoView({ block: "end" });
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ block: "end" });
      });
      setHasNewMessages(false);
      return;
    }

    const prevCount = prevMsgCountRef.current;
    prevMsgCountRef.current = messages.length;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 250;

    // No creció el conteo (p. ej. cambió "escribiendo…"): no tocar el scroll.
    // (Antes hacía scroll suave aquí y peleaba con el dedo del usuario.)
    if (messages.length <= prevCount) {
      return;
    }

    // Llegó un mensaje nuevo de verdad. Salto instantáneo: el scroll suave se
    // re-disparaba en cada render y dejaba la pantalla "trabada" un momento.
    const lastMessage = messages[messages.length - 1];
    if (nearBottom || (lastMessage && lastMessage.sender_id === localUserId)) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
      setHasNewMessages(false);
    } else {
      setHasNewMessages(true);
    }
  }, [messages, otherTyping, localUserId, activeConvId]);

  // Limpiar indicador "escribiendo" al cambiar de conversación.
  useEffect(() => {
    setOtherTyping(false);
    typingSentRef.current = false;
  }, [activeConvId]);

  // Notifica "escribiendo…" (throttle + auto-stop tras pausa)
  function notifyTyping() {
    if (!typingSentRef.current) {
      typingSentRef.current = true;
      sendTyping(true);
    }
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    typingStopRef.current = setTimeout(() => {
      typingSentRef.current = false;
      sendTyping(false);
    }, 2500);
  }

  function stopTyping() {
    if (typingStopRef.current) clearTimeout(typingStopRef.current);
    if (typingSentRef.current) {
      typingSentRef.current = false;
      sendTyping(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !activeConvId || sending) return;

    setSending(true);
    setInput("");
    stopTyping();
    const replyId = replyingTo?.id ?? null;
    const replySnapshot = replyingTo;
    setReplyingTo(null);

    // Burbuja optimista: aparece al instante con una sola palomita (enviando).
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_id: localUserId,
        body: text,
        content: text,
        message_type: "text",
        created_at: new Date().toISOString(),
        pending: true,
        reply_to_id: replyId ?? undefined,
        reply_to: replySnapshot
          ? {
              id: replySnapshot.id,
              sender_id: replySnapshot.sender_id,
              content: replySnapshot.content ?? replySnapshot.body,
              sender_name: replySnapshot.sender?.full_name,
            }
          : undefined,
      } as Message,
    ]);
    bumpConversationPreview(activeConvId, text);

    try {
      const msg = await post<Message>(`/messaging/${activeConvId}/messages`, {
        body: text,
        ...(replyId ? { reply_to_id: replyId } : {}),
      });
      // Quitar la burbuja optimista y quedarnos con la versión del servidor.
      // El broadcast del WS puede haber insertado este mismo mensaje antes de
      // que el POST resuelva, pero SIN el detalle completo: reemplazar por id.
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const idx = withoutTemp.findIndex((m) => m.id === msg.id);
        if (idx >= 0) {
          const copy = [...withoutTemp];
          copy[idx] = msg;
          return copy;
        }
        return [...withoutTemp, msg];
      });
    } catch (e) {
      console.error(e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
      if (replyId) setReplyingTo(replySnapshot);
    } finally {
      setSending(false);
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!activeConvId || uploadingPhoto) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setPhotoError("Formato no válido. Usa JPEG, PNG o WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("La imagen no debe superar 10 MB.");
      return;
    }
    setPhotoError("");
    setUploadingPhoto(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/backend/messaging/${activeConvId}/photos`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error al subir la foto" }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      const msg: Message = await res.json();
      bumpConversationPreview(activeConvId, "📷 Foto");
      // El WS puede haberlo insertado ya (sin metadata completa): reemplazar por id.
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = msg;
          return copy;
        }
        return [...prev, msg];
      });
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "No se pudo enviar la foto.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleReaction(messageId: string, emoji: string, hasReacted: boolean) {
    if (!activeConvId) return;
    try {
      let updatedMsg: Message;
      if (hasReacted) {
        updatedMsg = await del<Message>(`/messaging/${activeConvId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
      } else {
        updatedMsg = await post<Message>(`/messaging/${activeConvId}/messages/${messageId}/reactions`, { emoji });
      }
      if (updatedMsg?.reactions !== undefined) {
        setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions: updatedMsg.reactions } : m));
      }
    } catch (e) {
      console.error("Reaction error:", e);
    }
  }

  function scrollToMessage(id: string) {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Flash highlight
    el.classList.add("bg-yellow-50");
    setTimeout(() => el.classList.remove("bg-yellow-50"), 1200);
  }

  // Filtrar las conversaciones locales por búsqueda y por no leídos
  const filteredConversations = conversations.filter((c) => {
    const other = c.guest_id === localUserId ? c.host : c.guest;
    const nameMatches = other?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const previewMatches = c.last_message_preview?.toLowerCase().includes(searchQuery.toLowerCase());
    const match = nameMatches || previewMatches;

    if (filterUnread) {
      const isGuest = c.guest_id === localUserId;
      const unread = isGuest ? c.unread_count_guest : c.unread_count_host;
      return match && unread > 0;
    }
    return match;
  });

  const otherParticipant = activeConv
    ? (activeConv.guest_id === localUserId ? activeConv.host : activeConv.guest)
    : null;

  const isLocalUserGuest = activeConv ? activeConv.guest_id === localUserId : false;

  function formatCurrency(val: number | string, curr: string = "MXN") {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: curr || "MXN"
    }).format(num);
  }

  function formatDateRange(startStr: string, endStr: string) {
    if (!startStr || !endStr) return "";
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    const startFormat = format(start, "d 'de' MMM", { locale: es });
    const endFormat = format(end, "d 'de' MMM 'de' yyyy", { locale: es });
    return `${startFormat} al ${endFormat}`;
  }

  // Renderizador agrupado de mensajes por fecha
  const renderMessages = () => {
    let lastDateStr = "";
    const memberNames: Record<string, string> = {};
    if (localUserId) memberNames[localUserId] = "Tú";
    if (activeConv) {
      memberNames[activeConv.guest.id] = activeConv.guest.id === localUserId ? "Tú" : activeConv.guest.full_name;
      memberNames[activeConv.host.id] = activeConv.host.id === localUserId ? "Tú" : activeConv.host.full_name;
    }

    return messages.map((msg) => {
      const msgDate = parseISO(msg.created_at);
      const dateStr = isToday(msgDate)
        ? "Hoy"
        : isYesterday(msgDate)
          ? "Ayer"
          : format(msgDate, "d 'de' MMMM", { locale: es });
      let dateSeparator = null;
      if (dateStr !== lastDateStr) {
        lastDateStr = dateStr;
        dateSeparator = (
          <div key={`date-${msg.id}`} className="flex justify-center my-6">
            <span className="text-[11px] font-semibold text-[var(--text-tertiary)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-3 py-1 rounded-full uppercase tracking-wider">
              {dateStr}
            </span>
          </div>
        );
      }

      const isMine = msg.sender_id === localUserId;

      return (
        <div key={msg.id} ref={(el) => { messageRefs.current[msg.id] = el; }}>
          {dateSeparator}
          {msg.message_type === "system" ? (
            <div className="flex justify-center my-5">
              <span className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]/50 px-4 py-2 rounded-xl max-w-md text-center shadow-sm font-medium">
                {msg.content ?? msg.body}
              </span>
            </div>
          ) : (
            <SwipeableMessage
              msg={msg}
              isMine={isMine}
              otherParticipant={otherParticipant}
              msgDate={msgDate}
              onReply={() => setReplyingTo(msg)}
              onScrollToReply={scrollToMessage}
              currentUserId={localUserId}
              conversationId={activeConvId!}
              onReact={handleReaction}
              memberNames={memberNames}
              onOpenImage={setLightboxUrl}
            />
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-dvh bg-[var(--bg-elevated)] flex flex-col overflow-hidden" style={{ touchAction: "pan-y" }}>
      <Navbar />

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── COLUMNA 1: Lista de conversaciones (Airbnb-style) ── */}
        <aside
          className={cn(
            "w-full md:w-[350px] lg:w-[380px] border-r border-[var(--border-subtle)] flex flex-col bg-[var(--bg-elevated)] flex-shrink-0 z-30 transition-transform duration-300",
            activeConvId ? "hidden md:flex" : "flex"
          )}
        >
          {/* Header lateral con buscador y filtros */}
          <div className="p-5 border-b border-[var(--border-subtle)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold font-display text-[var(--text-primary)]">Mensajes</h1>
            </div>
            
            {/* Buscador */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
                <Search size={16} />
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o contenido..."
                className="w-full pl-10 pr-4 py-2 rounded-full border border-[var(--border-subtle)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] placeholder-neutral-400 bg-[var(--bg-subtle)]"
              />
            </div>

            {/* Filtros rápidos */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterUnread(false)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  !filterUnread
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterUnread(true)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  filterUnread
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-default)]"
                )}
              >
                Sin leer
              </button>
            </div>
          </div>

          {/* Listado de chats */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="p-5 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-12 h-12 bg-[var(--bg-arena)] rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2 mt-1">
                      <div className="h-3 bg-[var(--bg-arena)] w-1/3 rounded" />
                      <div className="h-2.5 bg-[var(--bg-arena)] w-full rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-16 h-16 bg-[var(--bg-subtle)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--text-tertiary)]">
                  <MessageSquare size={24} />
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Aún no tienes mensajes</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-[200px] mx-auto">
                  Cuando hagas o recibas una reserva, las conversaciones aparecerán aquí.
                </p>
              </div>
            ) : (
              filteredConversations.map((c) => (
                <ConversationItem
                  key={c.id}
                  conv={c}
                  active={c.id === activeConvId}
                  currentUserId={localUserId}
                  onClick={() => setActiveConvId(c.id)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ── COLUMNA 2: Chat Activo ── */}
        <main className={cn("flex-1 flex flex-col bg-[var(--bg-elevated)] overflow-hidden relative", !activeConvId ? "hidden md:flex" : "flex")}>
          {activeConvId && activeConv ? (
            <>
              {/* Header del Chat */}
              <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-elevated)] z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (showInfoSidebar) {
                        setShowInfoSidebar(false);
                      } else {
                        setActiveConvId(null);
                      }
                    }}
                    aria-label="Volver a conversaciones"
                    className="md:hidden p-2 rounded-full hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="relative">
                    {otherParticipant?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={otherParticipant.avatar_url}
                        alt={otherParticipant.full_name}
                        className="w-10 h-10 rounded-full object-cover border border-[var(--border-subtle)] shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-900 text-white font-semibold text-sm flex items-center justify-center shadow-sm">
                        {otherParticipant?.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">
                        {otherParticipant?.full_name}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--text-tertiary)] font-medium">
                      {isLocalUserGuest ? "Anfitrión de Beel" : "Huésped"}
                    </span>
                  </div>
                </div>

                {/* Botón Info Reservación */}
                <button
                  onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                  aria-label="Detalles de la reserva"
                  className={cn(
                    "p-2 rounded-full border transition-all text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
                    showInfoSidebar ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)]" : "border-[var(--border-subtle)]"
                  )}
                  title="Detalles de la reserva"
                >
                  <Info size={18} />
                </button>
              </div>

              {/* Contenedor de Mensajes */}
              <div 
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 bg-[var(--bg-elevated)] relative"
              >
                {messagesLoading && messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 size={26} className="animate-spin text-[var(--text-tertiary)]" />
                  </div>
                ) : (
                  renderMessages()
                )}
                {otherTyping && (
                  <div className="flex items-center gap-1.5 mt-2 ml-1">
                    <span className="flex gap-1 bg-[var(--bg-subtle)] rounded-2xl rounded-tl-none px-3 py-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
                {hasNewMessages && (
                  <button
                    onClick={() => {
                      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
                      setHasNewMessages(false);
                    }}
                    className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--color-primary)] text-white font-medium text-body-sm shadow-lg hover:scale-105 active:scale-95 transition-transform animate-bounce"
                  >
                    <span>Nuevos mensajes ↓</span>
                  </button>
                )}
              </div>

              {/* Barra de reply */}
              {replyingTo && (
                <div className="px-3 sm:px-5 pt-2 pb-0 flex-shrink-0 flex items-center gap-2 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)]">
                  <div className="flex-1 border-l-4 border-[var(--color-primary)] pl-3 py-1.5 bg-[var(--bg-subtle)] rounded-r-lg min-w-0">
                    <p className="text-[11px] font-semibold text-[var(--color-primary)] truncate">
                      {replyingTo.sender_id === localUserId ? "Tú" : (replyingTo.sender?.full_name ?? "Usuario")}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {replyingTo.message_type === "image" ? "📷 Foto" : (replyingTo.content ?? replyingTo.body)}
                    </p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="flex-shrink-0 p-2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] active:scale-95">
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Caja de Input */}
              <div className="px-3 sm:px-5 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex-shrink-0 safe-area-bottom">
                {photoError && (
                  <p className="text-caption text-red-500 text-center mb-2">{photoError}</p>
                )}
                <div className="relative border border-[var(--border-subtle)] focus-within:border-[var(--color-primary)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] rounded-3xl py-2 pl-2 pr-2 transition-all bg-[var(--bg-subtle)] max-w-3xl mx-auto flex items-center gap-1 shadow-sm">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handlePhotoUpload(f);
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto || sending}
                    aria-label="Enviar foto"
                    title="Enviar foto"
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--bg-elevated)] active:scale-95 transition-all disabled:opacity-40"
                  >
                    {uploadingPhoto
                      ? <Loader2 size={18} className="animate-spin text-[var(--color-primary)]" />
                      : <Paperclip size={18} />}
                  </button>
                  <textarea
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      if (e.target.value.trim()) notifyTyping();
                      // Auto-resize
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onBlur={stopTyping}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    style={{ border: "none", outline: "none", background: "transparent", boxShadow: "none", fontSize: "16px" }}
                    className="w-full resize-none outline-none border-none placeholder-neutral-400 bg-transparent text-[var(--text-primary)] py-1 max-h-[120px] focus:ring-0 leading-relaxed"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    aria-label="Enviar mensaje"
                    className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-dark)] active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 disabled:pointer-events-none shadow-sm"
                  >
                    <Send size={16} className="text-white -mr-[1px] -mt-[1px]" strokeWidth={2.5} />
                  </button>
                </div>
                {/* Hint solo en desktop */}
                <p className="hidden sm:block text-[10px] text-[var(--text-tertiary)] text-center mt-2">
                  Presiona Enter para enviar. Shift + Enter para salto de línea.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[var(--bg-subtle)]/50">
              <div className="w-20 h-20 bg-[var(--bg-elevated)] rounded-3xl flex items-center justify-center shadow-md border border-[var(--border-subtle)] text-[var(--text-tertiary)] mb-4 animate-bounce">
                <MessageSquare size={32} />
              </div>
              <p className="text-base font-semibold text-[var(--text-primary)]">Selecciona una conversación</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-[240px] text-center">
                Elige uno de tus chats de la izquierda para comenzar a hablar con el huésped o anfitrión.
              </p>
            </div>
          )}
        </main>

        {/* ── COLUMNA 3: Detalles de Reserva ── */}
        {/* En móvil: drawer desde abajo. En desktop: columna lateral fija. */}
        {activeConvId && activeConv && showInfoSidebar && (
          <>
            {/* Overlay oscuro solo en móvil */}
            <div
              className="fixed inset-0 bg-black/40 z-30 lg:hidden"
              onClick={() => setShowInfoSidebar(false)}
            />
          <aside
            className={cn(
              "fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-elevated)] rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto",
              "lg:static lg:rounded-none lg:shadow-none lg:max-h-none lg:w-[320px] xl:w-[360px] lg:flex-shrink-0 lg:border-l lg:border-[var(--border-subtle)] lg:flex lg:flex-col lg:overflow-y-auto",
              "transition-transform duration-300"
            )}
          >
            {/* Header del sidebar */}
            <div className="p-5 border-b border-[var(--border-subtle)] flex items-center justify-between flex-shrink-0 bg-[var(--bg-elevated)] sticky top-0 z-10">
              <h2 className="text-md font-bold text-[var(--text-primary)]">Detalles de reservación</h2>
              <button
                onClick={() => setShowInfoSidebar(false)}
                className="p-1.5 rounded-full hover:bg-[var(--bg-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {loadingReservation ? (
              <div className="p-5 space-y-5 animate-pulse">
                <div className="w-full aspect-[16/10] bg-[var(--bg-arena)] rounded-2xl" />
                <div className="h-4 bg-[var(--bg-arena)] w-2/3 rounded" />
                <div className="h-3 bg-[var(--bg-arena)] w-1/2 rounded" />
                <div className="space-y-2 pt-4">
                  <div className="h-3 bg-[var(--bg-arena)] w-full rounded" />
                  <div className="h-3 bg-[var(--bg-arena)] w-full rounded" />
                </div>
              </div>
            ) : reservationDetails ? (
              <div className="p-5 space-y-6 flex-1 pb-16">
                {/* Mini Tarjeta Propiedad */}
                <div className="space-y-3">
                  <div className="relative w-full aspect-[16/10] bg-[var(--bg-subtle)] rounded-2xl overflow-hidden shadow-sm border border-[var(--border-subtle)]">
                    {reservationDetails.reservation_property?.photos?.find(p => p.is_primary)?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={reservationDetails.reservation_property.photos.find(p => p.is_primary)!.url}
                        alt={reservationDetails.reservation_property.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[var(--bg-subtle)] text-[var(--text-disabled)]">
                        No hay foto
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                      {reservationDetails.reservation_property?.title}
                    </h3>
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {reservationDetails.reservation_property?.city}
                    </p>
                  </div>
                  <Link
                    href={`/reservaciones/${reservationDetails.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] hover:underline pt-1"
                  >
                    Detalles de reserva <ExternalLink size={12} />
                  </Link>
                </div>

                <hr className="border-[var(--border-subtle)]" />

                {/* Perfil del otro participante */}
                <div className="flex items-center gap-3 bg-[var(--bg-subtle)] p-4 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
                  {otherParticipant?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={otherParticipant.avatar_url}
                      alt={otherParticipant.full_name}
                      className="w-12 h-12 rounded-full object-cover border border-[var(--border-subtle)]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-neutral-900 text-white font-semibold text-sm flex items-center justify-center">
                      {otherParticipant?.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--text-tertiary)] font-medium uppercase tracking-wider">
                      {isLocalUserGuest ? "Tu Anfitrión" : "Tu Huésped"}
                    </p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {otherParticipant?.full_name}
                    </p>
                    <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium mt-0.5">
                      <CheckCircle2 size={13} strokeWidth={2.5} />
                      <span>Verificado</span>
                    </div>
                  </div>
                </div>

                <hr className="border-[var(--border-subtle)]" />

                {/* Fechas e Información del Viaje */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest text-[var(--text-tertiary)]">Información del viaje</h4>
                  
                  <div className="flex items-start gap-3">
                    <Calendar size={16} className="text-[var(--text-tertiary)] mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">Fechas</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {formatDateRange(reservationDetails.check_in, reservationDetails.check_out)}
                      </p>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                        ({reservationDetails.nights} {reservationDetails.nights === 1 ? "noche" : "noches"})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Users size={16} className="text-[var(--text-tertiary)] mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">Huéspedes</p>
                      <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                        {reservationDetails.guests_count} {reservationDetails.guests_count === 1 ? "huésped" : "huéspedes"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CreditCard size={16} className="text-[var(--text-tertiary)] mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[var(--text-secondary)]">Estado de reserva</p>
                      <span className={cn(
                        "inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider mt-1",
                        reservationDetails.status === "confirmed" && "bg-emerald-100 text-emerald-800 border border-emerald-200",
                        reservationDetails.status === "pending" && "bg-amber-100 text-amber-800 border border-amber-200",
                        (reservationDetails.status === "rejected" || reservationDetails.status === "cancelled") && "bg-rose-100 text-rose-800 border border-rose-200"
                      )}>
                        {reservationDetails.status === "confirmed" ? "Confirmada" : reservationDetails.status === "pending" ? "Pendiente" : "Cancelada"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline de la Reserva (Estilo Airbnb) */}
                <div className="mt-2 p-4 bg-[var(--bg-subtle)] rounded-2xl border border-[var(--border-subtle)]">
                  <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Progreso del viaje</p>
                  <div className="relative pl-6 space-y-6">
                    {/* Línea vertical conectora */}
                    <div className="absolute left-2.5 top-1.5 bottom-1.5 w-0.5 bg-[var(--border-default)]" />

                    {/* Paso 1: Solicitud recibida */}
                    <div className="relative">
                      <div className="absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm flex items-center justify-center" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">Solicitud enviada</p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">Petición registrada con éxito</p>
                      </div>
                    </div>

                    {/* Paso 2: Aprobada/Confirmada */}
                    <div className="relative">
                      <div className={cn(
                        "absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm",
                        (reservationDetails.status === "confirmed" || reservationDetails.status === "completed")
                          ? "bg-emerald-500"
                          : (reservationDetails.status === "cancelled" || reservationDetails.status === "rejected")
                          ? "bg-rose-500"
                          : "bg-[var(--border-default)]"
                      )} />
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {reservationDetails.status === "cancelled" || reservationDetails.status === "rejected" ? "Cancelada / Rechazada" : "Aprobación del anfitrión"}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">
                          {reservationDetails.status === "confirmed" || reservationDetails.status === "completed"
                            ? "El anfitrión aprobó tu estancia"
                            : reservationDetails.status === "cancelled" || reservationDetails.status === "rejected"
                            ? "Reserva declinada o cancelada"
                            : "Esperando respuesta del anfitrión"}
                        </p>
                      </div>
                    </div>

                    {/* Paso 3: Completada */}
                    {reservationDetails.status !== "cancelled" && reservationDetails.status !== "rejected" && (
                      <div className="relative">
                        <div className={cn(
                          "absolute -left-[21px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm",
                          reservationDetails.status === "completed" ? "bg-emerald-500" : "bg-[var(--border-default)]"
                        )} />
                        <div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">Viaje completado</p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">
                            {reservationDetails.status === "completed" ? "¡Gracias por hospedarte!" : "Check-out y fin del viaje"}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Desglose de Pago (solo visible si el usuario logueado es el HUESPED para privacidad de datos) */}
                {isLocalUserGuest && (
                  <>
                    <hr className="border-[var(--border-subtle)]" />
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-widest text-[var(--text-tertiary)]">Información de pago</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                          <span>
                            {formatCurrency(reservationDetails.price_per_night_snapshot, reservationDetails.currency)} x {reservationDetails.nights} noches
                          </span>
                          <span>
                            {formatCurrency(reservationDetails.price_per_night_snapshot * reservationDetails.nights, reservationDetails.currency)}
                          </span>
                        </div>
                        {parseFloat(reservationDetails.cleaning_fee_snapshot.toString()) > 0 && (
                          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                            <span>Tarifa de limpieza</span>
                            <span>{formatCurrency(reservationDetails.cleaning_fee_snapshot, reservationDetails.currency)}</span>
                          </div>
                        )}
                        {parseFloat(reservationDetails.platform_fee_snapshot.toString()) > 0 && (
                          <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
                            <span>Tarifa de plataforma</span>
                            <span>{formatCurrency(reservationDetails.platform_fee_snapshot, reservationDetails.currency)}</span>
                          </div>
                        )}
                        
                        <div className="border-t border-[var(--border-subtle)] pt-2 flex items-center justify-between text-sm font-bold text-[var(--text-primary)]">
                          <span>Total ({reservationDetails.currency})</span>
                          <span>{formatCurrency(reservationDetails.total_amount, reservationDetails.currency)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="p-5 text-center text-xs text-[var(--text-tertiary)]">
                No hay información de reserva vinculada a esta conversación.
              </div>
            )}

            {/* Reportar usuario */}
            <div className="p-5 border-t border-[var(--border-subtle)] flex justify-center">
              <ReportButton
                targetType="user"
                targetTitle={otherParticipant?.full_name}
                label="Reportar a este usuario"
              />
            </div>
          </aside>
          </>
        )}
      </div>

      {/* Visor de foto a pantalla completa (tipo WhatsApp/Instagram) */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fade-in"
          onClick={() => setLightboxUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            onClick={() => setLightboxUrl(null)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Foto"
            className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ── Componente SwipeableMessage ───────────────────────────────────────────────

function SwipeableMessage({
  msg,
  isMine,
  otherParticipant,
  msgDate,
  onReply,
  onScrollToReply,
  currentUserId,
  conversationId,
  onReact,
  memberNames,
  onOpenImage,
}: {
  msg: Message;
  isMine: boolean;
  otherParticipant: { full_name: string; avatar_url?: string } | null;
  msgDate: Date;
  onReply: () => void;
  onScrollToReply: (id: string) => void;
  currentUserId: string;
  conversationId: string;
  onReact: (messageId: string, emoji: string, hasReacted: boolean) => void;
  memberNames: Record<string, string>;
  onOpenImage: (url: string) => void;
}) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const triggered = useRef(false);
  const lastTapRef = useRef(0);
  const THRESHOLD = 60;

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    triggered.current = false;
    setSwiping(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    // Si el gesto es más vertical que horizontal, cancelar swipe
    if (dy > Math.abs(dx) * 1.5) { setSwiping(false); setSwipeX(0); return; }
    // Solo swipe hacia la derecha para responder
    if (dx > 0 && dx < THRESHOLD + 20) setSwipeX(dx);
    if (dx >= THRESHOLD && !triggered.current) {
      triggered.current = true;
      // Vibración táctil en móvil si está disponible
      if (navigator.vibrate) navigator.vibrate(30);
    }
  }

  function onTouchEnd() {
    if (triggered.current) {
      onReply();
    } else if (swipeX < 8) {
      // Doble tap = ❤️ (estilo Instagram). Solo en toques sin arrastre.
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        const heart = (msg.reactions ?? []).find((r) => r.emoji === "❤️");
        const hasHeart = heart?.user_ids.includes(currentUserId) ?? false;
        onReact(msg.id, "❤️", hasHeart);
        if (navigator.vibrate) navigator.vibrate(20);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
    setSwipeX(0);
    setSwiping(false);
  }

  const progress = Math.min(swipeX / THRESHOLD, 1);

  return (
    <div
      className={cn("flex my-3 group", isMine ? "justify-end" : "justify-start")}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: swiping ? "none" : "pan-y" }}
    >
      {/* Icono de reply que aparece al swipear (izquierda del mensaje) */}
      {!isMine && (
        <div
          className="flex items-center justify-center w-8 mr-1 transition-opacity"
          style={{ opacity: progress, transform: `scale(${0.6 + 0.4 * progress})` }}
        >
          <CornerUpLeft size={18} className="text-[var(--color-primary)]" />
        </div>
      )}

      {/* Acciones al hover (estilo Instagram) — a la izquierda de mis burbujas */}
      {isMine && (
        <MessageReactions
          messageId={msg.id}
          conversationId={conversationId}
          reactions={msg.reactions ?? []}
          currentUserId={currentUserId}
          isMine={isMine}
          onReact={onReact}
          onReply={onReply}
          memberNames={memberNames}
          hover
        />
      )}

      <div
        className="flex flex-col max-w-[75%] sm:max-w-[70%] lg:max-w-[60%]"
        style={swiping ? { transform: `translateX(${swipeX}px)`, transition: "none" } : { transition: "transform 0.2s ease" }}
      >
        {!isMine && (
          <span className="text-[11px] text-[var(--text-tertiary)] font-medium mb-1 ml-2">
            {msg.sender?.full_name || otherParticipant?.full_name}
          </span>
        )}

        {/* Burbuja */}
        <div className="relative">
          <div
            className={cn(
              "px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm",
              isMine
                ? "bg-[var(--color-primary)] text-white rounded-tr-none"
                : "bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-tl-none"
            )}
          >
            {/* Cita del mensaje respondido */}
            {msg.reply_to && (
              <button
                onClick={() => onScrollToReply(msg.reply_to!.id)}
                className={cn(
                  "w-full text-left mb-2 rounded-lg px-3 py-1.5 border-l-4 text-xs",
                  isMine
                    ? "bg-white/10 border-white/60 text-white/80"
                    : "bg-[var(--bg-arena)]/60 border-[var(--border-strong)] text-[var(--text-secondary)]"
                )}
              >
                <p className="font-semibold truncate">{msg.reply_to.sender_name ?? "Usuario"}</p>
                <p className="truncate opacity-80">
                  {msg.reply_to.content?.startsWith("http") ? "📷 Foto" : msg.reply_to.content}
                </p>
              </button>
            )}

            {msg.message_type === "image" ? (
              <button
                type="button"
                onClick={() => onOpenImage(msg.metadata?.image_url ?? msg.content ?? msg.body ?? "")}
                className="block -mx-1 cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {/* Tamaño fijo: si la altura dependiera de la carga de la foto,
                    el scroll inicial al fondo quedaría corto al terminar de cargar. */}
                <img
                  src={msg.metadata?.image_url ?? msg.content ?? msg.body}
                  alt="Foto"
                  loading="lazy"
                  className="rounded-xl w-[240px] h-[280px] object-cover bg-black/10"
                />
              </button>
            ) : (
              <p className="whitespace-pre-wrap">{msg.content ?? msg.body}</p>
            )}

            {/* Timestamp + palomitas */}
            <div className="flex items-center gap-2 mt-1.5 justify-end">
              <span className="text-[9px] opacity-60 flex-shrink-0 flex items-center gap-1">
                {format(msgDate, "HH:mm")}
                {isMine && (
                  msg.pending
                    // Enviando: una palomita tenue
                    ? <Check size={13} className="text-white/50" />
                    : (msg.is_read || !!msg.read_at)
                      // Leído: dos palomitas azules (estilo WhatsApp)
                      ? <CheckCheck size={14} strokeWidth={2.6} className="text-[#2EB8FF]" />
                      // Entregado: dos palomitas grises
                      : <CheckCheck size={13} className="text-white/70" />
                )}
              </span>
            </div>
          </div>

          {/* Reacciones existentes debajo de la burbuja */}
          {(msg.reactions?.length ?? 0) > 0 && (
            <div className={cn("mt-1", isMine ? "flex justify-end" : "flex justify-start")}>
              <MessageReactions
                messageId={msg.id}
                conversationId={conversationId}
                reactions={msg.reactions ?? []}
                currentUserId={currentUserId}
                isMine={isMine}
                onReact={onReact}
                memberNames={memberNames}
                showOnlyBadges
              />
            </div>
          )}
        </div>
      </div>

      {/* Acciones al hover (estilo Instagram) — a la derecha de las burbujas recibidas */}
      {!isMine && (
        <MessageReactions
          messageId={msg.id}
          conversationId={conversationId}
          reactions={msg.reactions ?? []}
          currentUserId={currentUserId}
          isMine={isMine}
          onReact={onReact}
          onReply={onReply}
          memberNames={memberNames}
          hover
        />
      )}

      {/* Icono de reply al swipear (derecha, para mensajes propios) */}
      {isMine && (
        <div
          className="flex items-center justify-center w-8 ml-1 transition-opacity"
          style={{ opacity: progress, transform: `scale(${0.6 + 0.4 * progress})` }}
        >
          <CornerUpLeft size={18} className="text-[var(--color-primary)]" />
        </div>
      )}
    </div>
  );
}

function ConversationItem({
  conv,
  active,
  currentUserId,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  currentUserId: string;
  onClick: () => void;
}) {
  const other = conv.guest_id === currentUserId ? conv.host : conv.guest;
  const initial = other ? other.full_name.charAt(0).toUpperCase() : "?";
  // Los mensajes de foto guardan la URL como contenido; si la vista previa es
  // una URL, mostrar algo amigable en lugar del enlace crudo.
  const rawPreview = conv.last_message_preview;
  const preview = !rawPreview
    ? "Sin mensajes aún"
    : /^https?:\/\//.test(rawPreview) ? "📷 Foto" : rawPreview;
  const ts = conv.last_message_at
    ? format(parseISO(conv.last_message_at), "d MMM", { locale: es })
    : "";

  const isGuest = conv.guest_id === currentUserId;
  const unreadCount = isGuest ? conv.unread_count_guest : conv.unread_count_host;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3.5 px-3.5 py-3.5 text-left transition-all rounded-2xl",
        active
          ? "bg-[var(--color-primary-light)] ring-1 ring-[var(--color-primary-border)]"
          : "hover:bg-[var(--bg-subtle)]"
      )}
    >
      <div className="relative flex-shrink-0">
        {other?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={other.avatar_url}
            alt={other.full_name}
            className="w-12 h-12 rounded-full object-cover border border-[var(--border-subtle)] shadow-sm"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-neutral-900 text-white font-semibold text-sm flex items-center justify-center shadow-sm">
            {initial}
          </div>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
            {unreadCount}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={cn(
            "text-sm text-[var(--text-primary)] truncate leading-tight",
            unreadCount > 0 ? "font-bold" : "font-semibold"
          )}>
            {other?.full_name}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] ml-2 flex-shrink-0 font-medium">{ts}</span>
        </div>
        
        {/* Vista previa de mensaje */}
        <p className={cn(
          "text-xs truncate leading-snug",
          unreadCount > 0 ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-tertiary)]"
        )}>
          {preview}
        </p>

        {/* Rol descriptivo del chat */}
        <span className="inline-block text-[9px] text-[var(--text-tertiary)] font-semibold mt-1.5 border border-[var(--border-subtle)] px-2 py-0.5 rounded-md">
          {isGuest ? "Hospedaje" : "Tu propiedad"}
        </span>
      </div>
    </button>
  );
}
