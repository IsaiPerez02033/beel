import { auth } from "@/auth";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

/**
 * Genera un JWT HS256 estándar para el backend FastAPI.
 *
 * Usa auth() que lee la cookie de sesión de NextAuth v5 (authjs.session-token).
 * El sub puede ser el UUID de Beel o el Google sub — el backend maneja ambos
 * casos con fallback a búsqueda por email.
 *
 * Clave: usamos session.user.email (siempre presente) en vez de user.id
 * (que puede ser undefined si el session callback no lo seteó).
 */
export async function GET() {
  const session = await auth();

  // El email siempre está presente cuando el usuario está autenticado
  if (!session?.user?.email) {
    return NextResponse.json({ token: null });
  }

  const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? ""
  );

  const token = await new SignJWT({
    // sub: UUID de Beel si existe, si no el Google sub, si no el email como último recurso
    sub: session.user.id ?? session.user.email,
    email: session.user.email,
    name: session.user.name ?? "",
    role: (session.user as any).role ?? "guest",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return NextResponse.json({ token });
}
