"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Loader2 } from "lucide-react";
import Navbar from "@/components/Navbar";
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.replace("/iniciar-sesion?callbackUrl=/concierge");
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || loading) return;
    setError("");
    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await post<{ reply: string; properties: Property[]; experiences: Experience[] }>(
        "/concierge/chat",
        { messages: next.map((m) => ({ role: m.role, content: m.content })) }
      );
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply, properties: res.properties, experiences: res.experiences },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo contactar al Concierge.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col">
      <Navbar />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-40 flex flex-col">
        {/* Cabecera */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-3">
            <Sparkles size={26} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="text-display font-display font-semibold text-[var(--text-primary)]">Beel Concierge</h1>
          <p className="text-body-sm text-[var(--text-secondary)] mt-1">
            Cuéntame a dónde quieres ir y te armo el viaje con hospedajes y experiencias reales.
          </p>
        </div>

        {/* Sugerencias (solo al inicio) */}
        {messages.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
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

        {/* Conversación */}
        <div className="space-y-6 flex-1">
          {messages.map((m, i) => (
            <div key={i}>
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-[var(--color-primary)] text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-body-sm">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
                    <Sparkles size={15} className="text-[var(--color-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="prose-concierge text-body-sm text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed">
                      {m.content}
                    </div>

                    {m.properties && m.properties.length > 0 && (
                      <div className="mt-4">
                        <p className="text-caption font-semibold text-[var(--text-tertiary)] mb-2 uppercase tracking-wide">Hospedajes</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {m.properties.map((p) => <PropertyCard key={p.id} property={p} />)}
                        </div>
                      </div>
                    )}

                    {m.experiences && m.experiences.length > 0 && (
                      <div className="mt-4">
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
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
                <Sparkles size={15} className="text-[var(--color-primary)]" />
              </div>
              <div className="flex items-center gap-2 text-body-sm text-[var(--text-tertiary)] pt-1">
                <Loader2 size={15} className="animate-spin" /> Armando tu plan…
              </div>
            </div>
          )}

          {error && <p className="text-caption text-red-600 text-center">{error}</p>}
          <div ref={endRef} />
        </div>
      </main>

      {/* Input fijo */}
      <div className="fixed bottom-0 inset-x-0 bg-gradient-to-t from-[var(--bg-base)] via-[var(--bg-base)] to-transparent pt-6 pb-4 px-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="max-w-3xl mx-auto flex items-end gap-2 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-2xl p-2 shadow-lg"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Escribe tu viaje ideal…"
            className="flex-1 resize-none bg-transparent outline-none px-2 py-2 text-body-sm max-h-32"
            style={{ fontSize: "16px" }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn btn-primary w-10 h-10 flex items-center justify-center flex-shrink-0 disabled:opacity-40 p-0"
            aria-label="Enviar"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
        <p className="text-center text-micro text-[var(--text-tertiary)] mt-2">
          El Concierge recomienda solo hospedajes y experiencias reales publicados en Beel.
        </p>
      </div>
    </div>
  );
}
