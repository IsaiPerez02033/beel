import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Mail, MapPin, Clock, HelpCircle, Home } from "lucide-react";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Contacta al equipo de Beel. Soporte para huéspedes y anfitriones en todo México.",
};

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-2">
          Contáctanos
        </h1>
        <p className="text-body-lg text-[var(--text-secondary)] mb-10">
          ¿Tienes una duda o necesitas ayuda? Estamos para apoyarte.
        </p>

        {/* Tarjetas de contacto */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-12">
          <ContactCard
            icon={<Mail size={20} className="text-[var(--color-primary)]" />}
            titulo="Correo"
            desc="Escríbenos y te respondemos lo antes posible."
            action={<a href="mailto:hola@beel-mx.com" className="text-body-sm font-medium text-[var(--color-primary)] hover:underline">hola@beel-mx.com</a>}
          />
          <ContactCard
            icon={<MapPin size={20} className="text-[var(--color-primary)]" />}
            titulo="Ubicación"
            desc="Operamos en todo México."
            action={<span className="text-body-sm font-medium text-[var(--text-primary)]">México</span>}
          />
          <ContactCard
            icon={<Clock size={20} className="text-[var(--color-primary)]" />}
            titulo="Horario de atención"
            desc="Lunes a viernes."
            action={<span className="text-body-sm font-medium text-[var(--text-primary)]">9:00 — 18:00 (hora del centro)</span>}
          />
          <ContactCard
            icon={<HelpCircle size={20} className="text-[var(--color-primary)]" />}
            titulo="Soporte de reservas"
            desc="¿Problema con una reserva activa?"
            action={<a href="mailto:hola@beel-mx.com" className="text-body-sm font-medium text-[var(--color-primary)] hover:underline">hola@beel-mx.com</a>}
          />
        </div>

        {/* Bloque para anfitriones */}
        <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex gap-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
              <Home size={20} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1">
                ¿Quieres publicar tu propiedad?
              </h3>
              <p className="text-body-sm text-[var(--text-secondary)]">
                Conoce cómo hospedar en Beel sin pagar comisión.
              </p>
            </div>
          </div>
          <a href="/ser-anfitrion" className="btn btn-primary px-6 py-2.5 whitespace-nowrap">
            Ser anfitrión
          </a>
        </div>

        <p className="text-caption text-[var(--text-tertiary)] mt-8">
          Los correos mostrados son de referencia para esta etapa. Te
          responderemos por la misma vía por la que nos escribas.
        </p>
      </main>

      <Footer />
    </div>
  );
}

function ContactCard({ icon, titulo, desc, action }: { icon: React.ReactNode; titulo: string; desc: string; action: React.ReactNode }) {
  return (
    <div className="card p-6">
      <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1">{titulo}</h3>
      <p className="text-body-sm text-[var(--text-secondary)] mb-3">{desc}</p>
      {action}
    </div>
  );
}
