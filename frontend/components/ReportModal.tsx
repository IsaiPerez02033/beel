"use client";

import { useState } from "react";
import { Flag, X, Send, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReportTargetType = "property" | "user" | "app" | "general";

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetTitle?: string;
  targetUrl?: string;
  reporterEmail?: string;
  reporterName?: string;
}

const REPORT_TYPES: Record<ReportTargetType, { label: string; options: string[] }> = {
  property: {
    label: "¿Qué problema tiene este anuncio?",
    options: [
      "Anuncio falso o engañoso",
      "Las fotos no corresponden al lugar",
      "Estafa o fraude",
      "Contenido inapropiado u ofensivo",
      "Propiedad inexistente",
      "Precio incorrecto o engañoso",
      "Otro",
    ],
  },
  user: {
    label: "¿Qué problema tienes con este usuario?",
    options: [
      "Comportamiento inapropiado",
      "Intento de estafa o fraude",
      "Acoso o amenazas",
      "Perfil falso",
      "No responde o cancela sin motivo",
      "Otro",
    ],
  },
  app: {
    label: "¿Qué tipo de problema encontraste?",
    options: [
      "Error o falla técnica",
      "Función que no funciona correctamente",
      "Problema con el pago",
      "Problema con la reservación",
      "La app es lenta o se cierra",
      "Recomendación de mejora",
      "Otro",
    ],
  },
  general: {
    label: "¿Sobre qué quieres reportar?",
    options: [
      "Estafa o fraude",
      "Problema con mi cuenta",
      "Problema con un pago",
      "Problema con una reservación",
      "Contenido inapropiado",
      "Recomendación o sugerencia",
      "Otro",
    ],
  },
};

export default function ReportModal({
  open, onClose, targetType, targetTitle, targetUrl, reporterEmail, reporterName,
}: Props) {
  const [selectedType, setSelectedType] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const config = REPORT_TYPES[targetType];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedType || !description.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          description,
          reporterEmail,
          reporterName,
          targetUrl: targetUrl ?? (typeof window !== "undefined" ? window.location.href : ""),
          targetTitle,
          targetType,
        }),
      });
      if (!res.ok) throw new Error("Error al enviar");
      setSent(true);
    } catch {
      setError("No se pudo enviar el reporte. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setSelectedType("");
    setDescription("");
    setSent(false);
    setError("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Flag size={18} className="text-[var(--color-primary)]" />
            <h3 className="text-body font-semibold text-[var(--text-primary)]">
              {targetType === "property" ? "Reportar anuncio" :
               targetType === "user" ? "Reportar usuario" :
               targetType === "app" ? "Reportar un problema" : "Contactar a Beel"}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          /* Estado: enviado */
          <div className="p-8 text-center flex-1">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={28} className="text-emerald-600" />
            </div>
            <h4 className="text-body font-semibold text-[var(--text-primary)] mb-2">Reporte enviado</h4>
            <p className="text-body-sm text-[var(--text-secondary)] mb-6">
              Gracias por avisarnos. Revisaremos tu reporte y tomaremos las medidas necesarias. Si dejaste tu correo, te responderemos pronto.
            </p>
            <button onClick={handleClose} className="btn btn-primary w-full justify-center">
              Cerrar
            </button>
          </div>
        ) : (
          /* Formulario */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
            <div className="p-5 space-y-4 flex-1">
              {targetTitle && (
                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                  <p className="text-caption text-[var(--text-tertiary)] mb-0.5">Relacionado con</p>
                  <p className="text-body-sm font-medium text-[var(--text-primary)] truncate">{targetTitle}</p>
                </div>
              )}

              {/* Tipo de reporte */}
              <div>
                <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-2">
                  {config.label}
                </label>
                <div className="space-y-1.5">
                  {config.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSelectedType(opt)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 rounded-xl border text-body-sm transition-all",
                        selectedType === opt
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-light)] text-[var(--color-primary)] font-medium"
                          : "border-neutral-200 hover:border-neutral-300 text-[var(--text-secondary)]"
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Descripción */}
              {selectedType && (
                <div>
                  <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                    Describe el problema <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    style={{ fontSize: "16px" }}
                    placeholder="Incluye todos los detalles que puedas. Puedes mencionar fechas, nombres, montos o cualquier información relevante."
                    className="input w-full resize-none"
                    required
                  />
                  <p className="text-caption text-[var(--text-tertiary)] mt-1">
                    Tu reporte llegará a mexicobeel@gmail.com
                    {reporterEmail ? ` y te responderemos a ${reporterEmail}` : ". Si quieres respuesta, inicia sesión antes de reportar"}.
                  </p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-body-sm">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-neutral-100 flex gap-3 flex-shrink-0">
              <button type="button" onClick={handleClose} className="btn btn-outline flex-1">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!selectedType || !description.trim() || sending}
                className="btn btn-primary flex-1 justify-center gap-2 disabled:opacity-50"
              >
                <Send size={14} />
                {sending ? "Enviando..." : "Enviar reporte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
