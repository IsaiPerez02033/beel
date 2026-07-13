"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";

interface MyProperty {
  id: string;
  title: string;
}

const MAX_FILES = 5;

/** Modal para crear una publicación (hasta 5 fotos + caption + propiedad opcional). */
export default function PostComposer({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const { getToken } = useAuth();
  const { get } = useApi();

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  function pickFiles(list: FileList | null) {
    setError("");
    if (!list) return;
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const next = [...files];
    for (const f of Array.from(list)) {
      if (!allowed.includes(f.type)) {
        setError("Formato no válido. Usa JPEG, PNG o WebP.");
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError("Cada imagen debe pesar menos de 10 MB.");
        continue;
      }
      if (next.length < MAX_FILES) next.push(f);
    }
    setFiles(next);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function publish() {
    if (files.length === 0 || publishing) return;
    setPublishing(true);
    setError("");
    try {
      const token = await getToken();
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      if (caption.trim()) formData.append("caption", caption.trim());
      if (propertyId) formData.append("property_id", propertyId);
      const res = await fetch("/api/backend/posts", {
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
      setError(e instanceof Error ? e.message : "No se pudo crear la publicación.");
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
        className="bg-[var(--bg-elevated)] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between sticky top-0 bg-[var(--bg-elevated)]">
          <h3 className="text-body font-semibold text-[var(--text-primary)]">Nueva publicación</h3>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-subtle)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
          />

          {previews.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {previews.map((url, i) => (
                <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-subtle)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFile(i)}
                    aria-label="Quitar foto"
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {files.length < MAX_FILES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-[var(--border-default)] flex items-center justify-center text-[var(--text-tertiary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
                >
                  <ImagePlus size={20} />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-56 rounded-xl border-2 border-dashed border-[var(--border-default)] flex flex-col items-center justify-center gap-2 text-[var(--text-tertiary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
            >
              <ImagePlus size={28} />
              <span className="text-body-sm font-medium">Elegir fotos</span>
              <span className="text-caption">Hasta {MAX_FILES} · JPEG, PNG o WebP · máx. 10 MB c/u</span>
            </button>
          )}

          <input
            className="input"
            placeholder="Escribe algo… (opcional)"
            value={caption}
            maxLength={500}
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
            disabled={files.length === 0 || publishing}
            className="btn btn-primary w-full py-2.5 rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {publishing && <Loader2 size={16} className="animate-spin" />}
            {publishing ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
