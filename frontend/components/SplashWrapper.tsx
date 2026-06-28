"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const SplashScreen = dynamic(() => import("./SplashScreen"), { ssr: false });

export default function SplashWrapper({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Solo mostrar en PC/laptop/tablet (no móvil)
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    // Solo mostrar splash la primera vez en esta sesión del navegador
    const seen = sessionStorage.getItem("beel_splash_seen");
    if (!seen) {
      setShowSplash(true);
    }
  }, []);

  function handleFinish() {
    sessionStorage.setItem("beel_splash_seen", "1");
    setShowSplash(false);
  }

  return (
    <>
      {showSplash && <SplashScreen onFinish={handleFinish} />}
      <div style={{ visibility: showSplash ? "hidden" : "visible" }}>
        {children}
      </div>
    </>
  );
}
