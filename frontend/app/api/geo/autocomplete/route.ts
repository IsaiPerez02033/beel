import { NextRequest, NextResponse } from "next/server";

// Autocompletado geográfico con Photon (OpenStreetMap) — gratis, sin API key.
// Se proxea del lado del servidor para evitar CORS y limitar a México.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    // Bias hacia el centro de México para priorizar resultados nacionales
    // Photon no soporta lang=es; se omite. El bias lat/lon prioriza México.
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=12&lat=23.6&lon=-102.5`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Beel/1.0 (https://www.beel-mx.com)" },
      // Cache ligero para no golpear el servicio en cada tecla
      next: { revalidate: 60 },
    });
    if (!res.ok) return NextResponse.json({ suggestions: [] });
    const data = await res.json();

    const norm = (v: string) =>
      (v ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const nq = norm(q);
    // Solo lugares poblados relevantes (evita hamlets/terrenos/ruido)
    const PLACE_TYPES = new Set(["city", "town", "village", "municipality", "state", "county", "region", "locality"]);

    const seen = new Set<string>();
    const rows = (data.features ?? [])
      .filter((f: any) => f.properties?.countrycode === "MX")
      .map((f: any) => {
        const p = f.properties ?? {};
        const [lng, lat] = f.geometry?.coordinates ?? [];
        const city = p.city || p.name || p.county || "";
        const state = p.state || "";
        const label = [city, state].filter(Boolean).join(", ");
        return { label, city, state, lat, lng, _type: p.type, _key: p.osm_key };
      })
      .filter((s: any) => {
        if (!s.label || s.lat == null || !s.city) return false;
        const isPlace = s._key === "place" || PLACE_TYPES.has(s._type);
        if (!isPlace) return false;
        if (seen.has(s.label)) return false;
        seen.add(s.label);
        return true;
      })
      .map((s: any) => {
        // Relevancia: prioriza los que empiezan/contienen lo escrito
        const nc = norm(s.city);
        s._score = nc.startsWith(nq) ? 3 : nc.includes(nq) ? 2 : 1;
        return s;
      })
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 6)
      .map(({ label, city, state, lat, lng }: any) => ({ label, city, state, lat, lng }));

    return NextResponse.json({ suggestions: rows });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
