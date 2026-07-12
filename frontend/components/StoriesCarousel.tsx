"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import StoryViewer, { type StoryGroup } from "@/components/StoryViewer";
import StoryComposer from "@/components/StoryComposer";

/**
 * Carrusel de historias de anfitriones (estilo Instagram, expiran a 24h).
 * Si no hay historias activas no renderiza nada (nunca un carrusel vacío);
 * los anfitriones siempre ven su botón "+ Tu historia".
 */
export default function StoriesCarousel() {
  const { isSignedIn } = useAuth();
  const { get } = useApi();

  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [viewerStart, setViewerStart] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const loadFeed = useCallback(() => {
    get<{ groups: StoryGroup[] }>("/stories")
      .then(async (d) => {
        let feed = d.groups ?? [];
        // Enriquecer las historias propias con el conteo de vistas.
        if (isHost && myId) {
          try {
            const mine = await get<{ stories: { id: string; view_count?: number }[] }>("/stories/mine");
            const counts = new Map(mine.stories.map((s) => [s.id, s.view_count ?? 0]));
            feed = feed.map((g) =>
              g.host.id === myId
                ? { ...g, stories: g.stories.map((s) => ({ ...s, view_count: counts.get(s.id) })) }
                : g
            );
          } catch {}
        }
        setGroups(feed);
      })
      .catch(() => {});
  }, [get, isHost, myId]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!isSignedIn) { setIsHost(false); setMyId(null); return; }
    get<{ id: string; role: string }>("/users/me")
      .then((d) => {
        setMyId(d.id);
        setIsHost(d.role === "host" || d.role === "admin");
      })
      .catch(() => {});
  }, [isSignedIn, get]);

  function markSeen(storyId: string) {
    setGroups((prev) =>
      prev.map((g) => {
        if (!g.stories.some((s) => s.id === storyId)) return g;
        const stories = g.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
        return { ...g, stories, all_seen: stories.every((s) => s.seen) };
      })
    );
  }

  if (groups.length === 0 && !isHost) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {isHost && (
          <button
            onClick={() => setComposerOpen(true)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[72px] group"
          >
            <span className="w-16 h-16 rounded-full border-2 border-dashed border-[var(--border-default)] flex items-center justify-center text-[var(--text-tertiary)] group-hover:border-[var(--color-primary)] group-hover:text-[var(--color-primary)] transition-colors bg-[var(--bg-subtle)]">
              <Plus size={22} />
            </span>
            <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate w-full text-center">
              Tu historia
            </span>
          </button>
        )}

        {groups.map((g, idx) => (
          <button
            key={g.host.id}
            onClick={() => setViewerStart(idx)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[72px]"
          >
            <span
              className="w-16 h-16 rounded-full p-[2.5px]"
              style={{
                background: g.all_seen
                  ? "var(--border-default)"
                  : "linear-gradient(45deg, var(--color-primary), #4ADE80, var(--color-accent))",
              }}
            >
              <span className="block w-full h-full rounded-full p-[2px] bg-[var(--bg-base)]">
                {g.host.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={g.host.avatar_url}
                    alt={g.host.full_name ?? "Anfitrión"}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center font-semibold text-lg">
                    {(g.host.full_name ?? "A").charAt(0)}
                  </span>
                )}
              </span>
            </span>
            <span className="text-[11px] font-medium text-[var(--text-secondary)] truncate w-full text-center">
              {g.host.id === myId ? "Tú" : (g.host.full_name ?? "Anfitrión").split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      {viewerStart !== null && (
        <StoryViewer
          groups={groups}
          initialGroup={viewerStart}
          myId={myId}
          onClose={() => setViewerStart(null)}
          onSeen={markSeen}
          onDeleted={() => { setViewerStart(null); loadFeed(); }}
        />
      )}

      {composerOpen && (
        <StoryComposer
          onClose={() => setComposerOpen(false)}
          onPublished={() => { setComposerOpen(false); loadFeed(); }}
        />
      )}
    </section>
  );
}
