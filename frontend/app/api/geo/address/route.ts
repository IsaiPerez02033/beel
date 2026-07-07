import { NextRequest, NextResponse } from "next/server";

// Autocompletado de DIRECCIONES (calle/número/colonia) con Photon (OpenStreetMap).
// Gratis, sin API key. Devuelve componentes para llenar el formulario.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=10&lat=23.6&lon=-102.5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Beel/1.0 (https://www.beel-mx.com)" },
      next: { revalidate: 30 },
    });
    if (!res.ok) return NextResponse.json({ suggestions: [] });
    const data = await res.json();

    const seen = new Set<string>();
    const suggestions = (data.features ?? [])
      .filter((f: any) => f.properties?.countrycode === "MX")
      .map((f: any) => {
        const p = f.properties ?? {};
        const [lng, lat] = f.geometry?.coordinates ?? [];
        const street = p.street || p.name || "";
        const number = p.housenumber || "";
        const neighborhood = p.district || p.suburb || p.neighbourhood || p.locality || "";
        const city = p.city || p.town || p.village || p.county || "";
        const state = p.state || "";
        const postal_code = p.postcode || "";
        const mainText = [street, number].filter(Boolean).join(" ") || p.name || city;
        const secondaryText = [neighborhood, city, state].filter(Boolean).join(", ");
        const address = number && street ? `${street} ${number}` : street || p.name || "";
        return { mainText, secondaryText, address, street, number, neighborhood, city, state, postal_code, lat, lng };
      })
      .filter((s: any) => {
        if (s.lat == null || (!s.mainText && !s.city)) return false;
        const key = `${s.mainText}|${s.secondaryText}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 7);

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
