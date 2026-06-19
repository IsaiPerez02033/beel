import { auth } from "@/auth";
import { encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ token: null });
  }

  const token = await encode({
    token: {
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: (session.user as any).role,
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: "beel-auth-token",
  });

  return NextResponse.json({ token });
}
