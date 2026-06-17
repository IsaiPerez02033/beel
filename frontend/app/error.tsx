"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
      <div className="empty-state max-w-md text-center px-4">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-heading font-display text-[var(--text-primary)] mb-2">
          Algo salió mal
        </h2>
        <p className="text-body text-[var(--text-secondary)] mb-6">
          Ocurrió un error inesperado. Intenta de nuevo.
        </p>
        <button onClick={reset} className="btn btn-primary">
          Reintentar
        </button>
      </div>
    </div>
  );
}
