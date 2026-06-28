"use client";

import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, CreditCard, Home, Shield, Flag, AlertTriangle, Bug, MessageSquare, Star } from "lucide-react";
import ReportButton from "@/components/ReportButton";


const CATEGORIAS = [
  {
    icon: Search,
    titulo: "Reservaciones",
    faqs: [
      { q: "¿Cómo reservo un hospedaje?", a: "Busca por fechas y huéspedes, elige una propiedad y envía tu solicitud. Si tiene reserva inmediata, queda confirmada al instante; si no, el anfitrión tiene 24 horas para confirmar." },
      { q: "¿Cuándo se confirma mi reserva?", a: "En propiedades con reserva inmediata, al pagar. En el resto, cuando el anfitrión acepta tu solicitud dentro de las 24 horas." },
      { q: "¿Dónde veo mis reservas?", a: "En la sección 'Reservaciones' de tu cuenta, donde puedes ver el estado, las fechas y los detalles de cada estancia." },
    ],
  },
  {
    icon: CreditCard,
    titulo: "Pagos",
    faqs: [
      { q: "¿Cómo se procesan los pagos?", a: "Los pagos se procesan de forma segura a través de nuestro proveedor (MercadoPago). Beel retiene el dinero hasta que tu estancia se completa correctamente." },
      { q: "¿En qué moneda pago?", a: "Los precios se muestran en pesos mexicanos (MXN). Puedes ver el equivalente en USD con el selector de moneda, pero el cobro se realiza en MXN." },
      { q: "¿Cuándo recibe el pago el anfitrión?", a: "El pago se libera al anfitrión una vez completada la estancia, tras la aprobación de Beel." },
    ],
  },
  {
    icon: Home,
    titulo: "Para anfitriones",
    faqs: [
      { q: "¿Cómo publico mi propiedad?", a: "Verifica tu teléfono e identidad, luego agrega fotos, descripción, precio y disponibilidad desde tu panel de anfitrión." },
      { q: "¿Por qué debo verificarme?", a: "La verificación de teléfono e identidad es obligatoria para anfitriones. Genera confianza con los huéspedes y mantiene segura la plataforma." },
      { q: "¿Cuánto cobra Beel de comisión?", a: "Durante los primeros años, Beel no cobra comisión. Recibes el 100% del precio que defines." },
    ],
  },
  {
    icon: Shield,
    titulo: "Cuenta y seguridad",
    faqs: [
      { q: "¿Cómo cambio mi foto o datos?", a: "Desde la configuración de tu cuenta puedes actualizar tu foto de perfil, nombre y datos de contacto." },
      { q: "¿Cómo verifico mi identidad?", a: "Desde Configuración → Seguridad, sigue los pasos para verificar tu teléfono y escanear tu documento oficial." },
    ],
  },
];

export default function AyudaPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      <section className="bg-[var(--color-arena)] pt-16 pb-12 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-white/60 flex items-center justify-center mx-auto mb-4">
            <LifeBuoy size={26} className="text-[var(--color-primary)]" />
          </div>
          <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-3">
            Centro de ayuda
          </h1>
          <p className="text-body-lg text-[var(--text-secondary)]">
            Encuentra respuestas a las preguntas más comunes sobre Beel.
          </p>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 py-14 space-y-12">
        {CATEGORIAS.map((cat) => (
          <section key={cat.titulo}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center">
                <cat.icon size={18} className="text-[var(--color-primary)]" />
              </div>
              <h2 className="text-h2 font-semibold text-[var(--text-primary)]">{cat.titulo}</h2>
            </div>
            <div className="space-y-4">
              {cat.faqs.map((f) => (
                <div key={f.q} className="card p-5">
                  <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1.5">{f.q}</h3>
                  <p className="text-body-sm text-[var(--text-secondary)] leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Sección de reportes */}
        <section>
          <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Flag size={20} className="text-[var(--color-primary)]" />
            Reportar un problema
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <h3 className="text-body font-semibold text-[var(--text-primary)]">Estafa o fraude</h3>
              </div>
              <p className="text-body-sm text-[var(--text-secondary)] mb-3">Sospechas de un anuncio falso, un usuario que pide pagos fuera de Beel, o cualquier intento de fraude.</p>
              <ReportButton targetType="general" label="Reportar estafa o fraude" targetTitle="Estafa o fraude" />
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Bug size={16} className="text-red-500" />
                <h3 className="text-body font-semibold text-[var(--text-primary)]">Falla en la app</h3>
              </div>
              <p className="text-body-sm text-[var(--text-secondary)] mb-3">Algo no funciona correctamente: un error, un botón que no responde, problemas con pagos o reservaciones.</p>
              <ReportButton targetType="app" label="Reportar falla técnica" targetTitle="Falla en la app" />
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={16} className="text-blue-500" />
                <h3 className="text-body font-semibold text-[var(--text-primary)]">Problema con anfitrión o huésped</h3>
              </div>
              <p className="text-body-sm text-[var(--text-secondary)] mb-3">Tuviste una mala experiencia, comportamiento inapropiado, cancelación injustificada u otro conflicto.</p>
              <ReportButton targetType="user" label="Reportar un usuario" targetTitle="Problema con usuario" />
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Star size={16} className="text-[var(--color-primary)]" />
                <h3 className="text-body font-semibold text-[var(--text-primary)]">Sugerencia o mejora</h3>
              </div>
              <p className="text-body-sm text-[var(--text-secondary)] mb-3">¿Tienes una idea para mejorar Beel? Nos encantaría escucharla. Toda retroalimentación es bienvenida.</p>
              <ReportButton targetType="app" label="Enviar sugerencia" targetTitle="Sugerencia de mejora" />
            </div>
          </div>
        </section>

        <div className="card p-6 text-center bg-[var(--bg-subtle)]">
          <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1.5">
            ¿No encontraste lo que buscabas?
          </h3>
          <p className="text-body-sm text-[var(--text-secondary)] mb-4">
            Nuestro equipo está listo para ayudarte.
          </p>
          <Link href="/contacto" className="btn btn-primary px-6 py-2.5">Contactar soporte</Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
