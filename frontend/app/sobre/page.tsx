import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { MapPin, Heart, Shield, DollarSign } from "lucide-react";

export const metadata: Metadata = {
  title: "Sobre Beel",
  description: "Beel es la plataforma de hospedaje hecha en México: para anfitriones locales, sin comisión y con pagos protegidos.",
};

const VALORES = [
  { icon: MapPin, titulo: "Local de verdad", desc: "Nacimos en México. Entendemos el mercado, los precios en pesos y las necesidades de quienes hospedan en el país." },
  { icon: DollarSign, titulo: "Sin comisión", desc: "Creemos que los anfitriones deben quedarse con lo que ganan. Por eso no cobramos comisión durante los primeros años." },
  { icon: Shield, titulo: "Confianza primero", desc: "Verificación de identidad obligatoria para anfitriones y pagos protegidos en cada reserva. La seguridad no es opcional." },
  { icon: Heart, titulo: "Soporte cercano", desc: "Un equipo local que responde, no un call center internacional. Estamos para ayudar a anfitriones y huéspedes por igual." },
];

export default function SobrePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />

      {/* Hero */}
      <section className="bg-[var(--color-arena)] pt-16 pb-16 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-4">
            Hospedaje hecho en México
          </h1>
          <p className="text-body-lg text-[var(--text-secondary)]">
            Beel es una plataforma de hospedaje pensada para México: para
            anfitriones locales y para viajeros que buscan un lugar auténtico
            donde quedarse.
          </p>
        </div>
      </section>

      {/* Misión */}
      <section className="max-w-3xl mx-auto px-4 py-16">
        <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-4">
          Nuestra misión
        </h2>
        <div className="space-y-4 text-body text-[var(--text-secondary)] leading-relaxed">
          <p>
            Las grandes plataformas de hospedaje cobran comisiones altas y tratan
            a México como un mercado más. Beel nace para hacer lo contrario:
            poner primero a los anfitriones locales, con reglas justas y
            herramientas hechas para el país.
          </p>
          <p>
            Queremos que publicar un espacio sea fácil, que cobrar sea transparente
            y que tanto huéspedes como anfitriones se sientan protegidos en cada
            reserva. Sin letras chiquitas y sin comisiones que se comen tus
            ganancias.
          </p>
          <p>
            Empezamos en México, con la meta de crecer a nivel mundial cuidando
            lo que nos hace distintos: cercanía, confianza y un trato justo para
            quien hospeda.
          </p>
        </div>
      </section>

      {/* Valores */}
      <section className="bg-[var(--bg-subtle)] py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] text-center mb-12">
            En qué creemos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALORES.map((v) => (
              <div key={v.titulo} className="card p-6 flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
                  <v.icon size={20} className="text-[var(--color-primary)]" />
                </div>
                <div>
                  <h3 className="text-body font-semibold text-[var(--text-primary)] mb-1">{v.titulo}</h3>
                  <p className="text-body-sm text-[var(--text-secondary)]">{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-h1 font-display font-medium text-[var(--text-primary)] mb-3">
          ¿Listo para empezar?
        </h2>
        <p className="text-body text-[var(--text-secondary)] mb-6">
          Explora hospedajes o publica tu propiedad hoy mismo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/buscar" className="btn btn-primary px-8 py-3">Explorar hospedajes</Link>
          <Link href="/ser-anfitrion" className="btn btn-outline px-8 py-3">Ser anfitrión</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
