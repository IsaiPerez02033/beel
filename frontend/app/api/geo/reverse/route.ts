import { NextRequest, NextResponse } from "next/server";

// Geocoding inverso (coordenadas → dirección) con Nominatim (OpenStreetMap).
// Se usa al arrastrar el pin en el mapa. Gratis, sin API key.
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) return NextResponse.json({ result: null });

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1&accept-language=es`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Beel/1.0 (https://www.beel-mx.com)" },
    });
    if (!res.ok) return NextResponse.json({ result: null });
    const data = await res.json();
    const a = data.address ?? {};

    const street = a.road || a.pedestrian || a.footway || "";
    const number = a.house_number || "";
    const neighborhood = a.neighbourhood || a.suburb || a.quarter || a.residential || "";
    const city = a.city || a.town || a.village || a.municipality || a.county || "";
    const state = a.state || "";
    const postal_code = a.postcode || "";
    const address = number && street ? `${street} ${number}` : street || "";

    return NextResponse.json({
      result: { address, street, neighborhood, city, state, postal_code },
    });
  } catch {
    return NextResponse.json({ result: null });
  }
}
