"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LibraryRows from "./lib/LibraryRows";
import Reveal from "./lib/Reveal";

type Anime = {
  id: number;
  title: { romaji: string };
  coverImage: { large: string };
  averageScore?: number | null;
  seasonYear?: number | null;
  format?: string | null;
  episodes?: number | null;
};

const SUGGESTIONS = [
  "One Piece",
  "Naruto",
  "Attack on Titan",
  "Jujutsu Kaisen",
  "Frieren",
  "Death Note",
];

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/my-anime", label: "My Anime" },
  { href: "/profile", label: "Profile" },
];

function cardMeta(item: Anime): string {
  const parts: string[] = [];
  if (item.format) parts.push(item.format.replace(/_/g, " "));
  if (item.seasonYear) parts.push(String(item.seasonYear));
  if (item.episodes) parts.push(`${item.episodes} eps`);
  return parts.join(" · ");
}

// One result card in the grid
function AnimeCard({
  item,
  index,
  activeQuery,
}: {
  item: Anime;
  index: number;
  activeQuery: string;
}) {
  const meta = cardMeta(item);

  return (
    <Reveal delay={(index % 5) * 80}>
      <a href={`/anime/${item.id}`} className="group block">
        <div className="relative">
          {/* Purple glow under the card (only fades its opacity = cheap) */}
          <div className="pointer-events-none absolute inset-x-4 -bottom-6 h-16 bg-[radial-gradient(closest-side,rgba(139,92,246,0.55),transparent)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

          <div className="relative overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10 transition duration-500 group-hover:-translate-y-2 group-hover:ring-white/30">
            <img
              src={item.coverImage.large}
              alt={item.title.romaji}
              loading="lazy"
              decoding="async"
              className="aspect-[2/3] w-full object-cover transition duration-700 group-hover:scale-110"
            />

            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-transparent to-transparent opacity-40 transition duration-500 group-hover:opacity-100" />

            {!activeQuery && index < 10 && (
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-bold">
                #{index + 1}
              </span>
            )}

            {item.averageScore ? (
              <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-yellow-300">
                ★ {(item.averageScore / 10).toFixed(1)}
              </span>
            ) : null}

            <span className="absolute inset-x-4 bottom-4 translate-y-3 rounded-full bg-white py-2 text-center text-xs font-semibold text-black opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
              View details
            </span>
          </div>
        </div>

        <h3 className="mt-4 line-clamp-2 text-sm font-medium text-gray-100 transition group-hover:text-violet-300">
          {item.title.romaji}
        </h3>

        {meta && <p className="mt-1 truncate text-xs text-gray-500">{meta}</p>}
      </a>
    </Reveal>
  );
}

