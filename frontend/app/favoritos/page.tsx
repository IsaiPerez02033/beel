"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Heart } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PropertyCard from "@/components/PropertyCard";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useSafeAuth";
import { useFavorites } from "@/contexts/FavoritesContext";
import type { Property } from "@/types";

export default function FavoritosPage() {
  const router = useRouter();
  const { get } = useApi();
  const { isSignedIn, isLoaded } = useAuth();
  // Releer cuando cambian los favoritos para reflejar quitados al instante
  const { isFavorite } = useFavorites();

  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/iniciar-sesion?callbackUrl=/favoritos");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn) return;
    get<Property[]>("/favorites")
      .then(setProperties)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isSignedIn, get]);

  // Solo mostrar las que siguen siendo favoritas (permite quitar en vivo)
  const visible = properties.filter((p) => isFavorite(p.id));

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-display font-display font-semibold text-[var(--text-primary)] mb-6">Favoritos</h1>

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
          </div>
        ) : visible.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center mx-auto mb-4">
              <Heart size={26} className="text-[var(--color-primary)]" />
            </div>
            <h2 className="text-h2 font-semibold text-[var(--text-primary)] mb-1">Aún no tienes favoritos</h2>
            <p className="text-body text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
              Toca el corazón en cualquier hospedaje para guardarlo aquí y verlo después.
            </p>
            <Link href="/buscar" className="btn btn-primary px-6 py-2.5">Explorar hospedajes</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visible.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
