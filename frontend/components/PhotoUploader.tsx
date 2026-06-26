"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useSafeAuth";
import { cn } from "@/lib/utils";
import { Upload, X, Star, Loader2, ImagePlus, GripVertical } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  is_primary: boolean;
  display_order: number;
  caption?: string;
}

interface PhotoUploaderProps {
  propertyId: string;
  initialPhotos?: Photo[];
  onChange?: (photos: Photo[]) => void;
  maxPhotos?: number;
}

// Proxy de Vercel (mismo origen, sin CORS). El proxy agrega el prefijo /api/v1.
const API = "/api/backend";

export default function PhotoUploader({
  propertyId,
  initialPhotos = [],
  onChange,
  maxPhotos = 20,
}: PhotoUploaderProps) {
  const { getToken } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updatePhotos = useCallback((updated: Photo[]) => {
    setPhotos(updated);
    onChange?.(updated);
  }, [onChange]);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const invalid = arr.filter((f) => !allowed.includes(f.type));
    if (invalid.length) {
      setError("Solo se permiten imágenes JPEG, PNG o WebP");
      return;
    }
    const tooBig = arr.filter((f) => f.size > 10 * 1024 * 1024);
    if (tooBig.length) {
      setError("Cada imagen debe pesar menos de 10 MB");
      return;
    }
    if (photos.length + arr.length > maxPhotos) {
      setError(`Máximo ${maxPhotos} fotos por propiedad`);
      return;
    }

    setError("");
    setUploading(true);

    try {
      const token = await getToken();
      const uploaded: Photo[] = [];

      for (const file of arr) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(
          `${API}/properties/${propertyId}/photos`,
          {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          }
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Error al subir" }));
          throw new Error(err.detail ?? `HTTP ${res.status}`);
        }

        const photo = await res.json();
        uploaded.push(photo);
      }

      updatePhotos([...photos, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir las fotos");
    } finally {
      setUploading(false);
    }
  }

  async function deletePhoto(photoId: string) {
    const token = await getToken();
    await fetch(`${API}/properties/${propertyId}/photos/${photoId}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    updatePhotos(photos.filter((p) => p.id !== photoId));
  }

  async function setPrimary(photoId: string) {
    const token = await getToken();
    await fetch(`${API}/properties/${propertyId}/photos/${photoId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ is_primary: true }),
    });
    updatePhotos(
      photos.map((p) => ({ ...p, is_primary: p.id === photoId }))
    );
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  return (
    <div className="space-y-4">
      {/* Zona de drop */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
          dragOver
            ? "border-[var(--color-primary)] bg-[var(--color-primary-light)]"
            : "border-[var(--border-default)] hover:border-[var(--color-primary)] hover:bg-[var(--bg-subtle)]",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="text-[var(--color-primary)] animate-spin" />
            <p className="text-body-sm text-[var(--text-secondary)]">Subiendo fotos…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-light)] flex items-center justify-center">
              <ImagePlus size={22} className="text-[var(--color-primary)]" />
            </div>
            <p className="text-body font-medium text-[var(--text-primary)]">
              Arrastra fotos aquí o haz clic para seleccionar
            </p>
            <p className="text-caption text-[var(--text-tertiary)]">
              JPEG, PNG o WebP · Máximo 10 MB por foto · Hasta {maxPhotos} fotos
            </p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-body-sm">
          {error}
        </div>
      )}

      {/* Grid de fotos */}
      {photos.length > 0 && (
        <div>
          <p className="text-body-sm font-medium text-[var(--text-secondary)] mb-3">
            {photos.length} {photos.length === 1 ? "foto" : "fotos"} · La primera marcada con ★ es la portada
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos
              .slice()
              .sort((a, b) => a.display_order - b.display_order)
              .map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onDelete={() => deletePhoto(photo.id)}
                  onSetPrimary={() => setPrimary(photo.id)}
                />
              ))}

            {/* Botón agregar más */}
            {photos.length < maxPhotos && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-[var(--border-default)] hover:border-[var(--color-primary)] hover:bg-[var(--bg-subtle)] flex flex-col items-center justify-center gap-1 transition-all"
              >
                <Upload size={18} className="text-[var(--text-tertiary)]" />
                <span className="text-caption text-[var(--text-tertiary)]">Agregar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoCard({
  photo,
  onDelete,
  onSetPrimary,
}: {
  photo: Photo;
  onDelete: () => void;
  onSetPrimary: () => void;
}) {
  return (
    <div className="relative group aspect-square rounded-xl overflow-hidden bg-[var(--bg-subtle)]">
      <Image
        src={photo.url}
        alt="Foto de propiedad"
        fill
        className="object-cover"
        sizes="(max-width: 640px) 50vw, 25vw"
      />

      {/* Overlay en hover */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-between p-2">
        <button
          onClick={onSetPrimary}
          title="Establecer como foto principal"
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center transition-colors",
            photo.is_primary
              ? "bg-[var(--color-accent)] text-white"
              : "bg-white/80 text-[var(--text-secondary)] hover:bg-[var(--color-accent)] hover:text-white"
          )}
        >
          <Star size={13} fill={photo.is_primary ? "currentColor" : "none"} />
        </button>

        <button
          onClick={onDelete}
          title="Eliminar foto"
          className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Badge portada */}
      {photo.is_primary && (
        <div className="absolute bottom-2 left-2 bg-[var(--color-accent)] text-white text-micro font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
          <Star size={10} fill="currentColor" />
          Portada
        </div>
      )}
    </div>
  );
}
