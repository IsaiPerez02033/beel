import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  trustHost: true,  // requerido en Vercel / deploys detrás de proxy
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        try {
          const res = await fetch(`${API}/api/v1/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });
          if (!res.ok) return null;
          const user = await res.json();
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar_url ?? null,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
    // NextAuth v5 lee AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET automáticamente
    Google({}),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Primera vez que el usuario inicia sesión (user está definido)
      if (user) {
        token.sub = user.id;
        token.role = (user as any).role ?? "guest";
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
      }

      // Patrón UUID válido (lo que emite la BD de Beel)
      const isBeelUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      // Google OAuth primer login O tokens rotos donde sub no es UUID de Beel
      const needsBeelId =
        (account?.provider === "google") ||
        (token.email && token.sub && !isBeelUUID.test(token.sub));

      if (needsBeelId && token.email) {
        try {
          const res = await fetch(`${API}/api/v1/users/oauth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: token.email,
              full_name: token.name ?? "",
              google_id: account?.providerAccountId ?? token.sub,
              avatar_url: (user as any)?.image ?? null,
            }),
          });
          if (res.ok) {
            const beelUser = await res.json();
            token.sub = beelUser.id;        // UUID real de Beel
            token.role = beelUser.role ?? "guest";
          }
        } catch {
          // silencioso — el backend rechazará con 401
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      (session.user as any).role = token.role ?? "guest";
      return session;
    },
  },
  pages: {
    signIn: "/iniciar-sesion",
    error: "/iniciar-sesion",
  },
  session: { strategy: "jwt" },
});
