import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ShieldCheck, UserCheck, Lock, Eye, AlertTriangle, MessageSquare } from "lucide-react";

export const metadata: Metadata = {
  title: "Confianza y seguridad",
  description: "Cómo Beel protege a huéspedes y anfitriones: verificación de identidad, pagos protegidos y privacidad de datos.",
};

const PILARES = [
  { icon: UserCheck, titulo: "Anfitriones verificados", desc: "Para publicar, todo anfitrión debe verificar su número de teléfono y su identidad con un documento oficial y verificación facial. Así sabes con quién tratas." },
  { icon: Lock, titulo: "Pagos protegidos", desc: "Beel retiene el pago como garantía y solo lo libera al anfitrión cuando la estancia se completa correctamente. Si algo falla antes del check-in, podemos reembolsar." },
  { icon: Eye, titulo: "Privacidad de tus datos", desc: "Tratamos tus datos conforme a la ley mexicana (LFPDPPP). No vendemos tu información y los datos sensibles de verificación solo se usan para confirmar tu identidad." },
  { icon: ShieldCheck, titulo: "Reseñas reales", desc: "Solo quienes completaron una estancia pueden dejar reseña. Eso mantiene las calificaciones honestas y útiles para todos." },
];

const CONSEJOS_HUESPED = [
  "Lee las reseñas y revisa la calificación del anfitrión antes de reservar.",
  "Realiza siempre el pago dentro de la plataforma; nunca por transferencia directa.",
  "Revisa la política de cancelación y las reglas de la propiedad antes de confirmar.",
  "Mantén la comunicación y los acuerdos dentro de Beel.",
];

const CONSEJOS_ANFITRION = [
  "Completa tu verificación de teléfono e identidad para generar confianza.",
  "Describe tu propiedad con fotos reales y reglas claras para evitar malentendidos.",
  "Confirma o rechaza las solicitudes dentro de las 24 horas.",
  "Reporta cualquier comportamiento sospechoso a nuestro equipo.",
];

export default function ConfianzaPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      <section className="bg-[var(--color-arena)] pt-16 pb-12 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-white/60 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={26} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-3">
            Confianza y seguridad
          </h1>
          <p className="text-body-lg text-[var(--text-secondary)]">
            La confianza es la base de Beel. Así protegemos a huéspedes y anfitriones
            en cada reserva.
          </p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 py-14">
        {/* Pilares */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
          {PILARES.map((p) => (
            <div key={p.titulo} className="card p-6 flex gap-4">
              <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
                <p.icon size={20} className="text-[var(--color-primary)]" />
              </div>
              <div>
                <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1">{p.titulo}</h3>
                <p className="text-body-sm text-[var(--text-secondary)]">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Consejos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-14">
          <Consejos titulo="Consejos para huéspedes" items={CONSEJOS_HUESPED} />
          <Consejos titulo="Consejos para anfitriones" items={CONSEJOS_ANFITRION} />
        </div>

        {/* Reportar */}
        <div className="card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex gap-4">
            <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1">
                ¿Viste algo que no parece correcto?
              </h3>
              <p className="text-body-sm text-[var(--text-secondary)]">
                Repórtalo y nuestro equipo lo revisará lo antes posible.
              </p>
            </div>
          </div>
          <Link href="/reportar" className="btn btn-primary px-6 py-2.5 whitespace-nowrap">
            Reportar un problema
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Consejos({ titulo, items }: { titulo: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-h3 font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
        <MessageSquare size={16} className="text-[var(--color-primary)]" />
        {titulo}
      </h2>
      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c} className="flex items-start gap-2 text-body-sm text-[var(--text-secondary)]">
            <span className="text-[var(--color-primary)] mt-0.5">•</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
