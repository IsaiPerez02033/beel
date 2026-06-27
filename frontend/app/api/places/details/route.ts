import { NextRequest, NextResponse } from "next/server";

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("id") ?? "";
  if (!placeId) return NextResponse.json({ error: "Missing place id" }, { status: 400 });

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`,
    {
      headers: {
        "X-Goog-Api-Key": KEY,
        "X-Goog-FieldMask": "addressComponents,location,formattedAddress",
        "Referer": "https://beel-azure.vercel.app/",
        "Origin": "https://beel-azure.vercel.app",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Places details error:", err);
    return NextResponse.json({ error: "Places API error" }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
