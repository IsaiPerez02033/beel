"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Currency = "MXN" | "USD";

interface CurrencyCtx {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  /** Formatea un monto (almacenado en MXN) según la moneda seleccionada */
  format: (amountMXN: number) => string;
  rate: number; // MXN → USD
}

const Ctx = createContext<CurrencyCtx | null>(null);

// Tasa de respaldo si la API no responde (aprox. 1 USD ≈ 18 MXN)
const FALLBACK_MXN_TO_USD = 0.055;

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("MXN");
  const [rate, setRate] = useState(FALLBACK_MXN_TO_USD);

  // Cargar preferencia guardada
  useEffect(() => {
    const saved = localStorage.getItem("beel_currency");
    if (saved === "USD" || saved === "MXN") setCurrencyState(saved);
  }, []);

  // Obtener tasa de cambio real (API gratuita sin llave)
  useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/MXN")
      .then((r) => r.json())
      .then((d) => {
        if (d?.rates?.USD) setRate(d.rates.USD);
      })
      .catch(() => {}); // usa el fallback
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem("beel_currency", c);
  }, []);

  const format = useCallback(
    (amountMXN: number) => {
      if (currency === "MXN") {
        return new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amountMXN);
      }
      // USD
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amountMXN * rate);
    },
    [currency, rate]
  );

  return (
    <Ctx.Provider value={{ currency, setCurrency, format, rate }}>
      {children}
    </Ctx.Provider>
  );
}

/**
 * Hook para formatear precios según la moneda elegida.
 * Si se usa fuera del provider, cae a formato MXN (no rompe).
 */
export function useMoney() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      currency: "MXN" as Currency,
      setCurrency: () => {},
      rate: FALLBACK_MXN_TO_USD,
      format: (amountMXN: number) =>
        new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(amountMXN),
    };
  }
  return ctx;
}