// The hero has its own state (slides and search text), so typing in the
// search box or changing slides does not redraw the results grid below.
function Hero({
  popular,
  activeQuery,
  onSearch,
}: {
  popular: Anime[];
  activeQuery: string;
  onSearch: (query: string) => void;
}) {
  const [featured, setFeatured] = useState(0); // which slide is showing
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLAnchorElement>(null);

  // Switch the slide every 6 seconds
  useEffect(() => {
    if (popular.length < 2) return;
    const timer = setInterval(() => {
      setFeatured((n) => (n + 1) % popular.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [popular.length, featured]);

  function scrollToResults() {
    document
      .getElementById("results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSearch() {
    onSearch(search.trim());
    scrollToResults();
  }

  function clearSearch() {
    setSearch("");
    onSearch("");
  }

  function pickSuggestion(name: string) {
    setSearch(name);
    onSearch(name);
    scrollToResults();
  }

  // Poster tilt: changes the style directly (no React state),
  // so nothing is redrawn on every mouse move
  function handleTilt(e: React.MouseEvent<HTMLAnchorElement>) {
    const poster = posterRef.current;
    if (!poster) return;
    const box = poster.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width - 0.5) * 12;
    const y = ((e.clientY - box.top) / box.height - 0.5) * -12;
    poster.style.transform = `perspective(1000px) rotateY(${x}deg) rotateX(${y}deg)`;
  }

  function resetTilt() {
    if (posterRef.current) {
      posterRef.current.style.transform = "";
    }
  }

  const current = popular[featured];

  return (
    // -mt-[88px] lets the hero slide under the floating navbar
    <section className="relative -mt-[88px] min-h-[100svh] overflow-hidden">
      {/* Covers crossfade behind everything. One wrapper holds the color
          boost, so it is applied once instead of on every image */}
      <div className="absolute inset-0 saturate-150">
        {popular.map((item, i) => (
          <img
            key={item.id}
            src={item.coverImage.large}
            alt=""
            aria-hidden
            decoding="async"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
              i === featured ? "opacity-50" : "opacity-0"
            }`}
          />
        ))}
      </div>

      {/* Light and shade */}
      <div className="absolute inset-0 bg-linear-to-t from-[#07070a] via-[#07070a]/60 to-[#07070a]/30" />
      <div className="absolute inset-0 bg-linear-to-r from-[#07070a]/80 via-[#07070a]/20 to-transparent" />
      <div className="pointer-events-none absolute -right-40 -top-20 h-[44rem] w-[44rem] bg-[radial-gradient(closest-side,rgba(124,58,237,0.3),transparent)]" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-6 pb-10 pt-36 sm:px-10">
        <div className="grid items-end gap-14 lg:grid-cols-12">
          {/* Left: the featured anime as giant typography */}
          <div className="lg:col-span-7">
            {current ? (
              <div
                key={current.id}
                className="animate-[fadeUp_0.9s_ease-out_both] motion-reduce:animate-none"
              >
                <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs text-gray-200">
                  <span className="h-1.5 w-1.5 animate-[pulseDot_2s_ease-in-out_infinite] rounded-full bg-violet-300" />
                  Trending now · #{featured + 1}
                </span>

                <h1 className="mt-6 line-clamp-3 text-5xl font-black leading-[0.95] tracking-tighter [text-wrap:balance] sm:text-7xl xl:text-8xl">
                  {current.title.romaji}
                </h1>

                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-gray-300">
                  {current.averageScore ? (
                    <span className="rounded-full bg-yellow-300/15 px-3 py-1 font-medium text-yellow-300">
                      ★ {(current.averageScore / 10).toFixed(1)}
                    </span>
                  ) : null}
                  <span className="text-gray-400">{cardMeta(current)}</span>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href={`/anime/${current.id}`}
                    className="rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition duration-300 hover:scale-[1.03] hover:bg-violet-200"
                  >
                    View details
                  </a>
                  <button
                    onClick={() => inputRef.current?.focus()}
                    className="glass rounded-full px-8 py-3.5 text-sm font-medium text-white transition duration-300 hover:bg-white/10"
                  >
                    Search anime
                  </button>
                </div>
              </div>
            ) : (
              // Placeholder while the first load is in progress
              <div className="animate-pulse">
                <div className="h-8 w-40 rounded-full bg-white/10" />
                <div className="mt-6 h-20 w-3/4 rounded-2xl bg-white/10" />
                <div className="mt-4 h-20 w-1/2 rounded-2xl bg-white/10" />
              </div>
            )}
          </div>

          {/* Right: poster that leans towards the mouse */}
          <div className="hidden lg:col-span-5 lg:block">
            {current && (
              <div className="relative ml-auto w-[21rem]">
                <div className="pointer-events-none absolute -inset-12 bg-[radial-gradient(closest-side,rgba(139,92,246,0.4),transparent)]" />

                <a
                  ref={posterRef}
                  href={`/anime/${current.id}`}
                  onMouseMove={handleTilt}
                  onMouseLeave={resetTilt}
                  className="relative block overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl shadow-black/70 transition-transform duration-300 ease-out"
                >
                  {popular.map((item, i) => (
                    <img
                      key={item.id}
                      src={item.coverImage.large}
                      alt={item.title.romaji}
                      decoding="async"
                      className={`aspect-[2/3] w-full object-cover transition-opacity duration-1000 ${
                        i === featured
                          ? "relative opacity-100"
                          : "absolute inset-0 opacity-0"
                      }`}
                    />
                  ))}
                  <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-white/10 via-transparent to-transparent" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar: search on the left, slide picker on the right */}
        <div className="mt-14 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-2xl">
            <div className="glass flex items-center rounded-full p-1.5 shadow-2xl shadow-black/40 transition-colors duration-300 focus-within:border-violet-300/60 focus-within:bg-white/10">
              <svg
                className="ml-4 h-5 w-5 shrink-0 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                placeholder="Search any anime"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                className="w-full bg-transparent px-3 py-3.5 outline-none placeholder:text-gray-500"
              />

              {(activeQuery || search) && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="mr-2 px-2 text-sm text-gray-400 transition hover:text-white"
                >
                  ✕
                </button>
              )}

              <button
                onClick={handleSearch}
                className="rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black transition-colors duration-300 hover:bg-violet-200"
              >
                Search
              </button>
            </div>

            <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 text-sm">
              {SUGGESTIONS.map((name) => (
                <button
                  key={name}
                  onClick={() => pickSuggestion(name)}
                  className="shrink-0 rounded-full border border-white/10 px-4 py-1.5 text-gray-300 transition duration-300 hover:border-white/40 hover:bg-white/5 hover:text-white"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {popular.length > 0 && (
            <div className="flex gap-3">
              {popular.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setFeatured(i)}
                  aria-label={`Show ${item.title.romaji}`}
                  className={`relative h-20 w-14 shrink-0 overflow-hidden rounded-xl border transition-all duration-500 ${
                    i === featured
                      ? "scale-105 border-white/70"
                      : "border-white/10 opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={item.coverImage.large}
                    alt=""
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  {i === featured && (
                    // Fills up over the 6 seconds before the next slide
                    <span
                      key={featured}
                      className="absolute inset-x-0 bottom-0 h-1 origin-left animate-[progress_6s_linear_both] bg-white"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [anime, setAnime] = useState<Anime[]>([]);
  const [popular, setPopular] = useState<Anime[]>([]); // top 5 for the hero
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const loadAnime = useCallback(async (query: string) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const url = query
        ? `/api/anime?search=${encodeURIComponent(query)}`
        : "/api/anime";
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data.errors) {
        throw new Error(
          data.errors?.[0]?.message ?? data.error ?? "Request failed"
        );
      }

      if (currentRequest === requestId.current) {
        const media: Anime[] = data.data.Page.media;
        setAnime(media);
        setActiveQuery(query);
        // Remember the popular list for the hero slideshow
        if (!query) setPopular(media.slice(0, 5));
      }
    } catch (e) {
      if (currentRequest === requestId.current) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadAnime("");
  }, [loadAnime]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#07070a] text-white">
      <Hero popular={popular} activeQuery={activeQuery} onSearch={loadAnime} />

      <div className="relative mx-auto max-w-7xl">
        <LibraryRows />

        {/* ---------- RESULTS ---------- */}
        <section id="results" className="scroll-mt-24 px-6 py-24 sm:px-10">
          <Reveal>
            <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-4xl font-black tracking-tighter md:text-6xl">
                {activeQuery ? `Results for "${activeQuery}"` : "Popular right now"}
              </h2>

              {anime.length > 0 && (
                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-gray-300">
                  {anime.length} titles
                </span>
              )}
            </div>
          </Reveal>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && anime.length === 0 && (
            <p className="text-gray-400">
              No results found. Try a different title.
            </p>
          )}

          {/* Placeholder cards while the first load is in progress */}
          {loading && anime.length === 0 && (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[2/3] w-full rounded-3xl bg-white/10" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-white/10" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-white/5" />
                </div>
              ))}
            </div>
          )}

          {anime.length > 0 && (
            <div
              className={`grid grid-cols-2 gap-x-6 gap-y-12 transition-opacity duration-300 sm:grid-cols-3 lg:grid-cols-5 ${
                loading ? "opacity-40" : "opacity-100"
              }`}
            >
              {anime.map((item, index) => (
                // key includes the query so new results animate in again
                <AnimeCard
                  key={`${activeQuery}-${item.id}`}
                  item={item}
                  index={index}
                  activeQuery={activeQuery}
                />
              ))}
            </div>
          )}
        </section>

        {/* ---------- FOOTER ---------- */}
        <footer className="border-t border-white/10 px-6 py-14 sm:px-10">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs">
              <p className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-violet-300 to-fuchsia-500 text-base font-black text-black">
                  A
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  Anime<span className="text-violet-300">Tracker</span>
                </span>
              </p>
              <p className="mt-4 text-sm text-gray-500">
                Discover anime, track every episode and keep your whole list in
                one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-x-10 gap-y-3 text-sm text-gray-400">
              {FOOTER_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          <p className="mt-12 text-sm text-gray-600">
            Anime data from{" "}
            <a
              href="https://anilist.co"
              target="_blank"
              rel="noreferrer"
              className="text-gray-500 transition hover:text-violet-300"
            >
              AniList
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}