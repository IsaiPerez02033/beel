import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import PostsFeed from "@/components/PostsFeed";

export const metadata: Metadata = {
  title: "Publicaciones — Beel",
  description:
    "Fotos y videos de los anfitriones de Beel: conoce sus espacios, promociones y experiencias.",
};

/** Página dedicada del feed social (estilo pestaña de reels de Instagram). */
export default function PublicacionesPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="pb-10">
        <PostsFeed standalone />
      </main>
    </div>
  );
}
