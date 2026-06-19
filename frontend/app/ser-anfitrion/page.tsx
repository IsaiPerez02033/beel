import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import { DollarSign, Shield, Star, Home, Clock, HeartHandshake } from "lucide-react";

export const metadata: Metadata = {
  title: "Conviértete en anfitrión — Beel",
  description:
    "Publica tu propiedad en Beel y empieza a recibir huéspedes en Mérida y la Península de Yucatán. Sin comisión durante los primeros años.",
};

const PASOS = [
  {
    num: "01",
    titulo: "Publica tu espacio",
    desc: "Agrega fotos, descripción, precio y disponibilidad. Solo tarda 10 minutos.",
  },
  {
    num: "02",
    titulo: "Recibe solicitudes",
    desc: "Los huéspedes te enviarán solicitudes. Tú decides a quién aceptas.",
  },
  {
    num: "03",
    titulo: "Da la bienvenida",
    desc: "Recibe a tu huésped. Beel retiene el pago hasta confirmar que todo salió bien.",
  },
  {
    num: "04",
    titulo: "Cobra sin comisión",
    desc: "Recibes el 100% del pago. Beel no cobra comisión durante los primeros años.",
  },
];

const BENEFICIOS = [
  {
    icon: <DollarSign size={22} className="text-[var(--color-primary)]" />,
    titulo: "Sin comisión",
    desc: "Beel no cobra porcentaje sobre tus reservas. Lo que acuerdas con el huésped es todo tuyo.",
  },
  {
    icon: <Shield size={22} className="text-[var(--color-primary)]" />,
    titulo: "Pagos protegidos",
    desc: "El dinero queda retenido por Beel hasta que la estancia se completa exitosamente.",
  },
  {
    icon: <Clock size={22} className="text-[var(--color-primary)]" />,
    titulo: "Tú controlas tu calendario",
    desc: "Bloquea fechas, define precios por temporada y establece tus propias reglas de estancia.",
  },
  {
    icon: <Star size={22} className="text-[var(--color-primary)]" />,
    titulo: "Crece tu reputación",
    desc: "Las reseñas verificadas de huéspedes reales construyen tu perfil de anfitrión.",
  },
  {
    icon: <HeartHandshake size={22} className="text-[var(--color-primary)]" />,
    titulo: "Soporte local",
    desc: "Equipo en Mérida listo para ayudarte. No somos un call center internacional.",
  },
  {
    icon: <Home size={22} className="text-[var(--color-primary)]" />,
    titulo: "Enfocado en Yucatán",
    desc: "Plataforma hecha para el mercado local, con búsquedas y precios en MXN.",
  },
];

const FAQS = [
  {
    q: "¿Cuánto cobra Beel por cada reserva?",
    a: "Durante los primeros años, Beel no cobra comisión. El precio que publicas es el 100% que recibes.",
  },
  {
    q: "¿Cómo recibo el pago?",
    a: "El huésped paga al confirmar la reserva. Beel retiene el dinero como garantía y lo libera a tu cuenta cuando la estancia se completa sin incidentes.",
  },
  {
    q: "¿Qué pasa si un huésped cancela?",
    a: "Depende de la política de cancelación que elijas al publicar tu propiedad: flexible, moderada o estricta.",
  },
  {
    q: "¿Necesito ser propietario para publicar?",
    a: "No necesariamente. Puedes publicar si tienes autorización del propietario para rentar el espacio.",
  },
  {
    q: "¿Puedo publicar más de una propiedad?",
    a: "Sí, puedes gestionar múltiples propiedades desde tu panel de anfitrión.",
  },
];

export default function SerAnfitrionPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-[var(--color-arena)] pt-16 pb-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <span className="badge badge-verified mb-4 inline-block">Sin comisión</span>
          <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-4">
            Convierte tu espacio en{" "}
            <span className="text-[var(--color-primary)]">ingresos</span>
          </h1>
          <p className="text-body-lg text-[var(--text-secondary)] mb-8 max-w-xl mx-auto">
            Publica tu propiedad en Beel y empieza a recibir huéspedes en Mérida y
            la Península de Yucatán. Sin comisión. Sin complicaciones.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/registro?redirect_url=/anfitrion" className="btn btn-primary text-body px-8 py-3">
              Publicar mi propiedad
            </Link>
            <Link href="/iniciar-sesion?redirect_url=/anfitrion" className="btn btn-outline text-body px-8 py-3">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] text-center mb-12">
          Así de simple
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PASOS.map((paso) => (
            <div key={paso.num} className="text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
                <span className="text-body-sm font-semibold text-[var(--color-primary)]">
                  {paso.num}
                </span>
              </div>
              <h3 className="text-body font-semibold text-[var(--text-primary)] mb-2">
                {paso.titulo}
              </h3>
              <p className="text-body-sm text-[var(--text-secondary)]">{paso.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Beneficios ───────────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-subtle)] py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] text-center mb-12">
            Por qué anfitriones eligen Beel
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFICIOS.map((b) => (
              <div key={b.titulo} className="card p-5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center mb-4">
                  {b.icon}
                </div>
                <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1.5">
                  {b.titulo}
                </h3>
                <p className="text-body-sm text-[var(--text-secondary)]">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sin comisión callout ─────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="card p-10 border-2 border-[var(--color-primary-light)]">
          <div className="w-14 h-14 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
            <DollarSign size={26} className="text-[var(--color-primary)]" />
          </div>
          <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-3">
            0% de comisión
          </h2>
          <p className="text-body text-[var(--text-secondary)] mb-6 max-w-lg mx-auto">
            Durante los primeros años, Beel no cobra ningún porcentaje sobre tus reservas.
            Publicas, recibes huéspedes y cobras el 100% del precio que tú defines.
          </p>
          <Link href="/registro?redirect_url=/anfitrion" className="btn btn-primary text-body px-8 py-3">
            Empezar gratis
          </Link>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="bg-[var(--bg-subtle)] py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] text-center mb-10">
            Preguntas frecuentes
          </h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <div key={faq.q} className="card p-5">
                <h3 className="text-body font-semibold text-[var(--text-primary)] mb-2">
                  {faq.q}
                </h3>
                <p className="text-body-sm text-[var(--text-secondary)]">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-3">
          ¿Listo para empezar?
        </h2>
        <p className="text-body text-[var(--text-secondary)] mb-8">
          Crea tu cuenta en minutos y publica tu primer hospedaje hoy.
        </p>
        <Link href="/registro?redirect_url=/anfitrion" className="btn btn-primary text-body px-8 py-3">
          Crear cuenta gratis
        </Link>
      </section>

      {/* ── Footer mínimo ────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Image src="/beel_logo_black_sand.png" alt="Beel" width={80} height={32} className="h-7 w-auto" />
          <p className="text-caption text-[var(--text-tertiary)]">
            © {new Date().getFullYear()} Beel. Todos los derechos reservados.
          </p>
          <div className="flex gap-4 text-caption text-[var(--text-secondary)]">
            <Link href="/buscar" className="hover:text-[var(--text-primary)] transition-colors">Explorar</Link>
            <Link href="/ser-anfitrion" className="hover:text-[var(--text-primary)] transition-colors">Ser anfitrión</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
