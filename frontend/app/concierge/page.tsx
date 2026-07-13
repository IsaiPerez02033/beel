"use client";

import { useEffect, useRef, useState } from "react";
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
  // Estado del avatar de cabecera: coiling -> thinking -> fluffing -> done -> idle
  const [avatarState, setAvatarState] = useState<"idle" | "coiling" | "thinking" | "fluffing" | "done">("idle");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/iniciar-sesion?callbackUrl=/concierge");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (messages.length > 0 || loading) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, loading]);

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
      setAvatarState("fluffing");
      
      // Esperamos a que termine el esponjado de plumas antes de pintar el mensaje
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.reply, properties: res.properties, experiences: res.experiences },
        ]);
        setLoading(false);
        setAvatarState("done");
        
        // Regresa a reposo después del asentimiento
        setTimeout(() => {
          setAvatarState("idle");
        }, 900);
      }, 850);
    } catch (e) {
      clearTimeout(coilTimeout);
      setAvatarState("idle");
      setLoading(false);
      setError(e instanceof Error ? e.message : "No se pudo contactar al Concierge.");
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
            <div className="flex justify-center mb-3">
              <KukulAvatar size={56} state={avatarState} />
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
                    <div className="max-w-[85%] bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-2xl rounded-tr-sm px-4.5 py-3 shadow-sm text-body">
                      {m.content}
                    </div>
                  </div>
                )}

                {/* Mensaje del asistente */}
                {m.role === "assistant" && (
                  <div className="flex gap-3">
                    <KukulAvatar size={32} state="idle" />
                    <div className="flex-1 space-y-4 max-w-[85%]">
                      {/* Burbuja principal */}
                      <div className="bg-[var(--bg-subtle)] text-[var(--text-primary)] rounded-2xl rounded-tl-sm px-4.5 py-3 text-body shadow-sm leading-relaxed animate-concierge-bubble">
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
              <div className="flex gap-3 items-center">
                <KukulAvatar size={32} state={avatarState} />
                <div className="flex items-center gap-1.5 text-body-sm text-[var(--text-tertiary)]">
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
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="max-w-3xl mx-auto flex items-end gap-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl p-2 shadow-sm"
        >
          <textarea
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
    </div>
  );
}
