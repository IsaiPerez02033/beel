"use client";

import { useSession, signOut as nextSignOut } from "next-auth/react";
import { useCallback } from "react";

const MOCK_AUTH = {
  isSignedIn: false,
  isLoaded: true,
  userId: null,
  sessionId: null,
  getToken: async () => null,
  signOut: () => Promise.resolve(),
  orgId: null,
  orgRole: null,
  orgSlug: null,
  has: () => false,
};

export function useAuth() {
  try {
    const { data: session, status } = useSession();
    const getToken = useCallback(async (): Promise<string | null> => {
      // No intentar obtener token si la sesión aún está cargando
      if (status === "loading") return null;
      if (!session?.user?.id) return null;
      try {
        const res = await fetch("/api/auth/token");
        if (!res.ok) return null;
        const data = await res.json();
        return data.token ?? null;
      } catch {
        return null;
      }
    }, [session, status]);

    return {
      isSignedIn: !!session?.user,
      isLoaded: status !== "loading",
      userId: session?.user?.id ?? null,
      sessionId: null,
      getToken,
      signOut: () => nextSignOut({ callbackUrl: "/" }),
      orgId: null,
      orgRole: null,
      orgSlug: null,
      has: () => false,
    };
  } catch {
    return MOCK_AUTH;
  }
}
