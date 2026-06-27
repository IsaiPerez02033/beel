import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.GOOGLE_MAPS_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q || q.length < 3) return NextResponse.json({ suggestions: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "Referer": "https://beel-azure.vercel.app/",
      "Origin": "https://beel-azure.vercel.app",
    },
    body: JSON.stringify({
      input: q,
      includedRegionCodes: ["mx"],
      languageCode: "es",
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Places autocomplete error:", res.status, text);
    return NextResponse.json({ suggestions: [], _error: text }, { status: 200 });
  }

  const data = JSON.parse(text);
  console.log("Places autocomplete ok, suggestions:", (data.suggestions ?? []).length);
  return NextResponse.json(data);
}
