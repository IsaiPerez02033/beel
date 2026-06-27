"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

const PRESET_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🙏"];

interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

interface Props {
  messageId: string;
  conversationId: string;
  reactions: Reaction[];
  currentUserId: string;
  isMine: boolean;
  onReact: (messageId: string, emoji: string, hasReacted: boolean) => void;
  // compact: solo muestra el botón 😊 para abrir picker (dentro de burbuja)
  compact?: boolean;
  // showOnlyBadges: solo muestra las reacciones existentes con contador
  showOnlyBadges?: boolean;
}

export default function MessageReactions({
  messageId,
  reactions,
  currentUserId,
  isMine,
  onReact,
  compact,
  showOnlyBadges,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  function handleEmoji(emoji: string) {
    const existing = reactions.find((r) => r.emoji === emoji);
    const hasReacted = existing?.user_ids.includes(currentUserId) ?? false;
    onReact(messageId, emoji, hasReacted);
    setPickerOpen(false);
  }

  // Modo: solo badges de reacciones existentes (debajo de la burbuja)
  if (showOnlyBadges) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {reactions.map((r) => {
          const hasReacted = r.user_ids.includes(currentUserId);
          return (
            <button
              key={r.emoji}
              onClick={() => onReact(messageId, r.emoji, hasReacted)}
              className={cn(
                "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-sm border transition-all active:scale-95",
                hasReacted
                  ? "bg-[var(--color-primary-light)] border-[var(--color-primary)]"
                  : "bg-white border-neutral-200 hover:border-neutral-300"
              )}
            >
              <span>{r.emoji}</span>
              <span className="text-[11px] font-medium text-neutral-600">{r.count}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Modo compacto: solo botón 😊 dentro de la burbuja
  if (compact) {
    return (
      <div className="relative" ref={pickerRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setPickerOpen(!pickerOpen); }}
          className={cn(
            "text-[13px] leading-none opacity-40 hover:opacity-100 active:scale-95 transition-all",
            isMine ? "text-white" : "text-neutral-500"
          )}
          title="Reaccionar"
        >
          😊
        </button>

        {pickerOpen && (
          <div
            className={cn(
              "absolute z-50 bg-white border border-neutral-200 rounded-2xl shadow-xl p-2 flex gap-1",
              // Posicionar encima y alineado según lado del mensaje
              "bottom-full mb-2",
              isMine ? "right-0" : "left-0"
            )}
          >
            {PRESET_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onMouseDown={(e) => { e.preventDefault(); handleEmoji(emoji); }}
                onTouchStart={(e) => { e.stopPropagation(); }}
                onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); handleEmoji(emoji); }}
                className="w-9 h-9 rounded-xl hover:bg-neutral-100 text-xl flex items-center justify-center transition-all active:scale-95 hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Modo desktop: botón 😊 flotante (solo hover, oculto en móvil)
  return (
    <div className={cn("hidden sm:flex items-center gap-1 flex-wrap mt-1", isMine ? "justify-end" : "justify-start")}>
      {reactions.map((r) => {
        const hasReacted = r.user_ids.includes(currentUserId);
        return (
          <button
            key={r.emoji}
            onClick={() => onReact(messageId, r.emoji, hasReacted)}
            className={cn(
              "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-sm border transition-all active:scale-95",
              hasReacted
                ? "bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]"
                : "bg-white border-neutral-200 hover:border-neutral-300 text-neutral-700"
            )}
          >
            <span>{r.emoji}</span>
            <span className="text-[11px] font-medium">{r.count}</span>
          </button>
        );
      })}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="w-6 h-6 rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-500 text-sm flex items-center justify-center transition-all active:scale-95 opacity-0 group-hover:opacity-100"
        >
          <span className="text-xs">😊</span>
        </button>
        {pickerOpen && (
          <div className={cn("absolute bottom-full mb-2 bg-white border border-neutral-200 rounded-2xl shadow-lg p-2 flex gap-1 z-50", isMine ? "right-0" : "left-0")}>
            {PRESET_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => handleEmoji(emoji)} className="w-9 h-9 rounded-xl hover:bg-neutral-100 text-xl flex items-center justify-center transition-all active:scale-95 hover:scale-125">
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
