import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: "Términos y Condiciones de uso de Beel — plataforma de hospedaje en Yucatán, México.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-2">
          Términos y Condiciones
        </h1>
        <p className="text-body-sm text-[var(--text-tertiary)] mb-8">
          Última actualización: junio de 2026
        </p>

        <div className="space-y-8 text-body text-[var(--text-secondary)] leading-relaxed">
          <Section title="1. Aceptación de los términos">
            <p>
              Al crear una cuenta o usar Beel ("la plataforma"), aceptas estos Términos y
              Condiciones. Si no estás de acuerdo, no utilices la plataforma.
            </p>
          </Section>

          <Section title="2. Descripción del servicio">
            <p>
              Beel es una plataforma que conecta a personas que ofrecen hospedaje
              ("anfitriones") con personas que buscan reservarlo ("huéspedes") en Mérida y
              la Península de Yucatán. Beel actúa como intermediario tecnológico; no es
              propietario, administrador ni operador de las propiedades publicadas.
            </p>
          </Section>

          <Section title="3. Registro y cuenta">
            <p>
              Debes ser mayor de edad y proporcionar información veraz al registrarte.
              Eres responsable de mantener la confidencialidad de tu cuenta y de toda la
              actividad realizada con ella.
            </p>
          </Section>

          <Section title="4. Verificación obligatoria para anfitriones">
            <p>
              Para publicar una propiedad y recibir reservaciones, debes completar dos
              verificaciones obligatorias:
            </p>
            <Ul items={[
              "Verificación de número de teléfono mediante un código por SMS o WhatsApp.",
              "Verificación de identidad mediante un documento oficial (INE o pasaporte) y verificación facial.",
            ]} />
            <p>
              Beel se reserva el derecho de suspender cuentas que no completen estas
              verificaciones o que proporcionen información falsa.
            </p>
          </Section>

          <Section title="5. Rol de Beel y pagos">
            <p>
              Los pagos de los huéspedes son retenidos por Beel como garantía hasta que la
              estancia se completa satisfactoriamente, momento en el que se libera el pago
              al anfitrión. Durante los primeros años, Beel <strong>no cobra comisión</strong>{" "}
              a los anfitriones; el anfitrión recibe el 100% del precio que define. Pueden
              aplicar comisiones del procesador de pagos.
            </p>
          </Section>

          <Section title="6. Responsabilidades del anfitrión">
            <Ul items={[
              "Proporcionar información veraz y actualizada sobre la propiedad.",
              "Cumplir con las leyes locales aplicables (uso de suelo, fiscales, etc.).",
              "Mantener la propiedad en las condiciones descritas en el anuncio.",
              "Respetar las reservas confirmadas y la política de cancelación elegida.",
            ]} />
          </Section>

          <Section title="7. Responsabilidades del huésped">
            <Ul items={[
              "Usar la propiedad de forma responsable y conforme a las reglas del anfitrión.",
              "Pagar el monto total de la reserva a través de la plataforma.",
              "Comunicar cualquier incidencia de manera oportuna.",
            ]} />
          </Section>

          <Section title="8. Cancelaciones y reembolsos">
            <p>
              Cada propiedad tiene una política de cancelación (flexible, moderada o
              estricta) definida por el anfitrión. Los reembolsos se procesan conforme a
              dicha política. En casos justificados, Beel puede emitir un reembolso al
              huésped a través del procesador de pagos.
            </p>
          </Section>

          <Section title="9. Contenido y conducta">
            <p>
              No se permite publicar contenido falso, ofensivo, ilegal o que infrinja
              derechos de terceros. Beel puede retirar contenido o suspender cuentas que
              violen estos términos.
            </p>
          </Section>

          <Section title="10. Limitación de responsabilidad">
            <p>
              Beel no es responsable por la calidad, seguridad o legalidad de las
              propiedades, ni por la conducta de anfitriones o huéspedes. El uso de la
              plataforma es bajo tu propio riesgo, en la medida permitida por la ley.
            </p>
          </Section>

          <Section title="11. Modificaciones">
            <p>
              Podemos modificar estos Términos en cualquier momento. Los cambios entran en
              vigor al publicarse en esta página. El uso continuado de la plataforma
              implica la aceptación de los términos vigentes.
            </p>
          </Section>

          <Section title="12. Ley aplicable y jurisdicción">
            <p>
              Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos.
              Cualquier controversia se someterá a los tribunales competentes de Mérida,
              Yucatán, renunciando a cualquier otro fuero.
            </p>
          </Section>

          <Section title="13. Contacto">
            <p>
              Para cualquier duda sobre estos Términos, escríbenos a{" "}
              <a className="text-[var(--color-primary)] hover:underline" href="mailto:hola@beel.mx">hola@beel.mx</a>.
            </p>
          </Section>

          <p className="text-caption text-[var(--text-tertiary)] pt-4 border-t border-[var(--border-subtle)]">
            Este documento es una plantilla de términos de carácter general. Te
            recomendamos consultarlo con un profesional legal antes de su uso definitivo
            en producción.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-h3 font-semibold text-[var(--text-primary)] mb-3">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}
