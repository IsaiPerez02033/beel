import Link from "next/link";
import CurrencySwitcher from "@/components/CurrencySwitcher";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Asistencia",
    links: [
      { label: "Centro de ayuda", href: "/ayuda" },
      { label: "Opciones de cancelación", href: "/cancelacion" },
      { label: "Confianza y seguridad", href: "/confianza" },
      { label: "Reportar un problema", href: "/reportar" },
    ],
  },
  {
    title: "Cómo ser anfitrión",
    links: [
      { label: "Conviértete en anfitrión", href: "/ser-anfitrion" },
      { label: "Verificación de identidad", href: "/anfitrion/configuracion?seccion=seguridad" },
      { label: "Cómo funcionan los pagos", href: "/como-funciona" },
      { label: "Recursos para anfitriones", href: "/ayuda" },
    ],
  },
  {
    title: "Explorar",
    links: [
      { label: "Buscar hospedajes", href: "/buscar" },
      { label: "Mérida, Yucatán", href: "/buscar?destino=Mérida" },
      { label: "Casas", href: "/buscar?tipo=casa" },
      { label: "Villas con alberca", href: "/buscar?tipo=villa" },
    ],
  },
  {
    title: "Beel",
    links: [
      { label: "Cómo funciona", href: "/como-funciona" },
      { label: "Sobre Beel", href: "/sobre" },
      { label: "Contacto", href: "/contacto" },
      { label: "Sin comisión", href: "/ser-anfitrion" },
    ],
  },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[var(--bg-subtle)] border-t border-[var(--border-subtle)] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Columnas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-body-sm font-semibold text-[var(--text-primary)] mb-4">
                {col.title}
              </h3>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-body-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:underline transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Barra inferior */}
        <div className="mt-10 pt-6 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-display font-semibold text-[18px] text-[var(--color-primary)]" style={{ letterSpacing: "-0.5px" }}>
              beel
            </span>
            <span className="text-caption text-[var(--text-tertiary)]">
              © {year} Beel · Mérida, Yucatán, México
            </span>
          </div>
          <div className="flex items-center gap-4 text-caption text-[var(--text-secondary)]">
            <Link href="/privacidad" className="hover:text-[var(--text-primary)] transition-colors">Privacidad</Link>
            <span className="text-[var(--border-strong)]">·</span>
            <Link href="/terminos" className="hover:text-[var(--text-primary)] transition-colors">Términos</Link>
            <span className="text-[var(--border-strong)]">·</span>
            <span>🇲🇽 Español (MX)</span>
            <span className="text-[var(--border-strong)]">·</span>
            <CurrencySwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
