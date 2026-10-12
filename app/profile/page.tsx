"use client";

import { useEffect, useState } from "react";
import { STATUSES, getLibrary } from "../lib/library";
import type { LibraryEntry, Status } from "../lib/library";
import { getCurrentUser, signOut } from "../lib/auth";
import { fetchAnimeByIds } from "../lib/animeBatch";

type Stats = {
  total: number;
  byStatus: Record<Status, number>;
  episodesWatched: number;
  topGenres: { name: string; count: number }[];
};

function buildStats(
  entries: LibraryEntry[],
  genresById: Map<number, string[]>
): Stats {
  const byStatus: Record<Status, number> = {
    Watching: 0,
    Completed: 0,
    "Plan to Watch": 0,
    Dropped: 0,
  };

  let episodesWatched = 0;
  const genreCounts = new Map<string, number>();

  for (const entry of entries) {
    byStatus[entry.status] += 1;
    episodesWatched += entry.watched;

    for (const genre of genresById.get(entry.id) ?? []) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }

  const topGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return { total: entries.length, byStatus, episodesWatched, topGenres };
}

export default function ProfilePage() {
  const [email, setEmail] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await getCurrentUser();
        if (cancelled) return;

        if (!user) return;

        setEmail(user.email ?? null);
        setJoined(
          new Date(user.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
          })
        );

        const entries = await getLibrary();

        // One batched request for all genres. Anime that fail to load are skipped.
        const details = await fetchAnimeByIds(entries.map((e) => e.id));
        const genresById = new Map<number, string[]>();
        for (const [id, anime] of details) genresById.set(id, anime.genres ?? []);

        if (cancelled) return;
        setStats(buildStats(entries, genresById));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    setEmail(null);
    setStats(null);
  }

  const hoursWatched = stats ? Math.round((stats.episodesWatched * 24) / 60) : 0;
  const maxGenreCount = stats?.topGenres[0]?.count ?? 1;

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-10 py-12 text-white">
      <div className="mx-auto max-w-4xl">
        {loading && <p className="text-gray-400">Loading your profile...</p>}

        {error && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !email && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-gray-400">Log in to see your profile and stats.</p>
            <a
              href="/login"
              className="mt-4 inline-block rounded-xl bg-purple-600 px-6 py-3 text-sm font-medium hover:bg-purple-500"
            >
              Log in or sign up
            </a>
          </div>
        )}

        {email && (
          <>
            <div className="mb-12 flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-600 text-2xl font-bold uppercase">
                  {email[0]}
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-purple-400">
                    Profile
                  </p>
                  <h1 className="mt-1 text-2xl font-bold">{email}</h1>
                  {joined && (
                    <p className="mt-1 text-sm text-gray-500">
                      Member since {joined}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm text-gray-300 hover:bg-white/20"
              >
                Log out
              </button>
            </div>

            {stats && stats.total === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                <p className="text-gray-400">
                  Add some anime to your library to see your stats.
                </p>
                <a
                  href="/discover"
                  className="mt-4 inline-block text-sm text-purple-400 hover:text-purple-300"
                >
                  Find something in Discover →
                </a>
              </div>
            )}

            {stats && stats.total > 0 && (
              <>
                <section className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-4xl font-bold">{stats.total}</p>
                    <p className="mt-2 text-sm text-gray-400">Anime tracked</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-4xl font-bold">{stats.episodesWatched}</p>
                    <p className="mt-2 text-sm text-gray-400">Episodes watched</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <p className="text-4xl font-bold">≈ {hoursWatched}</p>
                    <p className="mt-2 text-sm text-gray-400">
                      Hours watched (at ~24 min per episode)
                    </p>
                  </div>
                </section>

                <section className="mb-12">
                  <h2 className="mb-4 text-xl font-semibold">By status</h2>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {STATUSES.map((status) => (
                      <div
                        key={status}
                        className="rounded-2xl border border-white/10 bg-white/5 p-5"
                      >
                        <p className="text-3xl font-bold text-purple-400">
                          {stats.byStatus[status]}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">{status}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xl font-semibold">Top genres</h2>

                  {stats.topGenres.length === 0 ? (
                    <p className="text-sm text-gray-500">No genre data yet.</p>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {stats.topGenres.map((genre) => (
                        <div key={genre.name}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="text-gray-300">{genre.name}</span>
                            <span className="text-gray-500">{genre.count}</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-white/10">
                            <div
                              className="h-2 rounded-full bg-purple-500"
                              style={{
                                width: `${(genre.count / maxGenreCount) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}