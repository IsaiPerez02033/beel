"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useSafeAuth";
import Navbar from "@/components/Navbar";
import { useApi } from "@/hooks/useApi";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";
import { Send, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
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

interface Message {
  id: string;
  sender_id: string;
  body?: string;
  content?: string;
  message_type: string;
  created_at: string;
  sender?: Participant;
}

export default function MensajesPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { get, post } = useApi();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(
    searchParams.get("conv")
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localUserId, setLocalUserId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find(
    (c) => c.id === activeConvId || c.reservation_id === activeConvId
  );

  // Normalizar el ID activo al ID de la conversación si coincidió por ID de reserva
  useEffect(() => {
    if (activeConv && activeConv.id !== activeConvId) {
      setActiveConvId(activeConv.id);
    }
  }, [activeConv, activeConvId]);

  // Obtener ID local del usuario
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push("/iniciar-sesion");
      return;
    }
    get<{ id: string }>("/users/me")
      .then((d) => setLocalUserId(d.id))
      .catch(console.error);
  }, [isSignedIn, isLoaded, get, router]);

  // Cargar conversaciones
  useEffect(() => {
    if (!isSignedIn) return;
    get<{ conversations: Conversation[] }>("/messaging")
      .then((d) => setConversations(d.conversations))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isSignedIn, get]);

  // Cargar mensajes al seleccionar conversación
  useEffect(() => {
    if (!activeConvId) return;
    get<{ messages: Message[] }>(`/messaging/${activeConvId}/messages`)
      .then((d) => {
        setMessages(d.messages);
        // Si no tenemos esta conversación en la lista lateral, recargar la lista
        const exists = conversations.some(c => c.id === activeConvId || c.reservation_id === activeConvId);
        if (!exists) {
          get<{ conversations: Conversation[] }>("/messaging")
            .then((res) => setConversations(res.conversations))
            .catch(console.error);
        }
      })
      .catch(console.error);
  }, [activeConvId, get, conversations]);

  // WebSocket: recibir mensajes en tiempo real
  const { send: wsSend } = useWebSocket(activeConvId, {
    onMessage: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: data.id,
          sender_id: data.sender_id,
          body: data.body,
          message_type: data.message_type ?? "text",
          created_at: data.created_at,
          sender: { id: data.sender_id, full_name: data.sender_name },
        },
      ]);
    },
  });

  // Scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || !activeConvId || sending) return;
    setSending(true);
    try {
      const msg = await post<Message>(`/messaging/${activeConvId}/messages`, {
        body: input.trim(),
      });
      setMessages((prev) => [...prev, msg]);
      setInput("");
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden max-w-5xl w-full mx-auto border-x border-[var(--border-subtle)]">

        {/* ── Lista de conversaciones ── */}
        <aside
          className={cn(
            "w-full md:w-80 border-r border-[var(--border-subtle)] flex flex-col",
            activeConvId && "hidden md:flex"
          )}
        >
          <div className="p-4 border-b border-[var(--border-subtle)]">
            <h1 className="text-h2 font-display text-[var(--text-primary)]">Mensajes</h1>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="skeleton w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 w-2/3 rounded" />
                      <div className="skeleton h-2.5 w-full rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="empty-state py-12 px-4">
                <div className="text-4xl">💬</div>
                <p className="text-body-sm text-[var(--text-secondary)] text-center">
                  Aún no tienes mensajes
                </p>
              </div>
            ) : (
              conversations.map((c) => (
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

        {/* ── Chat activo ── */}
        <main className={cn("flex-1 flex flex-col", !activeConvId && "hidden md:flex")}>
          {activeConvId && activeConv ? (
            <>
              {/* Header del chat */}
              <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="md:hidden p-1 rounded-lg hover:bg-[var(--bg-subtle)]"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="avatar avatar-md bg-[var(--color-primary)]">
                  {(activeConv.guest_id === localUserId ? activeConv.host.full_name : activeConv.guest.full_name).charAt(0)}
                </div>
                <div>
                  <p className="text-body font-medium text-[var(--text-primary)]">
                    {activeConv.guest_id === localUserId ? activeConv.host.full_name : activeConv.guest.full_name}
                  </p>
                  <span className="sse-connected text-caption text-[var(--text-tertiary)]">
                    En línea
                  </span>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => {
                  const isMine = msg.sender_id === localUserId;
                  if (msg.message_type === "system") {
                    return (
                      <div key={msg.id} className="flex justify-center">
                        <span className="text-caption text-[var(--text-tertiary)] bg-[var(--bg-subtle)] px-3 py-1 rounded-full">
                          {msg.body}
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex", isMine ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "bubble",
                          isMine ? "bubble-host" : "bubble-guest"
                        )}
                      >
                        <p>{msg.content ?? msg.body}</p>
                        <p className="text-[10px] mt-1 opacity-60">
                          {format(parseISO(msg.created_at), "HH:mm", { locale: es })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder="Escribe un mensaje..."
                    className="input flex-1"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state flex-1">
              <div className="text-5xl">💬</div>
              <p className="text-body text-[var(--text-secondary)]">
                Selecciona una conversación
              </p>
            </div>
          )}
        </main>
      </div>
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
  const preview = conv.last_message_preview ?? "Sin mensajes aún";
  const ts = conv.last_message_at
    ? format(parseISO(conv.last_message_at), "d MMM", { locale: es })
    : "";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg-subtle)] transition-colors border-b border-[var(--border-subtle)]",
        active && "bg-[var(--color-primary-light)]"
      )}
    >
      <div className="avatar avatar-md flex-shrink-0">{initial}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-body-sm font-medium text-[var(--text-primary)] truncate">
            {other.full_name}
          </span>
          <span className="text-caption text-[var(--text-tertiary)] ml-2 flex-shrink-0">{ts}</span>
        </div>
        <p className="text-caption text-[var(--text-secondary)] truncate">{preview}</p>
      </div>
    </button>
  );
}
