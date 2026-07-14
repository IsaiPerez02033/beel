import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Aviso de Privacidad",
  description: "Aviso de Privacidad de Beel — cómo recabamos, usamos y protegemos tus datos personales.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-display font-display font-medium text-[var(--text-primary)] mb-2">
          Aviso de Privacidad
        </h1>
        <p className="text-body-sm text-[var(--text-tertiary)] mb-8">
          Última actualización: julio de 2026
        </p>

        <div className="space-y-8 text-body text-[var(--text-secondary)] leading-relaxed">
          <Section title="1. Identidad y domicilio del responsable">
            <p>
              Beel ("nosotros", "la plataforma") es responsable del tratamiento de tus
              datos personales conforme a la Ley Federal de Protección de Datos Personales
              en Posesión de los Particulares (LFPDPPP) de México. Domicilio: México.
              Contacto: <a className="text-[var(--color-primary)] hover:underline" href="mailto:hola@beel-mx.com">hola@beel-mx.com</a>.
            </p>
          </Section>

          <Section title="2. Datos personales que recabamos">
            <p>Para prestar nuestros servicios podemos recabar:</p>
            <Ul items={[
              "Datos de identificación: nombre completo, correo electrónico, número de teléfono y fotografía de perfil.",
              "Datos de verificación de identidad: imagen de tu documento oficial (INE o pasaporte) y verificación facial (liveness), procesados por nuestro proveedor de verificación.",
              "Datos de las propiedades y experiencias que publicas: dirección o ubicación, fotos, descripción, precios y disponibilidad.",
              "Contenido que publicas: publicaciones, historias y videos cortos (fotos y videos), que son de carácter público dentro de la plataforma.",
              "Datos de comunicaciones: contenido de los mensajes, fotos y archivos que intercambias con otros usuarios a través de la mensajería.",
              "Consultas al Concierge: el contenido de las conversaciones que mantienes con nuestro asistente de viajes con inteligencia artificial.",
              "Datos de reservaciones y pagos: historial de reservas de alojamientos y experiencias, la tarifa de servicio y datos de la transacción (procesados por nuestro proveedor de pagos).",
              "Datos de notificaciones: la suscripción push de tu navegador o dispositivo, si activas las notificaciones.",
              "Datos técnicos: dirección IP, tipo de dispositivo y navegador.",
            ]} />
          </Section>

          <Section title="3. Finalidades del tratamiento">
            <p>Usamos tus datos para las siguientes finalidades primarias:</p>
            <Ul items={[
              "Crear y administrar tu cuenta.",
              "Verificar tu identidad y número de teléfono (obligatorio para anfitriones).",
              "Publicar y gestionar propiedades, experiencias y reservaciones.",
              "Habilitar la mensajería entre usuarios y el contenido público (publicaciones e historias).",
              "Ofrecer el planeador de viajes con inteligencia artificial (Concierge).",
              "Enviarte notificaciones push sobre tus reservas, mensajes y actividad, cuando las actives.",
              "Procesar pagos, la tarifa de servicio y, en su caso, reembolsos.",
              "Comunicarnos contigo sobre tus reservas y tu cuenta.",
              "Prevenir fraudes y mantener la seguridad de la plataforma.",
            ]} />
          </Section>

          <Section title="4. Datos personales sensibles">
            <p>
              Para la verificación de identidad tratamos datos biométricos (rasgos
              faciales) e imágenes de documentos oficiales. Estos datos se procesan
              únicamente para confirmar tu identidad, a través de un proveedor
              especializado de verificación (KYC), y no se utilizan para ningún otro fin.
              Al iniciar la verificación, otorgas tu consentimiento expreso para este
              tratamiento.
            </p>
          </Section>

          <Section title="5. Transferencias de datos">
            <p>
              Compartimos datos con proveedores que nos ayudan a operar la plataforma,
              quienes están obligados a proteger tu información:
            </p>
            <Ul items={[
              "Proveedor de verificación de identidad (KYC) — para validar tu documento y rostro.",
              "Proveedor de mensajería (SMS/WhatsApp) — para enviar códigos de verificación.",
              "Procesador de pagos — para gestionar cobros, pagos a anfitriones y reembolsos.",
              "Proveedor de inteligencia artificial — cuando usas el Concierge, el contenido de tu conversación se procesa a través de un proveedor externo de modelos de IA para generar las respuestas.",
              "Proveedores de infraestructura (hosting y base de datos) — para almacenar la información de forma segura.",
            ]} />
            <p>
              Algunos de estos proveedores (por ejemplo, el de inteligencia artificial)
              pueden estar ubicados fuera de México, por lo que ciertos datos pueden ser
              objeto de una <strong>transferencia internacional</strong>. En todos los casos
              exigimos que traten tu información con medidas de protección adecuadas y
              únicamente para prestar el servicio contratado.
            </p>
            <p>No vendemos tus datos personales a terceros.</p>
          </Section>

          <Section title="6. Derechos ARCO">
            <p>
              Tienes derecho a Acceder, Rectificar, Cancelar tus datos personales u
              Oponerte a su tratamiento, así como a revocar tu consentimiento. Para
              ejercer estos derechos, escríbenos a{" "}
              <a className="text-[var(--color-primary)] hover:underline" href="mailto:hola@beel-mx.com">hola@beel-mx.com</a>{" "}
              indicando tu solicitud y los datos involucrados.
            </p>
          </Section>

          <Section title="7. Cookies, notificaciones y tecnologías similares">
            <p>
              Usamos cookies y almacenamiento local para mantener tu sesión iniciada y
              mejorar tu experiencia. Puedes deshabilitarlas desde tu navegador, aunque
              algunas funciones podrían no operar correctamente.
            </p>
            <p className="mt-3">
              Si activas las notificaciones push, tu navegador o dispositivo genera una
              suscripción que usamos únicamente para enviarte avisos sobre tus reservas,
              mensajes y actividad. Puedes revocar este permiso en cualquier momento desde la
              configuración de tu navegador o dispositivo.
            </p>
          </Section>

          <Section title="8. Conservación y seguridad">
            <p>
              Conservamos tus datos mientras tu cuenta esté activa y durante el tiempo
              necesario para cumplir obligaciones legales. Implementamos medidas técnicas
              y organizativas razonables para proteger tu información.
            </p>
          </Section>

          <Section title="9. Cambios a este aviso">
            <p>
              Podemos actualizar este Aviso de Privacidad. Publicaremos cualquier cambio
              en esta página con su nueva fecha de actualización.
            </p>
          </Section>

          <Section title="10. Contacto">
            <p>
              Para cualquier duda sobre este aviso o el tratamiento de tus datos,
              contáctanos en{" "}
              <a className="text-[var(--color-primary)] hover:underline" href="mailto:hola@beel-mx.com">hola@beel-mx.com</a>.
            </p>
          </Section>

          <p className="text-caption text-[var(--text-tertiary)] pt-4 border-t border-[var(--border-subtle)]">
            Este documento es un aviso de privacidad de carácter general. Te recomendamos
            consultarlo con un profesional legal antes de su uso definitivo en producción.
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
