"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

interface FavoritesContextValue {
  isFavorite: (propertyId: string) => boolean;
  toggleFavorite: (propertyId: string) => Promise<void>;
  ready: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const { get, put, del } = useApi();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn) { setIds(new Set()); setReady(true); return; }
    if (loadedRef.current) return;
    loadedRef.current = true;
    get<string[]>("/favorites/ids")
      .then((arr) => setIds(new Set(arr)))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [isSignedIn, get]);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);

  const toggleFavorite = useCallback(async (id: string) => {
    const wasFav = ids.has(id);
    // Optimista
    setIds((prev) => {
      const next = new Set(prev);
      if (wasFav) next.delete(id); else next.add(id);
      return next;
    });
    try {
      if (wasFav) await del(`/favorites/${id}`);
      else await put(`/favorites/${id}`, {});
    } catch {
      // Revertir si falla
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.add(id); else next.delete(id);
        return next;
      });
    }
  }, [ids, put, del]);

  return (
    <FavoritesContext.Provider value={{ isFavorite, toggleFavorite, ready }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites debe usarse dentro de FavoritesProvider");
  return ctx;
}
