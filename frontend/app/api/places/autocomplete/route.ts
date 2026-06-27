import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q || q.length < 3) return NextResponse.json({ suggestions: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
    },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ["mx"],
      languageCode: "es",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Places autocomplete error:", err);
    return NextResponse.json({ suggestions: [] });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
