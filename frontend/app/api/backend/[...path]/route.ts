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
    try {
      body = await req.blob();
    } catch {
      // Ignorar si no hay cuerpo (ej. DELETE o peticiones vacías)
    }
  }

  if (!body) {
    headers.delete("content-length");
    headers.delete("content-type");
    headers.delete("transfer-encoding");
  }

  try {
    const fetchInit: RequestInit = { method, headers };
    if (body) {
      fetchInit.body = body;
    }

    const res = await fetch(url, fetchInit);

    // Bufferear la respuesta completa. fetch() ya descomprimió el body,
    // pero los headers content-encoding/content-length corresponden al
    // body comprimido — si los reenviamos, el browser trunca la respuesta.
    const buffer = await res.arrayBuffer();

    const resHeaders = new Headers();
    res.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      // Omitir headers de longitud/codificación — NextResponse los recalcula
      if (k === "content-encoding" || k === "content-length" || k === "transfer-encoding") return;
      resHeaders.set(key, value);
    });

    return new NextResponse(buffer, {
      status: res.status,
      headers: resHeaders,
    });
  } catch (e) {
    console.error("[Proxy Error]", e);
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
