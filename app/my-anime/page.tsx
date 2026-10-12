"use client";

import { useEffect, useState } from "react";
import { STATUSES, getLibrary } from "../lib/library";
import type { LibraryEntry } from "../lib/library";
import { getCurrentUser, signOut } from "../lib/auth";
import { fetchAnimeByIds } from "../lib/animeBatch";

const FILTERS = ["All", ...STATUSES];

type MyAnime = LibraryEntry & {
  title: { romaji: string };
  coverImage: { large: string } | null;
  episodes: number | null;
};

export default function MyAnimePage() {
  const [anime, setAnime] = useState<MyAnime[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [activeStatus, setActiveStatus] = useState<string>("All");
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await getCurrentUser();
        if (cancelled) return;
        setEmail(user?.email ?? null);

        if (!user) return;

        const entries = await getLibrary();

        // One batched request for the whole library
        const details = await fetchAnimeByIds(entries.map((e) => e.id));

        if (cancelled) return;

        const ok: MyAnime[] = [];
        const failed: string[] = [];

        for (const entry of entries) {
          const data = details.get(entry.id);
          if (data) {
            ok.push({
              ...entry,
              title: data.title,
              coverImage: data.coverImage ?? null,
              episodes: data.episodes ?? null,
            });
          } else {
            failed.push(`Anime ${entry.id}: could not be loaded`);
          }
        }

        setAnime(ok);
        setFailures(failed);
      } catch (e) {
        if (!cancelled) {
          setFailures([e instanceof Error ? e.message : "Could not load library"]);
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
    setAnime([]);
  }

  const filteredAnime =
    activeStatus === "All"
      ? anime
      : anime.filter((item) => item.status === activeStatus);

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-10 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-16 flex items-center justify-between">
          <a href="/" className="text-sm text-gray-400 hover:text-white">
            ← Home
          </a>
          <h1 className="text-xl font-semibold">My Anime</h1>
          <div className="flex items-center gap-6 text-sm">
            <a href="/discover" className="text-gray-400 hover:text-white">
              Discover
            </a>
            <a href="/profile" className="text-gray-400 hover:text-white">
              Profile
            </a>
            {email ? (
              <button
                onClick={handleSignOut}
                className="text-gray-400 hover:text-white"
              >
                Log out
              </button>
            ) : (
              <a href="/login" className="text-purple-400 hover:text-purple-300">
                Log in
              </a>
            )}
          </div>
        </nav>

        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-purple-400">
            Your Library
          </p>
          <h2 className="mt-3 text-4xl font-bold">My Anime</h2>
          <p className="mt-3 text-gray-400">
            {email
              ? `Signed in as ${email}`
              : "Keep track of the anime you are watching."}
          </p>
        </div>

        {!loading && !email && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <p className="text-gray-400">Log in to see and build your library.</p>
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
            <div className="mb-10 flex flex-wrap gap-3">
              {FILTERS.map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  className={`rounded-full px-5 py-2 text-sm transition ${
                    activeStatus === status
                      ? "bg-purple-600 text-white"
                      : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {failures.length > 0 && (
              <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                <p className="mb-1 font-medium">Some anime failed to load:</p>
                <ul className="list-disc pl-5">
                  {failures.map((f, i) => (
                    <li key={`${f}-${i}`}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {loading && <p className="text-gray-400">Loading your anime...</p>}

            {!loading && filteredAnime.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
                <p className="text-gray-400">
                  {anime.length === 0
                    ? "Your library is empty."
                    : "No anime in this category yet."}
                </p>
                {anime.length === 0 && (
                  <a
                    href="/discover"
                    className="mt-4 inline-block text-sm text-purple-400 hover:text-purple-300"
                  >
                    Find something in Discover →
                  </a>
                )}
              </div>
            )}

            {!loading && filteredAnime.length > 0 && (
              <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
                {filteredAnime.map((item) => (
                  <a href={`/anime/${item.id}`} key={item.id} className="group">
                    {item.coverImage?.large ? (
                      <img
                        src={item.coverImage.large}
                        alt={item.title?.romaji ?? "Anime cover"}
                        className="aspect-[2/3] w-full rounded-xl object-cover transition group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="aspect-[2/3] w-full rounded-xl bg-white/10" />
                    )}

                    <h3 className="mt-3 font-medium">
                      {item.title?.romaji ?? "Unknown title"}
                    </h3>
                    <p className="mt-1 text-sm text-purple-400">{item.status}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {item.watched} / {item.episodes ?? "?"} episodes
                    </p>

                    {item.episodes ? (
                      <div className="mt-2 h-1 w-full rounded-full bg-white/10">
                        <div
                          className="h-1 rounded-full bg-purple-500"
                          style={{
                            width: `${Math.min(100, (item.watched / item.episodes) * 100)}%`,
                          }}
                        />
                      </div>
                    ) : null}
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}