import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind evitando conflictos */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea precio en MXN */
export function formatPrice(amount: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formatea rating con una decimal */
export function formatRating(rating?: number | null): string {
  if (rating == null || isNaN(rating)) return "Nuevo";
  return rating.toFixed(1);
}

/** Pluraliza huéspedes */
export function pluralGuests(n: number): string {
  return n === 1 ? "1 huésped" : `${n} huéspedes`;
}

/** Pluraliza noches */
export function pluralNights(n: number): string {
  return n === 1 ? "1 noche" : `${n} noches`;
}
