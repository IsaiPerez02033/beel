// Carga Leaflet (JS + CSS) desde CDN una sola vez. Compartido por los mapas.
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

let loaded = false;
let loading = false;
const cbs: Array<() => void> = [];

export function loadLeaflet(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (loaded && (window as any).L) { resolve(); return; }
    cbs.push(resolve);
    if (loading) return;
    loading = true;

    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = LEAFLET_JS;
    s.async = true;
    s.onload = () => { loaded = true; cbs.forEach((c) => c()); cbs.length = 0; };
    document.head.appendChild(s);
  });
}
