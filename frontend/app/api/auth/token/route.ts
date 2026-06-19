import { auth } from "@/auth";
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

/**
 * JWT estándar HS256 para el backend FastAPI.
 * Usa jose/SignJWT (no encode de next-auth) porque next-auth v5
 * con salt usa HKDF para derivar la clave — no es HS256 puro
 * y python-jose no puede verificarlo. jose genera HS256 estándar.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ token: null });
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);

  const token = await new SignJWT({
    sub: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: (session.user as any).role ?? "guest",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);

  return NextResponse.json({ token });
}
