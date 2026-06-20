import { getToken } from "next-auth/jwt";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

/**
 * Genera un JWT HS256 estándar para el backend FastAPI.
 *
 * Usa getToken() de next-auth/jwt en lugar de auth() para leer
 * el cookie de sesión directamente — más confiable y no depende
 * de la cadena completa de callbacks de NextAuth.
 */
export async function GET(req: NextRequest) {
  const nextAuthToken = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "",
  });

  if (!nextAuthToken) {
    return NextResponse.json({ token: null });
  }

  // nextAuthToken.sub puede ser el UUID de Beel o el Google sub (si la sesión es antigua)
  // El backend maneja ambos casos: busca por UUID y si falla busca por email
  const secret = new TextEncoder().encode(
    process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? ""
  );

  const token = await new SignJWT({
    sub: nextAuthToken.sub,
    email: nextAuthToken.email,
    name: nextAuthToken.name,
    role: (nextAuthToken as any).role ?? "guest",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return NextResponse.json({ token });
}
