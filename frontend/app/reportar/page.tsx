"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AlertTriangle, Send, CheckCircle } from "lucide-react";

const TIPOS = [
  "Problema con una reserva",
  "Problema con un pago o reembolso",
  "Comportamiento inapropiado",
  "Anuncio engañoso o sospechoso",
  "Problema técnico en el sitio",
  "Otro",
];

export default function ReportarPage() {
  const [tipo, setTipo] = useState(TIPOS[0]);
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviado, setEnviado] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mensaje.trim()) return;
    // Compone un correo a soporte con los datos del reporte
    const asunto = encodeURIComponent(`[Reporte] ${tipo}`);
    const cuerpo = encodeURIComponent(
      `Tipo de problema: ${tipo}\nCorreo de contacto: ${email || "(no proporcionado)"}\n\nDescripción:\n${mensaje}`
    );
    window.location.href = `mailto:hola@beel-mx.com?subject=${asunto}&body=${cuerpo}`;
    setEnviado(true);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center mb-5">
          <AlertTriangle size={22} className="text-[var(--color-primary)]" />
        </div>
        <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-2">
          Reportar un problema
        </h1>
        <p className="text-body text-[var(--text-secondary)] mb-8">
          Cuéntanos qué ocurrió y nuestro equipo lo revisará lo antes posible. Si es
          sobre una reserva, incluye las fechas o el nombre de la propiedad.
        </p>

        {enviado ? (
          <div className="card p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={26} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-2">
              Abriendo tu correo…
            </h2>
            <p className="text-body-sm text-[var(--text-secondary)]">
              Se abrió tu aplicación de correo con el reporte listo para enviar a{" "}
              <span className="font-medium text-[var(--text-primary)]">hola@beel-mx.com</span>.
              Si no se abrió, escríbenos directamente a esa dirección.
            </p>
            <button onClick={() => setEnviado(false)} className="btn btn-outline mt-6 px-6 py-2.5">
              Hacer otro reporte
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card p-6 space-y-5">
            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                Tipo de problema
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="input w-full"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                Tu correo <span className="text-[var(--text-tertiary)] font-normal">(para darte seguimiento)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="input w-full"
              />
            </div>

            <div>
              <label className="block text-body-sm font-medium text-[var(--text-primary)] mb-1.5">
                Describe el problema
              </label>
              <textarea
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                required
                rows={5}
                placeholder="Cuéntanos qué pasó con el mayor detalle posible…"
                className="input w-full resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={!mensaje.trim()}
              className="btn btn-primary w-full justify-center py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              Enviar reporte
            </button>
            <p className="text-caption text-[var(--text-tertiary)] text-center">
              Al enviar se abrirá tu aplicación de correo con el reporte listo para hola@beel-mx.com.
            </p>
          </form>
        )}
      </main>

      <Footer />
    </div>
  );
}
