"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AddToLibrary from "../../lib/AddToLibrary";
import Reveal from "../../lib/Reveal";
import WatchLinks from "./WatchLinks";

type AnimeDetail = {
  id: number;
  title: {
    romaji: string;
    english: string | null;
  };
  coverImage: {
    large: string;
    extraLarge: string | null;
  };
  bannerImage: string | null;
  description: string | null;
  episodes: number | null;
  status: string | null;
  genres: string[] | null;
  averageScore: number | null;
  seasonYear: number | null;
  format: string | null;
  studios: {
    nodes: {
      name: string;
    }[];
  } | null;
  trailer: {
    id: string;
    site: string;
  } | null;
  externalLinks:
    | { site: string; url: string; type: string | null }[]
    | null;
};

export default function AnimeDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/anime/${id}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load anime");
        }

        if (!cancelled) {
          setAnime(data);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (anime) {
      document.title = `${anime.title.romaji} | AnimeTracker`;
    }
  }, [anime]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07070a] text-white">
        <div className="mx-auto max-w-6xl animate-pulse px-6 py-12 sm:px-10">
          <div className="flex flex-col gap-12 md:flex-row">
            <div className="aspect-[2/3] w-64 rounded-[2rem] bg-white/10" />

            <div className="w-full max-w-2xl">
              <div className="h-14 w-3/4 rounded-2xl bg-white/10" />
              <div className="mt-5 h-4 w-1/2 rounded bg-white/10" />
              <div className="mt-8 grid grid-cols-3 gap-3">
                <div className="h-20 rounded-2xl bg-white/10" />
                <div className="h-20 rounded-2xl bg-white/10" />
                <div className="h-20 rounded-2xl bg-white/10" />
              </div>
              <div className="mt-8 h-4 w-full rounded bg-white/10" />
              <div className="mt-3 h-4 w-full rounded bg-white/10" />
              <div className="mt-3 h-4 w-2/3 rounded bg-white/10" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !anime) {
    return (
      <main className="min-h-screen bg-[#07070a] px-6 py-16 text-white sm:px-10">
        <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-red-300">{error ?? "Anime not found"}</p>

          <a
            href="/"
            className="mt-6 inline-block rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-violet-200"
          >
            Back to home
          </a>
        </div>
      </main>
    );
  }

  const description = anime.description?.replace(/<[^>]*>/g, " ").trim();

  const studio = anime.studios?.nodes?.[0]?.name;

  // If there is no banner, the cover is used as the backdrop
  const hasBanner = !!anime.bannerImage;
  const backdrop = anime.bannerImage ?? anime.coverImage.large;

  // The small info tiles under the title (only the ones that have a value)
  const stats: { label: string; value: string }[] = [];
  if (anime.format) stats.push({ label: "Format", value: anime.format });
  if (anime.seasonYear)
    stats.push({ label: "Year", value: String(anime.seasonYear) });
  stats.push({ label: "Episodes", value: String(anime.episodes ?? "?") });
  if (anime.status)
    stats.push({ label: "Status", value: anime.status.replaceAll("_", " ") });
  if (studio) stats.push({ label: "Studio", value: studio });

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07070a] text-white">
      {/* Cinematic backdrop that melts into the page (slides under the navbar) */}
      <div className="relative -mt-[88px] h-[65vh] w-full overflow-hidden">
        <img
          src={backdrop}
          alt=""
          aria-hidden
          className={`h-full w-full animate-[slowZoom_20s_ease-out_both] object-cover motion-reduce:animate-none ${
            hasBanner ? "opacity-60" : "opacity-40 saturate-150"
          }`}
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#07070a] via-[#07070a]/60 to-[#07070a]/20" />
        <div className="pointer-events-none absolute -right-32 -top-10 h-[34rem] w-[34rem] bg-[radial-gradient(closest-side,rgba(124,58,237,0.28),transparent)]" />
      </div>

      <div className="relative z-10 mx-auto -mt-72 max-w-6xl px-6 pb-24 sm:px-10">
        <div className="flex flex-col gap-12 md:flex-row">
          {/* Poster with glow */}
          <Reveal className="shrink-0">
            <div className="relative w-64">
              <div className="pointer-events-none absolute -inset-10 bg-[radial-gradient(closest-side,rgba(139,92,246,0.35),transparent)]" />
              <img
                src={anime.coverImage.extraLarge ?? anime.coverImage.large}
                alt={anime.title.romaji}
                className="relative aspect-[2/3] w-full rounded-[2rem] border border-white/15 object-cover shadow-2xl shadow-black/70"
              />
            </div>
          </Reveal>

          <div className="min-w-0 max-w-2xl flex-1">
            <Reveal delay={100}>
              <h1 className="text-5xl font-black leading-[0.95] tracking-tighter [text-wrap:balance] md:text-7xl">
                {anime.title.romaji}
              </h1>

              {anime.title.english &&
                anime.title.english !== anime.title.romaji && (
                  <p className="mt-3 text-lg text-gray-400">
                    {anime.title.english}
                  </p>
                )}

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {anime.averageScore !== null && (
                  <span className="rounded-full bg-yellow-300/15 px-4 py-1.5 text-sm font-semibold text-yellow-300">
                    ★ {anime.averageScore}%
                  </span>
                )}
                {(anime.genres ?? []).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-gray-300 transition duration-300 hover:border-white/40 hover:text-white"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stats.map((s) => (
                  <div
                    key={s.label}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5"
                  >
                    <p className="text-xs text-gray-500">{s.label}</p>
                    <p className="mt-1 truncate text-sm font-medium text-gray-100">
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={300}>
              <AddToLibrary animeId={anime.id} episodes={anime.episodes} />
            </Reveal>

            {description && (
              <Reveal>
                <p className="mt-10 max-w-prose leading-relaxed text-gray-300">
                  {description}
                </p>
              </Reveal>
            )}

            {/* No Reveal wrapper here: the video player must not sit inside
                an animated element */}
            <WatchLinks
              title={anime.title.romaji}
              externalLinks={anime.externalLinks}
            />
          </div>
        </div>

        {anime.trailer?.site === "youtube" && (
          <Reveal className="mt-24">
            <h2 className="mb-6 text-4xl font-black tracking-tighter">
              Trailer
            </h2>

            <div className="aspect-video max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/60">
              <iframe
                src={`https://www.youtube.com/embed/${anime.trailer.id}`}
                title="Trailer"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </Reveal>
        )}
      </div>
    </main>
  );
}