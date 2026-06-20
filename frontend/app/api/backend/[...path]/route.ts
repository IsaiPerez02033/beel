/**
 * Proxy transparente al backend de Beel.
 *
 * El browser llama a /api/backend/* (mismo origen → sin CORS).
 * Este handler reenvía la petición a BACKEND_URL server-side.
 * El backend nunca es expuesto directamente al browser.
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function proxy(req: NextRequest, params: { path: string[] }): Promise<NextResponse> {
  const path = params.path.join("/");
  const search = req.nextUrl.search;
  const url = `${BACKEND}/api/v1/${path}${search}`;

  // Copiar headers del request original, quitar host para evitar conflictos
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "host") {
      headers.set(key, value);
    }
  });

  let body: BodyInit | null = null;
  const method = req.method;
  if (!["GET", "HEAD"].includes(method)) {
    body = await req.blob();
  }

  try {
    const res = await fetch(url, { method, headers, body });
    const resHeaders = new Headers(res.headers);
    // Eliminar content-encoding para evitar problemas de descompresión doble
    resHeaders.delete("content-encoding");
    resHeaders.delete("transfer-encoding");

    return new NextResponse(res.body, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (e) {
    return NextResponse.json(
      { detail: "El servidor no está disponible. Intenta de nuevo en unos segundos." },
      { status: 503 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
export async function OPTIONS(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params);
}
