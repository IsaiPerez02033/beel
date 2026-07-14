"use client";

import { useEffect, useRef, useState, useMemo } from "react";

interface KukulAvatarProps {
  size?: number;
  state?:
    | "idle"
    | "listening"
    | "thinking"
    | "responding"
    | "success"
    | "error"
    | "celebration"
    | "sleeping"
    | "coiling"
    | "fluffing"
    | "done";
  mousePos?: { x: number; y: number } | null;
  theme?: "beach" | "mountain" | "luxury" | "food" | "default";
  headTilt?: boolean;
}

// Inicialización diferida de AudioContext para evitar advertencias de reproducción automática del navegador
let sharedAudioCtx: AudioContext | null = null;
const getSharedAudioContext = () => {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioCtx = new AudioContextClass();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume();
  }
  return sharedAudioCtx;
};

export default function KukulAvatar({
  size = 40,
  state = "idle",
  mousePos = null,
  theme = "default",
  headTilt = false,
}: KukulAvatarProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  // Coordenadas reactivas para el seguimiento del cursor del usuario
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [headOffset, setHeadOffset] = useState({ x: 0, y: 0, rotate: 0 });

  // Sintetizador Web Audio API: Campana cristalina (celebración y respuesta)
  const playCrystallineChime = () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const frequencies = [523.25, 659.25, 783.99, 1046.50, 1318.51];
      frequencies.forEach((f, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + index * 0.04);
        gain.gain.setValueAtTime(0, now + index * 0.04);
        gain.gain.linearRampToValueAtTime(0.025, now + index * 0.04 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.04 + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + index * 0.04);
        osc.stop(now + index * 0.04 + 0.85);
      });
    } catch (e) {
      console.warn("Web Audio API Chime error:", e);
    }
  };

  // Sintetizador Web Audio API: Susurro de plumas (hover)
  const playFeatherRustle = () => {
    try {
      const ctx = getSharedAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(290, now + 0.32);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(950, now);
      filter.Q.setValueAtTime(7, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.012, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {
      console.warn("Web Audio API Rustle error:", e);
    }
  };

  const lastStateRef = useRef(state);
  const requestRef = useRef<number | null>(null);
  const blinkTimerRef = useRef<number | null>(null);
  const saccadeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    lastStateRef.current = state;
    if (state === "celebration" || state === "success" || state === "responding") {
      playCrystallineChime();
    }
  }, [state]);

  // 1. Seguimiento Ocular en Tiempo Real + Inclinación de Cabeza
  useEffect(() => {
    if (state === "sleeping" || state === "thinking") {
      setEyeOffset({ x: 0, y: 0 });
      setHeadOffset({ x: 0, y: 0, rotate: 0 });
      return;
    }
    if (!mousePos) {
      if (theme !== "default") {
        // Mirar de reojo hacia abajo e izquierda (donde se ubican las tarjetas de recomendación)
        setEyeOffset({ x: -1.0, y: 0.7 });
        setHeadOffset({ x: -0.4, y: 0.3, rotate: -2 });
      } else {
        setEyeOffset({ x: 0, y: 0 });
        setHeadOffset({ x: 0, y: 0, rotate: 0 });
      }
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const kx = rect.left + rect.width / 2;
    const ky = rect.top + rect.height / 2;
    const dx = mousePos.x - kx;
    const dy = mousePos.y - ky;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 10) return;
    const angle = Math.atan2(dy, dx);

    const maxEyeX = 1.2;
    const maxEyeY = 0.8;
    const eyeX = Math.cos(angle) * Math.min(maxEyeX, dist / 240);
    const eyeY = Math.sin(angle) * Math.min(maxEyeY, dist / 240);

    const headX = Math.cos(angle) * Math.min(0.5, dist / 420);
    const headY = Math.sin(angle) * Math.min(0.4, dist / 420);
    const headRot = Math.min(2.5, Math.max(-2.5, dx / 150));

    setEyeOffset({ x: eyeX, y: eyeY });
    setHeadOffset({ x: headX, y: headY, rotate: headRot });
  }, [mousePos, state]);

  // 2. Loop de Física a 60 FPS (Respiración elástica, Lissajous infinito de la cola y plumas)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const startTime = Date.now();

    const loop = () => {
      const s = lastStateRef.current;
      const t = (Date.now() - startTime) / 1000;

      // Elasticidad de cuerpo (Micro-deformaciones)
      let scaleX = 1.0;
      let scaleY = 1.0;
      if (s === "sleeping") {
        scaleX = 1.0 + Math.sin(t * 1.5) * 0.011;
        scaleY = 1.0 + Math.cos(t * 1.5) * 0.007;
      } else if (s === "thinking") {
        scaleX = 1.0 + Math.sin(t * 3.5) * 0.009;
        scaleY = 1.0 + Math.cos(t * 3.5) * 0.006;
      } else {
        scaleX = 1.0 + Math.sin(t * 2.1) * 0.015;
        scaleY = 1.0 + Math.cos(t * 2.1) * 0.009;
      }

      // Cola procedimental (Curva Lissajous en lazo infinito)
      let tx = 0;
      let ty = 0;
      let trot = 0;
      if (s === "sleeping") {
        tx = Math.sin(t * 0.6) * 0.3;
        ty = Math.cos(t * 0.6) * 0.15;
        trot = Math.sin(t * 0.6) * 1.2;
      } else if (s === "thinking") {
        tx = Math.sin(t * 0.9) * 0.7;
        ty = Math.cos(t * 1.8) * 0.35;
        trot = Math.sin(t * 0.9) * 1.8;
      } else {
        tx = Math.sin(t * 1.3) * 1.3;
        ty = Math.sin(t * 2.6) * 0.55;
        trot = Math.cos(t * 1.3) * 3.2;
      }

      // Intensidad de iluminación
      let brightness = 1.0;
      if (s === "thinking") {
        brightness = 1.1 + Math.sin(t * 4.8) * 0.14;
      } else if (s === "sleeping") {
        brightness = 0.55 + Math.sin(t * 0.9) * 0.04;
      } else {
        brightness = 1.0 + Math.sin(t * 1.9) * 0.07;
      }

      // Apertura de plumas de Quetzal
      let fRot1 = 0;
      let fRot2 = 0;
      let fRot3 = 0;
      if (s === "sleeping") {
        fRot1 = -7.5;
        fRot2 = -5.5;
        fRot3 = -3.5;
      } else if (s === "listening") {
        fRot1 = 4.0;
        fRot2 = 2.5;
        fRot3 = 1.0;
      } else if (s === "celebration" || s === "responding") {
        fRot1 = 7 + Math.sin(t * 7.5) * 2.0;
        fRot2 = 5 + Math.sin(t * 7.5 + 0.8) * 1.8;
        fRot3 = 3 + Math.sin(t * 7.5 + 1.6) * 1.2;
      } else {
        fRot1 = Math.sin(t * 1.4) * 1.6;
        fRot2 = Math.cos(t * 1.1) * 1.2;
        fRot3 = Math.sin(t * 1.7) * 0.9;
      }

      el.style.setProperty("--kukul-body-scale-x", `${scaleX}`);
      el.style.setProperty("--kukul-body-scale-y", `${scaleY}`);
      el.style.setProperty("--kukul-tail-x", `${tx}px`);
      el.style.setProperty("--kukul-tail-y", `${ty}px`);
      el.style.setProperty("--kukul-tail-rot", `${trot}deg`);
      el.style.setProperty("--kukul-feather-brightness", `${brightness}`);
      el.style.setProperty("--kukul-feather-rot-1", `${fRot1}deg`);
      el.style.setProperty("--kukul-feather-rot-2", `${fRot2}deg`);
      el.style.setProperty("--kukul-feather-rot-3", `${fRot3}deg`);

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // 3. Parpadeo Procedimental (Blinking)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let active = true;

    const triggerBlink = () => {
      if (!active) return;
      el.style.setProperty("--kukul-eye-scale-y", "0.05");
      el.style.setProperty("--kukul-eye-opacity-shines", "0");

      setTimeout(() => {
        if (!active) return;
        el.style.setProperty("--kukul-eye-scale-y", "1.0");
        el.style.setProperty("--kukul-eye-opacity-shines", "1.0");
        blinkTimerRef.current = window.setTimeout(triggerBlink, 3500 + Math.random() * 3500);
      }, 130);
    };

    blinkTimerRef.current = window.setTimeout(triggerBlink, 2500);
    return () => {
      active = false;
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
    };
  }, []);

  // 4. Micro-saccades oculares
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let active = true;

    const triggerSaccade = () => {
      if (!active) return;
      const s = lastStateRef.current;
      if (s !== "sleeping") {
        const sx = (Math.random() - 0.5) * 0.4;
        const sy = (Math.random() - 0.5) * 0.3;
        el.style.setProperty("--kukul-saccade-x", `${sx}px`);
        el.style.setProperty("--kukul-saccade-y", `${sy}px`);
      }
      saccadeTimerRef.current = window.setTimeout(triggerSaccade, 1800 + Math.random() * 2200);
    };

    saccadeTimerRef.current = window.setTimeout(triggerSaccade, 1600);
    return () => {
      active = false;
      if (saccadeTimerRef.current) clearTimeout(saccadeTimerRef.current);
    };
  }, []);

  // 5. Paleta Estacional e Inspiración Mexicana
  const seasonalColors = useMemo(() => {
    const d = new Date();
    const m = d.getMonth();
    const day = d.getDate();

    if (m === 11) {
      return {
        jadeHighlight: "#3AE8BD",
        jadeBase: "#147A5C",
        featherStop1: "#D48C00",
        featherStop2: "#FDBF4E",
      };
    }
    if ((m === 9 && day >= 28) || (m === 10 && day <= 2)) {
      return {
        jadeHighlight: "#147A5C",
        jadeBase: "#084937",
        featherStop1: "#EA580C",
        featherStop2: "#FBBF24",
      };
    }
    if (m === 8 && (day === 15 || day === 16)) {
      return {
        jadeHighlight: "#16A34A",
        jadeBase: "#14532D",
        featherStop1: "#DC2626",
        featherStop2: "#EF4444",
      };
    }
    if (m >= 2 && m <= 4) {
      return {
        jadeHighlight: "#10B981",
        jadeBase: "#065F46",
        featherStop1: "#D97706",
        featherStop2: "#FBBF24",
      };
    }

    return {
      jadeHighlight: "#3AE8BD",
      jadeBase: "#147A5C",
      featherStop1: "#D48C00",
      featherStop2: "#FDBF4E",
    };
  }, []);

  // 6. Travel Mode: Brillo de fondo
  const themeGlowStyle = useMemo(() => {
    switch (theme) {
      case "beach":
        return { glowColor: "#06B6D4", opacity: 0.88 };
      case "mountain":
        return { glowColor: "#10B981", opacity: 0.88 };
      case "luxury":
        return { glowColor: "#F5A623", opacity: 0.95 };
      case "food":
        return { glowColor: "#F97316", opacity: 0.92 };
      default:
        return { glowColor: "var(--color-primary-light)", opacity: 0.4 };
    }
  }, [theme]);

  // Transformaciones inline combinadas
  const calculatedHeadTransform = `
    translate(${headOffset.x}px, ${headOffset.y}px) 
    rotate(${headOffset.rotate + (headTilt ? -5.5 : 0)}deg)
  `;

  const calculatedEyeTransform = `
    translate(calc(${eyeOffset.x}px + var(--kukul-saccade-x, 0px)), calc(${eyeOffset.y}px + var(--kukul-saccade-y, 0px)))
    scaleY(var(--kukul-eye-scale-y, 1))
  `;

  return (
    <span
      ref={containerRef}
      className={`kukul kukul--${state}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Kukul, asistente de Beel"
      onMouseEnter={playFeatherRustle}
    >
      <svg viewBox="0 0 64 64" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="kukul-disc-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={themeGlowStyle.glowColor} stopOpacity="1" />
            <stop offset="100%" stopColor={themeGlowStyle.glowColor} stopOpacity={themeGlowStyle.opacity} />
          </radialGradient>

          <linearGradient id="kukul-body-grad" x1="30%" y1="0%" x2="70%" y2="100%">
            <stop offset="0%" stopColor="#1EBE94" />
            <stop offset="40%" stopColor="#147A5C" />
            <stop offset="85%" stopColor="#084937" />
            <stop offset="100%" stopColor="#03251B" />
          </linearGradient>

          <radialGradient id="kukul-head-grad" cx="65%" cy="30%" r="70%">
            <stop offset="0%" stopColor={seasonalColors.jadeHighlight} />
            <stop offset="50%" stopColor={seasonalColors.jadeBase} />
            <stop offset="90%" stopColor="#073F30" />
            <stop offset="100%" stopColor="#032118" />
          </radialGradient>

          <linearGradient id="kukul-feather-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={seasonalColors.featherStop1} stopOpacity="0.85" />
            <stop offset="60%" stopColor={seasonalColors.featherStop2} stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFF2CC" stopOpacity="1" />
          </linearGradient>

          <linearGradient id="kukul-belly-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF2CC" />
            <stop offset="50%" stopColor="#FDBF4E" />
            <stop offset="100%" stopColor="#B27500" />
          </linearGradient>

          <radialGradient id="kukul-eye-grad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#2D6053" />
            <stop offset="60%" stopColor="#0A241E" />
            <stop offset="100%" stopColor="#020C09" />
          </radialGradient>

          <filter id="kukul-ao-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0.6" dy="1.4" stdDeviation="0.9" floodColor="#041B14" floodOpacity="0.28" />
          </filter>
        </defs>

        {/* Disco de fondo */}
        <circle cx="32" cy="32" r="32" className="kukul-disc" fill="url(#kukul-disc-grad)" />

        {/* Plumas de la corona de Quetzal que emergen naturalmente de la nuca/cuello */}
        <g className="kukul-feathers" filter="url(#kukul-ao-shadow)" style={{ filter: `brightness(var(--kukul-feather-brightness, 1))` }}>
          <path className="kukul-feather kukul-feather-1" d="M41 21 C30 14 26 4 33 1 C35 7 38 13 41 18 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" style={{ transform: "rotate(var(--kukul-feather-rot-1, 0deg))", transformOrigin: "41px 21px", transformBox: "view-box" }} />
          <path className="kukul-feather kukul-feather-2" d="M40 23 C28 19 21 11 27 6 C30 12 33 17 38 20 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" style={{ transform: "rotate(var(--kukul-feather-rot-2, 0deg))", transformOrigin: "40px 23px", transformBox: "view-box" }} />
          <path className="kukul-feather kukul-feather-3" d="M39 25 C25 25 18 20 22 14 C25 19 28 22 34 23 Z" fill="url(#kukul-feather-grad)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.4" style={{ transform: "rotate(var(--kukul-feather-rot-3, 0deg))", transformOrigin: "39px 25px", transformBox: "view-box" }} />
        </g>

        {/* Vientre y pecho tridimensional (contraste oro-resina para volumen) */}
        <g className="kukul-belly-group" filter="url(#kukul-ao-shadow)" style={{ transform: "scale(var(--kukul-body-scale-x, 1), var(--kukul-body-scale-y, 1))", transformOrigin: "32px 42px", transformBox: "view-box" }}>
          <path className="kukul-belly kukul-belly-chest" d="M41.5 21.5 C43 25 43 29 39.5 32 C40.5 29 41 25 41.5 21.5 Z" fill="url(#kukul-belly-grad)" />
          <path className="kukul-belly kukul-belly-tail" d="M39 55 C34 56 30 53 31 48 C30 51 34 55 39 55 Z" fill="url(#kukul-belly-grad)" />
        </g>

        {/* Cuerpo/curva de la serpiente (Un solo trazo calligráfico fluido con cola ahusada) */}
        <path
          className="kukul-body"
          d="M36 20 C42 15 48 19 46 25 C44 31 36 33 32 37 C26 42 27 50 33 53 C40 56 46 52 43 45 C40 39 31 38 27 34 C23 30 24 23 31 19 C33 18 35 18 36 20 Z"
          fill="url(#kukul-body-grad)"
          filter="url(#kukul-ao-shadow)"
          style={{ transform: "scale(var(--kukul-body-scale-x, 1), var(--kukul-body-scale-y, 1))", transformOrigin: "32px 42px", transformBox: "view-box" }}
        />

        {/* Cola espiral Nautilus interior */}
        <g className="kukul-tail-group" style={{ transform: "translate(var(--kukul-tail-x, 0px), var(--kukul-tail-y, 0px)) rotate(var(--kukul-tail-rot, 0deg))", transformOrigin: "32px 42px", transformBox: "view-box" }}>
          <path
            className="kukul-tail"
            d="M43 45 C47 48 45 53 39 55 C34 56 29 53 31 48 C33 44 38 43 40 46 C41 48 39 51 36 50 C34 49 34 47 36 46"
            fill="none"
            stroke="url(#kukul-body-grad)"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#kukul-ao-shadow)"
          />
        </g>

        {/* Cabeza de la serpiente (Curvas continuas y conexión fluida con el cuello) */}
        <path
          className="kukul-head"
          d="M44 23 C42 16 49 12 54 16 C58 19 58 24 54 27 C50 29 45 28 44 23 Z"
          fill="url(#kukul-head-grad)"
          style={{ transform: calculatedHeadTransform, transformOrigin: "44px 23px", transformBox: "view-box" }}
        />

        {/* Ojo Pixar/VisionOS (Gran expresividad con triple brillo refractivo asimétrico) */}
        <g style={{ transform: calculatedEyeTransform, transformOrigin: "47.5px 18px", transformBox: "view-box" }}>
          <circle className="kukul-eye" cx="47.5" cy="18" r="3.4" fill="url(#kukul-eye-grad)" />
          <circle className="kukul-eye-iris" cx="47.6" cy="18.1" r="1.7" fill="var(--color-accent)" opacity="0.65" />
          <circle className="kukul-eye-shine kukul-eye-shine-1" cx="48.5" cy="17.0" r="1.1" fill="#ffffff" style={{ opacity: "var(--kukul-eye-opacity-shines, 1)" }} />
          <circle className="kukul-eye-shine kukul-eye-shine-2" cx="46.3" cy="19.1" r="0.5" fill="#ffffff" opacity="0.6" style={{ opacity: "var(--kukul-eye-opacity-shines, 1)" }} />
          <circle className="kukul-eye-shine kukul-eye-shine-3" cx="48.1" cy="19.4" r="0.25" fill="#ffffff" opacity="0.4" style={{ opacity: "var(--kukul-eye-opacity-shines, 1)" }} />
        </g>

        {/* Lengua bífida */}
        <path className="kukul-tongue" d="M51 20 L57 20 M57 20 L60.5 18 M57 20 L60.5 22" style={{ transform: calculatedHeadTransform, transformOrigin: "44px 23px", transformBox: "view-box" }} />

        {/* Partículas de cálculo */}
        <g className="kukul-particles">
          <circle className="kukul-particle kukul-particle-1" cx="32" cy="32" r="0.8" fill="#FDBF4E" />
          <circle className="kukul-particle kukul-particle-2" cx="32" cy="32" r="0.6" fill="#FFF2CC" />
          <circle className="kukul-particle kukul-particle-3" cx="32" cy="32" r="0.5" fill="#ffffff" />
        </g>
      </svg>
    </span>
  );
}
