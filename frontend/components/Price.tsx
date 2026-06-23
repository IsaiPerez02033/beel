"use client";

import { useMoney } from "@/contexts/CurrencyContext";

/**
 * Muestra un precio (almacenado en MXN) convertido a la moneda seleccionada.
 * Uso: <Price amount={1800} />
 */
export default function Price({ amount }: { amount: number }) {
  const { format } = useMoney();
  return <>{format(amount)}</>;
}
