"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Photo {
  id: string;
  url: string;
  is_primary: boolean;
}

interface PropertyGalleryProps {
  photos: Photo[];
  title: string;
}

export default function PropertyGallery({ photos, title }: PropertyGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openLightbox = (index: number) => {
    if (index >= 0 && index < photos.length) {
      setSelectedIndex(index);
    }
  };

  const closeLightbox = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const nextPhoto = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((prevIndex) =>
        prevIndex !== null && prevIndex < photos.length - 1 ? prevIndex + 1 : 0
      );
    }
  }, [selectedIndex, photos.length]);

  const prevPhoto = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((prevIndex) =>
        prevIndex !== null && prevIndex > 0 ? prevIndex - 1 : photos.length - 1
      );
    }
  }, [selectedIndex, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowRight") nextPhoto();
      if (e.key === "ArrowLeft") prevPhoto();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, closeLightbox, nextPhoto, prevPhoto]);

  // Lock body scroll when open
  useEffect(() => {
    if (selectedIndex !== null) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedIndex]);

  if (!photos || photos.length === 0) {
    return (
      <div className="grid grid-cols-4 grid-rows-2 gap-2 rounded-2xl overflow-hidden h-[400px] mb-8 bg-[var(--color-primary-light)]" />
    );
  }

  const mainPhoto = photos[0];
  const gridPhotos = photos.slice(1, 5);

  return (
    <>
      {/* Grid de Galería */}
      <div className="grid grid-cols-4 grid-rows-2 gap-2 rounded-2xl overflow-hidden h-[400px] mb-8">
        {/* Foto principal */}
        <div
          onClick={() => openLightbox(0)}
          className="col-span-2 row-span-2 relative bg-[var(--color-primary-light)] overflow-hidden cursor-pointer group"
        >
          {mainPhoto?.url && (
            <Image
              src={mainPhoto.url}
              alt={title}
              fill
              className="object-cover group-hover:scale-[1.02] transition-transform duration-500 ease-out"
              priority
            />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
        </div>

        {/* Fotos secundarias */}
        {gridPhotos.map((photo, i) => (
          <div
            key={photo.id}
            onClick={() => openLightbox(i + 1)}
            className="relative bg-[var(--color-primary-light)] col-span-1 row-span-1 overflow-hidden cursor-pointer group"
          >
            {photo.url && (
              <Image
                src={photo.url}
                alt={`${title} — foto ${i + 2}`}
                fill
                className="object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
              />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
          </div>
        ))}

        {/* Rellenos si hay menos de 4 fotos secundarias */}
        {Array.from({ length: Math.max(0, 4 - gridPhotos.length) }).map((_, i) => (
          <div
            key={`placeholder-${i}`}
            className="bg-[var(--color-primary-light)] col-span-1 row-span-1 opacity-50"
          />
        ))}
      </div>

      {/* Lightbox / Modal de expansión */}
      {selectedIndex !== null && (
        <div
          onClick={closeLightbox}
          className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md transition-opacity duration-300 ease-in-out p-4"
        >
          {/* Header del Lightbox */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-[160] text-white">
            <span className="text-body-sm font-medium tracking-wide">
              {selectedIndex + 1} / {photos.length}
            </span>
            <button
              onClick={closeLightbox}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>

          {/* Contenido principal (Imagen grande) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl h-[75vh] flex items-center justify-center"
          >
            {/* Botón Anterior */}
            <button
              onClick={prevPhoto}
              className="absolute left-0 md:-left-16 z-[160] w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
              aria-label="Foto anterior"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Contenedor de Imagen con transiciones suaves */}
            <div className="relative w-full h-full select-none flex items-center justify-center animate-fade-in">
              <Image
                src={photos[selectedIndex].url}
                alt={`${title} — ampliada ${selectedIndex + 1}`}
                fill
                className="object-contain rounded-lg max-w-full max-h-full"
                sizes="(max-width: 1024px) 100vw, 1280px"
                priority
              />
            </div>

            {/* Botón Siguiente */}
            <button
              onClick={nextPhoto}
              className="absolute right-0 md:-right-16 z-[160] w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95"
              aria-label="Siguiente foto"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Título o descripción del pie de foto */}
          <div className="absolute bottom-6 text-white text-body-sm text-center font-medium max-w-lg px-4 truncate">
            {title}
          </div>
        </div>
      )}
    </>
  );
}
