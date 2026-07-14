"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import KukulAvatar from "@/components/KukulAvatar";
import PropertyCard from "@/components/PropertyCard";
import ExperienceCard from "@/components/ExperienceCard";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useSafeAuth";
import type { Property, Experience } from "@/types";

interface Msg {
  role: "user" | "assistant";
  content: string;
  properties?: Property[];
  experiences?: Experience[];
}

const SUGGESTIONS = [
  "4 días en Oaxaca para 2, nos gusta la comida y el arte, presupuesto $8,000",
  "Un fin de semana en la playa cerca de CDMX",
  "Escapada de aventura en Chiapas para 3 personas",
  "Algo tranquilo y romántico en un pueblo mágico",
];

export default function ConciergePage() {
  const router = useRouter();
  const { post } = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Estado emocional / comportamiento de Kukul
  const [avatarState, setAvatarState] = useState<
    | "idle"
    | "listening"
    | "thinking"
    | "responding"
    | "success"
    | "error"
    | "celebration"
    | "sleeping"
    | "coiling"
    | "fluffing"
    | "done"
  >("idle");
  
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tracking de cursor global para el seguimiento ocular de Kukul
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Control de inactividad de usuario para poner a dormir a Kukul (Sueño)
  const [lastActivity, setLastActivity] = useState(Date.now());
  useEffect(() => {
    const handleUserActivity = () => {
      setLastActivity(Date.now());
      if (avatarState === "sleeping") {
        setAvatarState("idle");
      }
    };
    window.addEventListener("mousemove", handleUserActivity);
    window.addEventListener("keydown", handleUserActivity);
    window.addEventListener("click", handleUserActivity);
    return () => {
      window.removeEventListener("mousemove", handleUserActivity);
      window.removeEventListener("keydown", handleUserActivity);
      window.removeEventListener("click", handleUserActivity);
    };
  }, [avatarState]);

  useEffect(() => {
    const interval = setInterval(() => {
      const inactiveMs = Date.now() - lastActivity;
      // 1 minuto de inactividad -> Duerme
      if (inactiveMs > 60000 && avatarState === "idle" && !loading) {
        setAvatarState("sleeping");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [lastActivity, avatarState, loading]);

  // Hilo dorado interactivo para conectar Kukul con los nuevos mensajes
  const [thread, setThread] = useState<{ x1: number; y1: number; x2: number; y2: number; visible: boolean } | null>(null);

  const triggerGoldenThread = () => {
    setTimeout(() => {
      const avatarEl = document.getElementById("kukul-avatar-anchor");
      const msgBubbles = document.querySelectorAll(".assistant-bubble-new");
      const lastBubble = msgBubbles[msgBubbles.length - 1];
      if (avatarEl && lastBubble) {
        const rectA = avatarEl.getBoundingClientRect();
        const rectB = lastBubble.getBoundingClientRect();
        const scrollY = window.scrollY || window.pageYOffset;
        const scrollX = window.scrollX || window.pageXOffset;
        setThread({
          x1: rectA.left + rectA.width / 2 + scrollX,
          y1: rectA.top + rectA.height / 2 + scrollY,
          x2: rectB.left + 12 + scrollX,
          y2: rectB.top + 24 + scrollY,
          visible: true,
        });
        
        setTimeout(() => {
          setThread(t => t ? { ...t, visible: false } : null);
        }, 850);
      }
    }, 100);
  };

  // Travel Mode: Escaneo de palabras clave del chat para cambiar la iluminación ambiental
  const [travelTheme, setTravelTheme] = useState<"beach" | "mountain" | "luxury" | "food" | "default">("default");
  useEffect(() => {
    if (messages.length === 0) {
      setTravelTheme("default");
      return;
    }
    const lastMsg = messages[messages.length - 1];
    const text = lastMsg.content.toLowerCase();
    
    if (text.includes("playa") || text.includes("mar") || text.includes("beach") || text.includes("isla") || text.includes("tulum")) {
      setTravelTheme("beach");
    } else if (text.includes("montaña") || text.includes("bosque") || text.includes("naturaleza") || text.includes("aventura") || text.includes("cabaña")) {
      setTravelTheme("mountain");
    } else if (text.includes("hotel") || text.includes("hospedaje") || text.includes("resort") || text.includes("lujo") || text.includes("luxury") || text.includes("premium")) {
      setTravelTheme("luxury");
    } else if (text.includes("comida") || text.includes("gastronomía") || text.includes("restaurante") || text.includes("cenar") || text.includes("delicioso")) {
      setTravelTheme("food");
    } else {
      setTravelTheme("default");
    }
  }, [messages]);

  // Obtener recomendaciones de respuestas dinámicas según la última pregunta de Kukul
  const quickReplies = useMemo(() => {
    if (loading || messages.length === 0) return [];
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === "assistant") {
      const t = lastMsg.content.toLowerCase();
      // 1. Destinos / Pueblos Mágicos
      if (t.includes("pueblo mágico") || t.includes("cuál pueblo") || t.includes("dónde") || t.includes("destino")) {
        return ["Guanajuato", "San Miguel de Allende", "Oaxaca", "Pátzcuaro", "Tepoztlán", "Tulum"];
      }
      // 2. Duración
      if (t.includes("noches") || t.includes("cuántas noches") || t.includes("días piensas") || t.includes("tiempo")) {
        return ["1 noche", "2 noches", "3 noches", "Fin de semana (2 noches)", "5 noches"];
      }
      // 3. Presupuesto
      if (t.includes("presupuesto") || t.includes("precio") || t.includes("presupuesto aproximado") || t.includes("cuánto piensas gastar")) {
        return ["Bajo (< $1,500 MXN)", "Moderado ($1,500 - $3,500 MXN)", "Luxe (> $3,500 MXN)"];
      }
      // 4. Experiencias
      if (t.includes("experiencia") || t.includes("actividades") || t.includes("guste especialmente") || t.includes("naturaleza") || t.includes("gastronomía")) {
        return ["Gastronomía", "Naturaleza y Aventura", "Cultura y Arte", "Wellness/Relajación", "Romántico"];
      }
    }
    return [];
  }, [messages, loading]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/iniciar-sesion?callbackUrl=/concierge");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (messages.length > 0 || loading) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading]);

  // Detectar cuando el usuario escribe, borra caracteres o permanece pausado
  const [prevInputLength, setPrevInputLength] = useState(0);
  const [headTiltActive, setHeadTiltActive] = useState(false);
  useEffect(() => {
    if (loading) return;
    const currentLen = input.length;
    
    // Si borra caracteres, Kukul inclina la cabeza con curiosidad sutil (Head Tilt)
    if (currentLen < prevInputLength && currentLen > 0) {
      setHeadTiltActive(true);
      const timer = setTimeout(() => setHeadTiltActive(false), 600);
      return () => clearTimeout(timer);
    }
    setPrevInputLength(currentLen);
    
    if (currentLen > 0) {
      setAvatarState("listening");
    } else if (avatarState === "listening") {
      setAvatarState("idle");
    }
  }, [input, loading, avatarState, prevInputLength]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    setError("");
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setAvatarState("coiling");
    const coilTimeout = setTimeout(() => {
      setAvatarState("thinking");
    }, 450); // duración del enrollado en CSS
    try {
      const res = await post<{ reply: string; properties: Property[]; experiences: Experience[] }>(
        "/concierge/chat",
        { messages: next.map((m) => ({ role: m.role, content: m.content })) }
      );
      clearTimeout(coilTimeout);
      setAvatarState("responding");
      
      // Esperamos a que termine el esponjado de plumas y destello antes de pintar el mensaje
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply, properties: res.properties, experiences: res.experiences },
        ]);
        setLoading(false);
        setAvatarState("celebration");
        triggerGoldenThread();
        
        // Regresa a reposo después de celebrar el éxito
        setTimeout(() => {
          setAvatarState("idle");
        }, 900);
      }, 850);
    } catch (e) {
      clearTimeout(coilTimeout);
      setAvatarState("error");
      setLoading(false);
      setError(e instanceof Error ? e.message : "No se pudo contactar al Concierge.");
      
      // Regresa a reposo tras mostrar decepción/error temporal
      setTimeout(() => {
        setAvatarState("idle");
      }, 2200);
    }
  }

  return (
    <div className="h-[100dvh] bg-[var(--bg-base)] flex flex-col overflow-hidden aurora-bg">
      <Navbar />

      {/* Área de conversación (único scroll) */}
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6">
          {/* Cabecera */}
          <div className="text-center mb-6">
            <div id="kukul-avatar-anchor" className="flex justify-center mb-3">
              <KukulAvatar size={56} state={avatarState} mousePos={mousePos} theme={travelTheme} headTilt={headTiltActive} />
            </div>
            <h1 className="text-h1 sm:text-display font-display font-semibold text-[var(--text-primary)]">Beel Concierge</h1>
            <p className="text-body-sm text-[var(--text-secondary)] mt-1 max-w-md mx-auto">
              Soy <span className="font-semibold text-[var(--text-primary)]">Kukul</span>, tu guía de viajes por México. Cuéntame a dónde quieres ir y te armo el viaje con hospedajes y experiencias reales.
            </p>
          </div>

          {/* Sugerencias (solo al inicio) */}
          {messages.length === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left card p-4 hover:border-[var(--color-primary)] transition-colors text-body-sm text-[var(--text-secondary)]"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Lista de mensajes */}
          <div className="space-y-6 mb-24">
            {messages.map((m, idx) => (
              <div key={idx} className="space-y-4">
                {/* Mensaje del usuario */}
                {m.role === "user" && (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] text-[var(--text-primary)] text-body-sm whitespace-pre-wrap text-right animate-concierge-bubble">
                      {m.content}
                    </div>
                  </div>
                )}

                {/* Mensaje del asistente */}
                {m.role === "assistant" && (
                  <div className={`flex gap-3 items-start ${idx === messages.length - 1 ? "assistant-bubble-new animate-fade-in" : ""}`}>
                    <KukulAvatar size={32} state="idle" mousePos={mousePos} theme={travelTheme} />
                    <div className="flex-1 space-y-4">
                      {/* Mensaje directo sin burbuja */}
                      <div className="text-body-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                        {m.content}
                      </div>

                      {/* Hospedajes recomendados */}
                      {m.properties && m.properties.length > 0 && (
                        <div className="animate-fade-in delay-100">
                          <p className="text-caption font-semibold text-[var(--text-tertiary)] mb-2 uppercase tracking-wide">Hospedajes</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {m.properties.map((p) => <PropertyCard key={p.id} property={p} />)}
                          </div>
                        </div>
                      )}

                      {/* Experiencias recomendadas */}
                      {m.experiences && m.experiences.length > 0 && (
                        <div className="animate-fade-in delay-200">
                          <p className="text-caption font-semibold text-[var(--text-tertiary)] mb-2 uppercase tracking-wide">Experiencias</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {m.experiences.map((e) => <ExperienceCard key={e.id} experience={e} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 items-start">
                <KukulAvatar size={32} state={avatarState} mousePos={mousePos} theme={travelTheme} />
                <div className="text-body-sm text-[var(--text-secondary)] leading-relaxed flex items-center gap-2 animate-concierge-bubble">
                  <span>
                    {avatarState === "fluffing"
                      ? "¡Kukul ha encontrado tu viaje!"
                      : "Kukul está pensando"}
                  </span>
                  {avatarState !== "fluffing" && (
                    <span className="typing-dots !p-0">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm">
                {error}
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>
      </main>

      {/* Input (hijo del flex, siempre visible abajo) */}
      <div className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3">
        {/* Recomendaciones de Respuestas (Pills) */}
        {quickReplies.length > 0 && (
          <div className="flex gap-2 px-1 pb-3 overflow-x-auto scrollbar-none max-w-3xl mx-auto w-full">
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => send(reply)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-caption font-medium border border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all active:scale-95 text-xs shadow-sm"
              >
                {reply}
              </button>
            ))}
            <button
              type="button"
              onClick={() => textareaRef.current?.focus()}
              className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-caption border border-dashed border-[var(--color-accent)] bg-[var(--bg-base)] text-[var(--color-accent)] hover:bg-[var(--bg-elevated)] transition-all active:scale-95 text-xs font-semibold shadow-sm"
            >
              Otro...
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="max-w-3xl mx-auto flex items-end gap-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl p-2 shadow-sm"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Escribe tu viaje ideal…"
            className="flex-1 resize-none bg-transparent outline-none px-2 py-2 text-body-sm max-h-32"
            style={{ border: "none", outline: "none", background: "transparent", boxShadow: "none", fontSize: "16px" }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-accent)] text-[#2C2C2A] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 shadow-sm"
            aria-label="Enviar"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} className="-mr-[1px] -mt-[1px]" strokeWidth={2.5} />}
          </button>
        </form>
        <p className="text-center text-micro text-[var(--text-tertiary)] mt-2">
          El Concierge recomienda solo hospedajes y experiencias reales publicados en Beel.
        </p>
      </div>

      {/* SVG Overlay para el Hilo Dorado de Mensaje */}
      {thread && thread.visible && (
        <svg className="fixed inset-0 pointer-events-none z-50 w-full h-full">
          <defs>
            <linearGradient id="gold-thread-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFF2CC" stopOpacity="1" />
              <stop offset="50%" stopColor="#FDBF4E" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#D48C00" stopOpacity="0" />
            </linearGradient>
            <filter id="thread-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path
            d={`M ${thread.x1} ${thread.y1} C ${(thread.x1 + thread.x2) / 2} ${thread.y1}, ${(thread.x1 + thread.x2) / 2} ${thread.y2}, ${thread.x2} ${thread.y2}`}
            fill="none"
            stroke="url(#gold-thread-grad)"
            strokeWidth="2.2"
            filter="url(#thread-glow)"
            className="animate-thread-draw"
          />
        </svg>
      )}
    </div>
  );
}
