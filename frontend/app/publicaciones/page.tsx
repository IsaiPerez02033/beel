import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import StoriesCarousel from "@/components/StoriesCarousel";
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
        {/* Historias de anfitriones (24h), arriba del feed como en Instagram */}
        <StoriesCarousel />
        <PostsFeed standalone />
      </main>
    </div>
  );
}
