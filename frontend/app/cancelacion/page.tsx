import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Check } from "lucide-react";

export const metadata: Metadata = {
  title: "Opciones de cancelación",
  description: "Conoce las políticas de cancelación de Beel: flexible, moderada y estricta. Cómo funcionan los reembolsos.",
};

const POLITICAS = [
  {
    nombre: "Flexible",
    color: "var(--color-success, #16a34a)",
    resumen: "Reembolso completo hasta 24 horas antes del check-in.",
    detalles: [
      "Cancela hasta 24 h antes de la llegada y recibe el 100% de reembolso.",
      "Si cancelas dentro de las 24 h previas, se reembolsa el monto de las noches no disfrutadas.",
      "Ideal para anfitriones que quieren atraer a más huéspedes.",
    ],
  },
  {
    nombre: "Moderada",
    color: "var(--color-accent, #d97706)",
    resumen: "Reembolso completo hasta 5 días antes del check-in.",
    detalles: [
      "Cancela hasta 5 días antes de la llegada y recibe el 100% de reembolso.",
      "Entre 5 días y el check-in, se reembolsa el 50% de las noches.",
      "Un equilibrio entre flexibilidad para el huésped y certeza para el anfitrión.",
    ],
  },
  {
    nombre: "Estricta",
    color: "var(--color-error, #dc2626)",
    resumen: "Reembolso del 50% hasta 7 días antes del check-in.",
    detalles: [
      "Cancela hasta 7 días antes de la llegada y recibe el 50% de reembolso.",
      "Dentro de los 7 días previos no hay reembolso.",
      "Para propiedades de alta demanda o temporadas concurridas.",
    ],
  },
];

export default function CancelacionPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-2">
          Opciones de cancelación
        </h1>
        <p className="text-body-lg text-[var(--text-secondary)] mb-10">
          Cada propiedad define su política de cancelación. Revísala siempre antes
          de reservar — aparece en la sección de reglas del anuncio.
        </p>

        <div className="space-y-5">
          {POLITICAS.map((p) => (
            <div key={p.nombre} className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                <h2 className="text-h2 font-semibold text-[var(--text-primary)]">{p.nombre}</h2>
              </div>
              <p className="text-body text-[var(--text-secondary)] mb-4">{p.resumen}</p>
              <ul className="space-y-2">
                {p.detalles.map((d) => (
                  <li key={d} className="flex items-start gap-2 text-body-sm text-[var(--text-secondary)]">
                    <Check size={15} className="text-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-6 text-body text-[var(--text-secondary)] leading-relaxed">
          <div>
            <h3 className="text-h3 font-semibold text-[var(--text-primary)] mb-2">¿Cómo cancelo una reserva?</h3>
            <p>
              Entra a la sección <Link href="/reservaciones" className="text-[var(--color-primary)] hover:underline">Reservaciones</Link> de
              tu cuenta, abre la reserva que quieres cancelar y sigue las
              instrucciones. El reembolso se calcula según la política de la propiedad.
            </p>
          </div>
          <div>
            <h3 className="text-h3 font-semibold text-[var(--text-primary)] mb-2">¿Cuánto tarda el reembolso?</h3>
            <p>
              Los reembolsos se procesan a través de nuestro proveedor de pagos y
              pueden tardar de 1 a 15 días hábiles en reflejarse, según el método de
              pago que usaste.
            </p>
          </div>
          <div>
            <h3 className="text-h3 font-semibold text-[var(--text-primary)] mb-2">¿Y si el anfitrión cancela?</h3>
            <p>
              Si un anfitrión cancela una reserva confirmada, recibes el reembolso
              completo de forma automática. Lamentamos cuando esto ocurre y
              trabajamos para que sea excepcional.
            </p>
          </div>
        </div>

        <p className="text-caption text-[var(--text-tertiary)] pt-8 mt-8 border-t border-[var(--border-subtle)]">
          Estas condiciones son una guía general. La política específica y los montos
          aplicables siempre son los indicados en cada propiedad al momento de reservar.
        </p>
      </main>

      <Footer />
    </div>
  );
}
