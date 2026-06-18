"use client";

import { useAuth as useClerkAuth } from "@clerk/nextjs";

const HAS_CLERK = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

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

/**
 * Safe useAuth: si Clerk no está configurado, retorna valores mock.
 */
export function useAuth() {
  if (!HAS_CLERK) return MOCK_AUTH;
  return useClerkAuth();
}
