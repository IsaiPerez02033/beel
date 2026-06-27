"use client";

import { useEffect, useState, useRef } from "react";
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
  ChevronRight, 
  CheckCircle2, 
  MessageSquare,
  Calendar,
  Users,
  CreditCard,
  ExternalLink
} from "lucide-react";
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
  
  // Filtros y búsqueda
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  
  // Sidebar de reservación
  const [showInfoSidebar, setShowInfoSidebar] = useState(true);
  const [reservationDetails, setReservationDetails] = useState<ReservationDetails | null>(null);
  const [loadingReservation, setLoadingReservation] = useState(false);

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

  // Obtener ID del usuario local
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

  // Cargar lista de conversaciones
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

  // Auto-scroll al fondo al recibir mensajes
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
    return messages.map((msg) => {
      const msgDate = parseISO(msg.created_at);
      const dateStr = format(msgDate, "d 'de' MMMM", { locale: es });
      let dateSeparator = null;
      if (dateStr !== lastDateStr) {
        lastDateStr = dateStr;
        dateSeparator = (
          <div key={`date-${msg.id}`} className="flex justify-center my-6">
            <span className="text-[11px] font-semibold text-neutral-400 bg-neutral-50 border border-neutral-100 px-3 py-1 rounded-full uppercase tracking-wider">
              {dateStr}
            </span>
          </div>
        );
      }

      const isMine = msg.sender_id === localUserId;

      return (
        <div key={msg.id}>
          {dateSeparator}
          {msg.message_type === "system" ? (
            <div className="flex justify-center my-5">
              <span className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200/50 px-4 py-2 rounded-xl max-w-md text-center shadow-sm font-medium">
                {msg.body}
              </span>
            </div>
          ) : (
            <div className={cn("flex my-3", isMine ? "justify-end" : "justify-start")}>
              <div className="flex flex-col max-w-[70%] lg:max-w-[60%]">
                {!isMine && (
                  <span className="text-[11px] text-neutral-400 font-medium mb-1 ml-2">
                    {msg.sender?.full_name || otherParticipant?.full_name}
                  </span>
                )}
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words shadow-sm",
                    isMine
                      ? "bg-[#222222] text-white rounded-tr-none font-normal"
                      : "bg-[#F7F7F7] text-neutral-800 rounded-tl-none border border-neutral-200/50"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content ?? msg.body}</p>
                  <div className="flex items-center justify-end gap-1 mt-1.5 opacity-60 text-[9px]">
                    <span>{format(msgDate, "HH:mm")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── COLUMNA 1: Lista de conversaciones (Airbnb-style) ── */}
        <aside
          className={cn(
            "w-full md:w-[350px] lg:w-[380px] border-r border-neutral-200 flex flex-col bg-white flex-shrink-0 z-30 transition-transform duration-300",
            activeConvId && "hidden md:flex"
          )}
        >
          {/* Header lateral con buscador y filtros */}
          <div className="p-5 border-b border-neutral-100 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold font-display text-neutral-900">Mensajes</h1>
            </div>
            
            {/* Buscador */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
                <Search size={16} />
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o contenido..."
                className="w-full pl-10 pr-4 py-2 rounded-full border border-neutral-200 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 placeholder-neutral-400 bg-neutral-50"
              />
            </div>

            {/* Filtros rápidos */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterUnread(false)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  !filterUnread
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                )}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterUnread(true)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  filterUnread
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
                )}
              >
                Sin leer
              </button>
            </div>
          </div>

          {/* Listado de chats */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
            {loading ? (
              <div className="p-5 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-12 h-12 bg-neutral-200 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2 mt-1">
                      <div className="h-3 bg-neutral-200 w-1/3 rounded" />
                      <div className="h-2.5 bg-neutral-200 w-full rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="py-16 px-4 text-center">
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400">
                  <MessageSquare size={24} />
                </div>
                <p className="text-sm font-semibold text-neutral-900">Aún no tienes mensajes</p>
                <p className="text-xs text-neutral-400 mt-1 max-w-[200px] mx-auto">
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
        <main className={cn("flex-1 flex flex-col bg-white overflow-hidden relative", !activeConvId && "hidden md:flex")}>
          {activeConvId && activeConv ? (
            <>
              {/* Header del Chat */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-white z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveConvId(null)}
                    className="md:hidden p-1.5 rounded-full hover:bg-neutral-100 text-neutral-600 transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="relative">
                    {otherParticipant?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={otherParticipant.avatar_url}
                        alt={otherParticipant.full_name}
                        className="w-10 h-10 rounded-full object-cover border border-neutral-100 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-neutral-900 text-white font-semibold text-sm flex items-center justify-center shadow-sm">
                        {otherParticipant?.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[15px] font-semibold text-neutral-900 leading-tight">
                        {otherParticipant?.full_name}
                      </span>
                    </div>
                    <span className="text-[11px] text-neutral-400 font-medium">
                      {isLocalUserGuest ? "Anfitrión de Beel" : "Huésped"}
                    </span>
                  </div>
                </div>

                {/* Botón Info Reservación */}
                <button
                  onClick={() => setShowInfoSidebar(!showInfoSidebar)}
                  className={cn(
                    "p-2 rounded-full border transition-all text-neutral-600 hover:bg-neutral-50 hover:text-neutral-950",
                    showInfoSidebar ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"
                  )}
                  title="Detalles de la reserva"
                >
                  <Info size={18} />
                </button>
              </div>

              {/* Contenedor de Mensajes */}
              <div className="flex-1 overflow-y-auto px-6 py-4 bg-white">
                {renderMessages()}
                <div ref={messagesEndRef} />
              </div>

              {/* Caja de Input (Estilo Airbnb) */}
              <div className="p-5 border-t border-neutral-100 bg-white flex-shrink-0">
                <div className="relative border border-neutral-300 focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900 rounded-3xl p-3 pl-4 pr-14 transition-all bg-white max-w-3xl mx-auto flex items-center">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    className="w-full resize-none outline-none border-none text-sm placeholder-neutral-400 bg-transparent text-neutral-800 pr-1 py-1 max-h-[120px] focus:ring-0"
                    disabled={sending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    className="absolute right-3 bottom-3 w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 active:scale-95 transition-all disabled:opacity-30 disabled:scale-100 disabled:pointer-events-none shadow-sm"
                  >
                    <Send size={13} className="rotate-0 text-white -mr-[1px] -mt-[1px]" strokeWidth={2.5} />
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 text-center mt-2.5">
                  Presiona Enter para enviar. Shift + Enter para salto de línea.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-50/50">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-md border border-neutral-100 text-neutral-400 mb-4 animate-bounce">
                <MessageSquare size={32} />
              </div>
              <p className="text-base font-semibold text-neutral-900">Selecciona una conversación</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-[240px] text-center">
                Elige uno de tus chats de la izquierda para comenzar a hablar con el huésped o anfitrión.
              </p>
            </div>
          )}
        </main>

        {/* ── COLUMNA 3: Detalles de Reserva (Airbnb-style) ── */}
        {activeConvId && activeConv && showInfoSidebar && (
          <aside
            className={cn(
              "fixed inset-0 lg:static z-40 bg-white lg:bg-transparent w-full lg:w-[320px] xl:w-[360px] flex-shrink-0 border-l border-neutral-200 flex flex-col overflow-y-auto transition-transform duration-300",
              showInfoSidebar ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* Header del sidebar */}
            <div className="p-5 border-b border-neutral-100 flex items-center justify-between flex-shrink-0 bg-white sticky top-0 z-10">
              <h2 className="text-md font-bold text-neutral-900">Detalles de reservación</h2>
              <button
                onClick={() => setShowInfoSidebar(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {loadingReservation ? (
              <div className="p-5 space-y-5 animate-pulse">
                <div className="w-full aspect-[16/10] bg-neutral-200 rounded-2xl" />
                <div className="h-4 bg-neutral-200 w-2/3 rounded" />
                <div className="h-3 bg-neutral-200 w-1/2 rounded" />
                <div className="space-y-2 pt-4">
                  <div className="h-3 bg-neutral-200 w-full rounded" />
                  <div className="h-3 bg-neutral-200 w-full rounded" />
                </div>
              </div>
            ) : reservationDetails ? (
              <div className="p-5 space-y-6 flex-1 pb-16">
                {/* Mini Tarjeta Propiedad */}
                <div className="space-y-3">
                  <div className="relative w-full aspect-[16/10] bg-neutral-100 rounded-2xl overflow-hidden shadow-sm border border-neutral-100">
                    {reservationDetails.reservation_property?.photos?.find(p => p.is_primary)?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={reservationDetails.reservation_property.photos.find(p => p.is_primary)!.url}
                        alt={reservationDetails.reservation_property.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-50 text-neutral-300">
                        No hay foto
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-neutral-900 leading-tight">
                      {reservationDetails.reservation_property?.title}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {reservationDetails.reservation_property?.city}
                    </p>
                  </div>
                  <Link
                    href={`/reservaciones/${reservationDetails.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900 hover:underline pt-1"
                  >
                    Detalles de reserva <ExternalLink size={12} />
                  </Link>
                </div>

                <hr className="border-neutral-100" />

                {/* Perfil del otro participante */}
                <div className="flex items-center gap-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-100 shadow-sm">
                  {otherParticipant?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={otherParticipant.avatar_url}
                      alt={otherParticipant.full_name}
                      className="w-12 h-12 rounded-full object-cover border border-neutral-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-neutral-900 text-white font-semibold text-sm flex items-center justify-center">
                      {otherParticipant?.full_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-400 font-medium uppercase tracking-wider">
                      {isLocalUserGuest ? "Tu Anfitrión" : "Tu Huésped"}
                    </p>
                    <p className="text-sm font-semibold text-neutral-900 truncate">
                      {otherParticipant?.full_name}
                    </p>
                    <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium mt-0.5">
                      <CheckCircle2 size={13} strokeWidth={2.5} />
                      <span>Verificado</span>
                    </div>
                  </div>
                </div>

                <hr className="border-neutral-100" />

                {/* Fechas e Información del Viaje */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-widest text-neutral-400">Información del viaje</h4>
                  
                  <div className="flex items-start gap-3">
                    <Calendar size={16} className="text-neutral-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-neutral-700">Fechas</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {formatDateRange(reservationDetails.check_in, reservationDetails.check_out)}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5">
                        ({reservationDetails.nights} {reservationDetails.nights === 1 ? "noche" : "noches"})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Users size={16} className="text-neutral-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-neutral-700">Huéspedes</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {reservationDetails.guests_count} {reservationDetails.guests_count === 1 ? "huésped" : "huéspedes"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CreditCard size={16} className="text-neutral-500 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-neutral-700">Estado de reserva</p>
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

                {/* Desglose de Pago (solo visible si el usuario logueado es el HUESPED para privacidad de datos) */}
                {isLocalUserGuest && (
                  <>
                    <hr className="border-neutral-100" />
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-widest text-neutral-400">Información de pago</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-neutral-500">
                          <span>
                            {formatCurrency(reservationDetails.price_per_night_snapshot, reservationDetails.currency)} x {reservationDetails.nights} noches
                          </span>
                          <span>
                            {formatCurrency(reservationDetails.price_per_night_snapshot * reservationDetails.nights, reservationDetails.currency)}
                          </span>
                        </div>
                        {parseFloat(reservationDetails.cleaning_fee_snapshot.toString()) > 0 && (
                          <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span>Tarifa de limpieza</span>
                            <span>{formatCurrency(reservationDetails.cleaning_fee_snapshot, reservationDetails.currency)}</span>
                          </div>
                        )}
                        {parseFloat(reservationDetails.platform_fee_snapshot.toString()) > 0 && (
                          <div className="flex items-center justify-between text-xs text-neutral-500">
                            <span>Tarifa de plataforma</span>
                            <span>{formatCurrency(reservationDetails.platform_fee_snapshot, reservationDetails.currency)}</span>
                          </div>
                        )}
                        
                        <div className="border-t border-neutral-100 pt-2 flex items-center justify-between text-sm font-bold text-neutral-900">
                          <span>Total ({reservationDetails.currency})</span>
                          <span>{formatCurrency(reservationDetails.total_amount, reservationDetails.currency)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="p-5 text-center text-xs text-neutral-400">
                No hay información de reserva vinculada a esta conversación.
              </div>
            )}
          </aside>
        )}
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

  const isGuest = conv.guest_id === currentUserId;
  const unreadCount = isGuest ? conv.unread_count_guest : conv.unread_count_host;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3.5 px-5 py-4 text-left transition-all border-b border-neutral-100",
        active
          ? "bg-neutral-50 border-l-4 border-l-neutral-900"
          : "hover:bg-neutral-50/60 border-l-4 border-l-transparent"
      )}
    >
      <div className="relative flex-shrink-0">
        {other?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={other.avatar_url}
            alt={other.full_name}
            className="w-12 h-12 rounded-full object-cover border border-neutral-200 shadow-sm"
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
            "text-sm text-neutral-900 truncate leading-tight",
            unreadCount > 0 ? "font-bold" : "font-semibold"
          )}>
            {other?.full_name}
          </span>
          <span className="text-[10px] text-neutral-400 ml-2 flex-shrink-0 font-medium">{ts}</span>
        </div>
        
        {/* Vista previa de mensaje */}
        <p className={cn(
          "text-xs truncate leading-snug",
          unreadCount > 0 ? "text-neutral-950 font-semibold" : "text-neutral-500"
        )}>
          {preview}
        </p>

        {/* Rol descriptivo del chat */}
        <span className="inline-block text-[9px] text-neutral-400 font-semibold mt-1 bg-neutral-100 px-2 py-0.5 rounded-md">
          {isGuest ? "Hospedaje" : "Tu propiedad"}
        </span>
      </div>
    </button>
  );
}
