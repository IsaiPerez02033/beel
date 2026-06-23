import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, CalendarCheck, Shield, KeyRound, Home, DollarSign, Star, CheckCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Cómo funciona",
  description: "Cómo funciona Beel: reserva hospedaje en Yucatán o publica tu propiedad. Pagos protegidos y sin comisión para anfitriones.",
};

const HUESPED = [
  { icon: Search, titulo: "Busca y explora", desc: "Encuentra hospedajes en Mérida y la Península de Yucatán filtrando por fechas, huéspedes y tipo de propiedad." },
  { icon: CalendarCheck, titulo: "Reserva tus fechas", desc: "Elige tus fechas y envía tu solicitud. Si la propiedad tiene reserva inmediata, queda confirmada al instante." },
  { icon: Shield, titulo: "Paga de forma segura", desc: "Tu pago queda protegido por Beel y solo se libera al anfitrión cuando tu estancia se completa sin problemas." },
  { icon: KeyRound, titulo: "Disfruta tu estancia", desc: "Recibe los detalles de tu hospedaje y coordina tu llegada con el anfitrión. Al terminar, deja tu reseña." },
];

const ANFITRION = [
  { icon: Home, titulo: "Publica tu espacio", desc: "Agrega fotos, descripción, precio y disponibilidad. Toma menos de 10 minutos." },
  { icon: CheckCircle, titulo: "Verifícate", desc: "Confirma tu teléfono e identidad. Esto genera confianza y es obligatorio para recibir reservas." },
  { icon: CalendarCheck, titulo: "Recibe solicitudes", desc: "Tú decides a quién aceptas. Tienes 24 horas para confirmar cada solicitud de reserva." },
  { icon: DollarSign, titulo: "Cobra sin comisión", desc: "Recibes el 100% del precio que defines. Beel no cobra comisión durante los primeros años." },
];

export default function ComoFuncionaPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      {/* Hero */}
      <section className="bg-[var(--color-arena)] pt-16 pb-16 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-4">
            Cómo funciona Beel
          </h1>
          <p className="text-body-lg text-[var(--text-secondary)]">
            Conectamos a viajeros con anfitriones locales en Yucatán. Pagos
            protegidos, anfitriones verificados y sin comisión para quien hospeda.
          </p>
        </div>
      </section>

      {/* Para huéspedes */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] text-center mb-3">
          Si buscas hospedaje
        </h2>
        <p className="text-body text-[var(--text-secondary)] text-center mb-12 max-w-xl mx-auto">
          Reservar en Beel es simple y seguro.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HUESPED.map((p, i) => (
            <Step key={p.titulo} n={i + 1} icon={<p.icon size={22} className="text-[var(--color-primary)]" />} titulo={p.titulo} desc={p.desc} />
          ))}
        </div>
        <div className="text-center mt-10">
          <Link href="/buscar" className="btn btn-primary px-8 py-3">Explorar hospedajes</Link>
        </div>
      </section>

      {/* Para anfitriones */}
      <section className="bg-[var(--bg-subtle)] py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] text-center mb-3">
            Si quieres hospedar
          </h2>
          <p className="text-body text-[var(--text-secondary)] text-center mb-12 max-w-xl mx-auto">
            Convierte tu espacio en ingresos, sin pagar comisión.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ANFITRION.map((p, i) => (
              <Step key={p.titulo} n={i + 1} icon={<p.icon size={22} className="text-[var(--color-primary)]" />} titulo={p.titulo} desc={p.desc} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/ser-anfitrion" className="btn btn-outline px-8 py-3">Conviértete en anfitrión</Link>
          </div>
        </div>
      </section>

      {/* Pagos protegidos */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
          <Shield size={26} className="text-[var(--color-primary)]" />
        </div>
        <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-3">
          Pagos protegidos
        </h2>
        <p className="text-body text-[var(--text-secondary)] max-w-lg mx-auto">
          Cuando un huésped paga, Beel retiene el dinero como garantía. El pago se
          libera al anfitrión solo cuando la estancia se completa correctamente. Si
          algo sale mal antes del check-in, podemos emitir un reembolso. Así
          protegemos a ambas partes en cada reserva.
        </p>
      </section>

      <Footer />
    </div>
  );
}

function Step({ n, icon, titulo, desc }: { n: number; icon: React.ReactNode; titulo: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4 relative">
        {icon}
        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-caption font-semibold flex items-center justify-center">
          {n}
        </span>
      </div>
      <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1.5">{titulo}</h3>
      <p className="text-body-sm text-[var(--text-secondary)]">{desc}</p>
    </div>
  );
}
