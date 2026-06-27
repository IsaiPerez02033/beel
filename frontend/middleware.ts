import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth(function middleware(req) {
  const protectedPaths = ["/anfitrion", "/reservaciones", "/mensajes", "/admin", "/p/nueva"];
  const isProtected = protectedPaths.some((p) => req.nextUrl.pathname.startsWith(p));

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/iniciar-sesion", req.url);
    const redirectUrl = req.nextUrl.pathname + req.nextUrl.search;
    loginUrl.searchParams.set("redirect_url", redirectUrl);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    // Excluir _next, api/auth (NextAuth maneja sus propias rutas) y archivos estáticos
    "/((?!_next|api/auth|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
