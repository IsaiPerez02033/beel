"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

interface MyProperty {
  id: string;
  title: string;
}

/** Modal para publicar una historia (foto + caption + propiedad opcional). */
export default function StoryComposer({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const { getToken } = useAuth();
  const { get } = useApi();

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [properties, setProperties] = useState<MyProperty[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    get<{ properties: MyProperty[] }>("/properties/host/my-listings?per_page=50")
      .then((d) => setProperties(d.properties ?? []))
      .catch(() => {});
  }, [get]);

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pickFile(f: File | null) {
    setError("");
    if (!f) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(f.type)) {
      setError("Formato no válido. Usa JPEG, PNG o WebP.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("La imagen no debe superar 10 MB.");
      return;
    }
    setFile(f);
  }

  async function publish() {
    if (!file || publishing) return;
    setPublishing(true);
    setError("");
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);
      if (caption.trim()) formData.append("caption", caption.trim());
      if (propertyId) formData.append("property_id", propertyId);
      const res = await fetch("/api/backend/stories", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error al publicar" }));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }
      onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo publicar la historia.");
      setPublishing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[var(--bg-elevated)] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h3 className="text-body font-semibold text-[var(--text-primary)]">Nueva historia</h3>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {previewUrl ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="block w-full rounded-xl overflow-hidden border border-[var(--border-subtle)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Vista previa" className="w-full h-64 object-cover" />
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-64 rounded-xl border-2 border-dashed border-[var(--border-default)] flex flex-col items-center justify-center gap-2 text-[var(--text-tertiary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
            >
              <ImagePlus size={28} />
              <span className="text-body-sm font-medium">Elegir foto</span>
              <span className="text-caption">JPEG, PNG o WebP · máx. 10 MB</span>
            </button>
          )}

          <input
            className="input"
            placeholder="Escribe algo… (opcional)"
            value={caption}
            maxLength={200}
            onChange={(e) => setCaption(e.target.value)}
          />

          {properties.length > 0 && (
            <select
              className="input"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              <option value="">Sin propiedad vinculada</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          )}

          {error && <p className="text-caption text-red-500">{error}</p>}

          <button
            onClick={publish}
            disabled={!file || publishing}
            className="btn btn-primary w-full py-2.5 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {publishing && <Loader2 size={16} className="animate-spin" />}
            {publishing ? "Publicando…" : "Publicar historia"}
          </button>
          <p className="text-caption text-[var(--text-tertiary)] text-center">
            Tu historia será visible para todos durante 24 horas.
          </p>
        </div>
      </div>
    </div>
  );
}
