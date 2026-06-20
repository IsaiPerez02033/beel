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
        // Credentials: user.id ya es el UUID de la BD de Beel
        token.sub = user.id;
        token.role = (user as any).role ?? "guest";
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
      }

      // Google OAuth: obtener el UUID de Beel desde el backend
      // Se ejecuta solo en el primer login (account está definido)
      if (account?.provider === "google" && token.email) {
        try {
          const res = await fetch(`${API}/api/v1/users/oauth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: token.email,
              full_name: token.name,
              google_id: account.providerAccountId,
              avatar_url: (user as any)?.image ?? null,
            }),
          });
          if (res.ok) {
            const beelUser = await res.json();
            // Sobreescribir sub con el UUID real de la BD de Beel
            token.sub = beelUser.id;
            token.role = beelUser.role ?? "guest";
          }
        } catch {
          // Si falla, el usuario no tendrá UUID de Beel — se bloqueará en el backend
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
