import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <div className="empty-state min-h-[70vh]">
        <div className="text-6xl">🏡</div>
        <h1 className="text-display font-display text-[var(--text-primary)]">
          Página no encontrada
        </h1>
        <p className="text-body text-[var(--text-secondary)] max-w-sm text-center">
          La página que buscas no existe o fue movida.
        </p>
        <Link href="/" className="btn btn-primary mt-2">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
