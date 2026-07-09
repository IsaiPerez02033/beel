import Link from "next/link";
import { Home, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Pestañas Alojamientos / Experiencias (estilo Airbnb). */
export default function ExploreTabs({ active }: { active: "alojamientos" | "experiencias" }) {
  const tabs = [
    { key: "alojamientos", label: "Alojamientos", href: "/", icon: <Home size={16} /> },
    { key: "experiencias", label: "Experiencias", href: "/experiencias", icon: <Sparkles size={16} /> },
  ];
  return (
    <div className="flex justify-center gap-2 mb-6">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full text-body-sm font-medium transition-all duration-300 border hover:scale-[1.02] active:scale-95",
            active === t.key
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm"
              : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]"
          )}
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </div>
  );
}
