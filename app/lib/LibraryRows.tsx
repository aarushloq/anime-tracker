"use client";

import { useEffect, useState } from "react";
import { getLibrary, setProgress } from "./library";
import type { LibraryEntry } from "./library";
import { getCurrentUser } from "./auth";
import { fetchAnimeByIds } from "./animeBatch";

type Card = LibraryEntry & {
  title: string;
  cover: string | null;
  episodes: number | null;
};

// Looks up the title and cover for each saved anime in one batched request.
// Anime that fail to load are skipped.
async function loadCards(entries: LibraryEntry[]): Promise<Card[]> {
  if (entries.length === 0) return [];
  const details = await fetchAnimeByIds(entries.map((e) => e.id));

  return entries.flatMap((entry) => {
    const data = details.get(entry.id);
    if (!data) return [];
    return [
      {
        ...entry,
        title: data.title?.romaji ?? "Unknown title",
        cover: data.coverImage?.large ?? null,
        episodes: data.episodes ?? null,
      },
    ];
  });
}

export default function LibraryRows() {
  const [watching, setWatching] = useState<Card[]>([]);
  const [wishlist, setWishlist] = useState<Card[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await getCurrentUser();
        if (!user) return;

        // Newest activity first
        const entries = await getLibrary();

        const watchingEntries = entries
          .filter((e) => e.status === "Watching")
          .slice(0, 5);
        const wishlistEntries = entries
          .filter((e) => e.status === "Plan to Watch")
          .slice(0, 5);

        const [watchingCards, wishlistCards] = await Promise.all([
          loadCards(watchingEntries),
          loadCards(wishlistEntries),
        ]);

        if (cancelled) return;
        setWatching(watchingCards);
        setWishlist(wishlistCards);
      } catch (error) {
        console.error("Could not load library rows:", error);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function nextEpisode(card: Card) {
    setBusyId(card.id);
    try {
      const updated = await setProgress(card.id, card.watched + 1, card.episodes);

      setWatching((previous) =>
        updated.status === "Watching"
          ? previous.map((c) => (c.id === card.id ? { ...c, ...updated } : c))
          : previous.filter((c) => c.id !== card.id)
      );
    } catch (error) {
      console.error("Could not update progress:", error);
    } finally {
      setBusyId(null);
    }
  }

  if (watching.length === 0 && wishlist.length === 0) return null;

  return (
    <>
      {watching.length > 0 && (
        <section className="px-10 pt-16">
          <h2 className="mb-6 text-2xl font-semibold">Continue Watching</h2>

          <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
            {watching.map((card) => (
              <div key={card.id}>
                <a href={`/anime/${card.id}`} className="group block">
                  {card.cover ? (
                    <img
                      src={card.cover}
                      alt={card.title}
                      className="aspect-[2/3] w-full rounded-xl object-cover transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="aspect-[2/3] w-full rounded-xl bg-white/10" />
                  )}
                  <h3 className="mt-3 font-medium">{card.title}</h3>
                </a>

                <p className="mt-1 text-sm text-gray-500">
                  {card.watched} / {card.episodes ?? "?"} episodes
                </p>

                {card.episodes ? (
                  <div className="mt-2 h-1 w-full rounded-full bg-white/10">
                    <div
                      className="h-1 rounded-full bg-purple-500"
                      style={{
                        width: `${Math.min(100, (card.watched / card.episodes) * 100)}%`,
                      }}
                    />
                  </div>
                ) : null}

                <a
                  href={`/anime/${card.id}?play=1`}
                  className="mt-3 block w-full rounded-lg bg-purple-600 py-2 text-center text-sm font-medium hover:bg-purple-500"
                >
                  ▶ Continue episode {card.watched + 1}
                </a>

                <button
                  onClick={() => nextEpisode(card)}
                  disabled={busyId === card.id}
                  className="mt-2 w-full rounded-lg border border-white/15 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-50"
                >
                  Watched episode {card.watched + 1}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {wishlist.length > 0 && (
        <section className="px-10 pt-16">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Wishlist</h2>
            <a
              href="/my-anime"
              className="text-sm text-purple-400 hover:text-purple-300"
            >
              See all →
            </a>
          </div>

          <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
            {wishlist.map((card) => (
              <a href={`/anime/${card.id}`} key={card.id} className="group">
                {card.cover ? (
                  <img
                    src={card.cover}
                    alt={card.title}
                    className="aspect-[2/3] w-full rounded-xl object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="aspect-[2/3] w-full rounded-xl bg-white/10" />
                )}
                <h3 className="mt-3 font-medium">{card.title}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {card.episodes ?? "?"} episodes
                </p>
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}