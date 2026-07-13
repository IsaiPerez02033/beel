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
const MAX_VIDEO_MB = 50;
const MAX_VIDEO_SECONDS = 30;
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

interface VideoMeta {
  duration_s: number;
  width: number;
  height: number;
}

/** Lee duración y dimensiones de un video desde su metadata (client-side). */
function readVideoMeta(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const meta = {
        duration_s: Math.round(v.duration),
        width: v.videoWidth,
        height: v.videoHeight,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Video no válido")); };
    v.src = url;
  });
}

/** Modal para crear una publicación: hasta 5 fotos, o 1 video (reel) de 30s. */
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
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
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

  async function pickFiles(list: FileList | null) {
    setError("");
    if (!list) return;
    const picked = Array.from(list);

    // Un video va solo (reel): sustituye cualquier selección previa.
    const video = picked.find((f) => VIDEO_TYPES.includes(f.type));
    if (video) {
      if (video.size > MAX_VIDEO_MB * 1024 * 1024) {
        setError(`El video no debe superar ${MAX_VIDEO_MB} MB.`);
        return;
      }
      try {
        const meta = await readVideoMeta(video);
        if (meta.duration_s > MAX_VIDEO_SECONDS) {
          setError(`El video no debe durar más de ${MAX_VIDEO_SECONDS} segundos.`);
          return;
        }
        setVideoMeta(meta);
        setFiles([video]);
      } catch {
        setError("No se pudo leer el video. Prueba con otro archivo.");
      }
      return;
    }

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const next = videoMeta ? [] : [...files];
    for (const f of picked) {
      if (!allowed.includes(f.type)) {
        setError("Formato no válido. Usa JPEG, PNG, WebP o un video MP4/MOV.");
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setError("Cada imagen debe pesar menos de 10 MB.");
        continue;
      }
      if (next.length < MAX_FILES) next.push(f);
    }
    setVideoMeta(null);
    setFiles(next);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setVideoMeta(null);
  }

  async function publish() {
    if (files.length === 0 || publishing) return;
    setPublishing(true);
    setError("");
    try {
      const token = await getToken();
      const authHeader: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      if (videoMeta) {
        // Video: subir DIRECTO a Supabase con URL firmada (el proxy de Vercel
        // limita ~4.5 MB por request) y luego registrar la publicación.
        const video = files[0];
        const signRes = await fetch("/api/backend/posts/upload-url", {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ content_type: video.type, size_bytes: video.size }),
        });
        if (!signRes.ok) {
          const err = await signRes.json().catch(() => ({ detail: "Error al preparar la subida" }));
          throw new Error(err.detail ?? `HTTP ${signRes.status}`);
        }
        const { upload_url, key } = await signRes.json();

        const putRes = await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": video.type },
          body: video,
        });
        if (!putRes.ok) throw new Error("No se pudo subir el video. Intenta de nuevo.");

        const directRes = await fetch("/api/backend/posts/direct", {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            media: [{ key, media_type: "video", ...videoMeta }],
            caption: caption.trim() || null,
            property_id: propertyId || null,
          }),
        });
        if (!directRes.ok) {
          const err = await directRes.json().catch(() => ({ detail: "Error al publicar" }));
          throw new Error(err.detail ?? `HTTP ${directRes.status}`);
        }
      } else {
        const formData = new FormData();
        files.forEach((f) => formData.append("files", f));
        if (caption.trim()) formData.append("caption", caption.trim());
        if (propertyId) formData.append("property_id", propertyId);
        const res = await fetch("/api/backend/posts", {
          method: "POST",
          headers: authHeader,
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Error al publicar" }));
          throw new Error(err.detail ?? `HTTP ${res.status}`);
        }
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
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
          />

          {videoMeta && previews[0] ? (
            <div className="relative rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-black">
              <video src={previews[0]} muted playsInline controls className="w-full h-64 object-contain" />
              <button
                onClick={() => removeFile(0)}
                aria-label="Quitar video"
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white"
              >
                <X size={14} />
              </button>
              <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-medium">
                Reel · {videoMeta.duration_s}s
              </span>
            </div>
          ) : previews.length > 0 ? (
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
              <span className="text-body-sm font-medium">Elegir fotos o un video</span>
              <span className="text-caption text-center px-4">
                Hasta {MAX_FILES} fotos (10 MB c/u) o 1 video de {MAX_VIDEO_SECONDS}s (máx. {MAX_VIDEO_MB} MB)
              </span>
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
