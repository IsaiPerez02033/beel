"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 2x speed → 8 seg se convierten en 4 seg; sin audio
    video.playbackRate = 2.0;
    video.muted = true;
    video.play().catch(() => {});

    const handleEnded = () => {
      setFadeOut(true);
      // Esperar a que termine el fade-out antes de desmontar
      setTimeout(onFinish, 600);
    };

    // Fallback: si el video tarda más de 5 seg en cargar, terminar igual
    const timeout = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onFinish, 600);
    }, 5000);

    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("ended", handleEnded);
      clearTimeout(timeout);
    };
  }, [onFinish]);

  function skip() {
    setFadeOut(true);
    setTimeout(onFinish, 600);
  }

  return (
    <div
      onClick={skip}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F1EFE8] cursor-pointer"
      style={{ opacity: fadeOut ? 0 : 1, transition: "opacity 0.6s ease" }}
    >
      <video
        ref={videoRef}
        src="/video_quetzal.mp4"
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
      />

      {/* Botón saltar — encima de la marca de agua de Gemini */}
      <button
        onClick={(e) => { e.stopPropagation(); skip(); }}
        className="absolute right-0 text-white font-medium px-5 py-3 transition-all active:scale-95 hover:opacity-90"
        style={{ fontSize: "15px", backgroundColor: "#147A5C", minWidth: "90px", minHeight: "48px", bottom: "110px" }}
      >
        Saltar →
      </button>
    </div>
  );
}
