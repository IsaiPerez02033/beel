"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { Post } from "@/types";
import { useAuth } from "@/hooks/useSafeAuth";
import { useApi } from "@/hooks/useApi";
import PostCard from "@/components/PostCard";
import PostComposer from "@/components/PostComposer";
import ReelsViewer from "@/components/ReelsViewer";

/**
 * Feed de publicaciones de anfitriones (estilo Instagram) en la home.
 * Si no hay publicaciones y el usuario no es anfitrión, no renderiza nada.
 */
export default function PostsFeed() {
  const { isSignedIn } = useAuth();
  const { get, post: apiPost, del } = useApi();

  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [reelsPostId, setReelsPostId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadFeed = useCallback(() => {
    get<{ posts: Post[]; next_cursor: string | null }>("/posts")
      .then((d) => {
        setPosts(d.posts ?? []);
        setNextCursor(d.next_cursor ?? null);
      })
      .catch(() => {});
  }, [get]);

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

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    get<{ posts: Post[]; next_cursor: string | null }>(
      `/posts?cursor=${encodeURIComponent(nextCursor)}`
    )
      .then((d) => {
        setPosts((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          return [...prev, ...(d.posts ?? []).filter((p) => !ids.has(p.id))];
        });
        setNextCursor(d.next_cursor ?? null);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [get, nextCursor, loadingMore]);

  // Scroll infinito: cargar más al acercarse al final.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) loadMore(); },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore, nextCursor]);

  function toggleLike(postId: string, liked: boolean) {
    // Optimista: se revierte si la petición falla.
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked, like_count: Math.max(0, p.like_count + (liked ? 1 : -1)) }
          : p
      )
    );
    const req = liked ? apiPost(`/posts/${postId}/like`, {}) : del(`/posts/${postId}/like`);
    (req as Promise<unknown>).catch(() =>
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: !liked, like_count: Math.max(0, p.like_count + (liked ? -1 : 1)) }
            : p
        )
      )
    );
  }

  function handleDelete(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    del(`/posts/${postId}`).catch(() => loadFeed());
  }

  if (posts.length === 0 && !isHost) return null;

  return (
    <section className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 pt-8">
      <div className="max-w-[470px] mx-auto">
        <div className="flex items-center justify-between px-3 sm:px-0 mb-3">
          <h2 className="text-h2 font-semibold text-[var(--text-primary)]">
            Publicaciones
          </h2>
          {isHost && (
            <button
              onClick={() => setComposerOpen(true)}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)]"
            >
              <ImagePlus size={16} /> Publicar
            </button>
          )}
        </div>

        <div className="space-y-6">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              isSignedIn={!!isSignedIn}
              isOwn={p.host.id === myId}
              onToggleLike={toggleLike}
              onDelete={handleDelete}
              onOpenVideo={setReelsPostId}
            />
          ))}
        </div>

        {posts.length === 0 && isHost && (
          <button
            onClick={() => setComposerOpen(true)}
            className="w-full rounded-2xl border-2 border-dashed border-[var(--border-default)] py-10 flex flex-col items-center gap-2 text-[var(--text-tertiary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ImagePlus size={26} />
            <span className="text-body-sm font-medium">Comparte la primera publicación</span>
          </button>
        )}

        <div ref={sentinelRef} className="h-1" />
        {loadingMore && (
          <p className="text-center text-caption text-[var(--text-tertiary)] py-3">Cargando…</p>
        )}
      </div>

      {composerOpen && (
        <PostComposer
          onClose={() => setComposerOpen(false)}
          onPublished={() => { setComposerOpen(false); loadFeed(); }}
        />
      )}

      {reelsPostId !== null && (() => {
        // Modo reels: todos los posts con video, empezando por el tocado.
        const videoPosts = posts.filter((p) =>
          p.media.some((m) => m.media_type === "video")
        );
        const start = Math.max(0, videoPosts.findIndex((p) => p.id === reelsPostId));
        return (
          <ReelsViewer
            posts={videoPosts}
            startIndex={start}
            isSignedIn={!!isSignedIn}
            onClose={() => setReelsPostId(null)}
            onToggleLike={toggleLike}
          />
        );
      })()}
    </section>
  );
}
