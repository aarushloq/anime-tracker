"use client";

import { useEffect, useState } from "react";
import {
  addLink,
  getLinks,
  getYouTubeEmbed,
  hostOf,
  removeLink,
} from "./episodeLinks";
import type { EpisodeLink } from "./episodeLinks";
import { getCurrentUser } from "./auth";

const INPUT =
  "rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-500 focus:border-violet-300/60 focus:bg-white/10";

export default function EpisodeLinksSection({
  animeId,
  title,
  episodes,
}: {
  animeId: number;
  title: string;
  episodes: number | null;
}) {
  const [links, setLinks] = useState<EpisodeLink[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [episode, setEpisode] = useState("1");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await getCurrentUser();
        const found = await getLinks(animeId);
        if (cancelled) return;
        setLoggedIn(!!user);
        setLinks(found);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  async function handleAdd() {
    setError(null);

    const episodeNumber = Number(episode);
    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
      setError("Enter a valid episode number");
      return;
    }
    if (episodes !== null && episodeNumber > episodes) {
      setError(`This anime only has ${episodes} episodes`);
      return;
    }

    setSaving(true);
    try {
      const created = await addLink(animeId, episodeNumber, url, label);
      setLinks((prev) => [created, ...prev]);
      setUrl("");
      setLabel("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await removeLink(id);
      setLinks((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  // Group links by episode number, ascending
  const grouped = new Map<number, EpisodeLink[]>();
  for (const link of links) {
    const list = grouped.get(link.episode) ?? [];
    list.push(link);
    grouped.set(link.episode, list);
  }
  const episodeNumbers = [...grouped.keys()].sort((a, b) => a - b);

  if (!ready) return <div className="mt-10 h-24" />;

  return (
    <section className="glass mt-12 rounded-[2rem] p-6 sm:p-8">
      <h2 className="text-2xl font-black tracking-tight">Episode links</h2>

      <div className="mt-5">
        {loggedIn ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={episodes ?? undefined}
              value={episode}
              onChange={(e) => setEpisode(e.target.value)}
              aria-label="Episode number"
              className={`w-24 ${INPUT}`}
            />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste link"
              aria-label="Episode link"
              className={`min-w-[200px] flex-1 ${INPUT}`}
            />
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              aria-label="Label"
              maxLength={60}
              className={`w-44 ${INPUT}`}
            />
            <button
              onClick={handleAdd}
              disabled={saving || !url.trim()}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black transition duration-300 hover:bg-violet-200 disabled:opacity-40"
            >
              {saving ? "Adding..." : "Add link"}
            </button>
          </div>
        ) : (
          <a
            href="/login"
            className="inline-block rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition duration-300 hover:bg-violet-200"
          >
            Log in to save episode links for {title}
          </a>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {episodeNumbers.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          No links saved yet. Paste one above to add it.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {episodeNumbers.map((ep) => (
            <div key={ep}>
              <h3 className="mb-3 text-sm font-semibold text-gray-300">
                Episode {ep}
              </h3>

              <ul className="space-y-2">
                {grouped.get(ep)!.map((link) => {
                  const embed = getYouTubeEmbed(link.url);
                  const isOpen = openPlayer === link.id;

                  return (
                    <li
                      key={link.id}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition duration-300 hover:border-white/25"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-violet-300 transition hover:text-violet-200"
                        >
                          {link.label ?? hostOf(link.url)}
                          <span className="ml-2 text-xs text-gray-500">
                            {hostOf(link.url)}
                          </span>
                        </a>

                        <div className="flex shrink-0 items-center gap-3">
                          {embed && (
                            <button
                              onClick={() =>
                                setOpenPlayer(isOpen ? null : link.id)
                              }
                              className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200 transition hover:bg-white/20"
                            >
                              {isOpen ? "Hide" : "Play"}
                            </button>
                          )}
                          {loggedIn && (
                            <button
                              onClick={() => handleRemove(link.id)}
                              className="text-xs text-red-400 transition hover:text-red-300"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>

                      {embed && isOpen && (
                        <div className="mt-4 aspect-video max-w-xl overflow-hidden rounded-2xl border border-white/10">
                          <iframe
                            src={embed}
                            title={link.label ?? `Episode ${ep}`}
                            allowFullScreen
                            className="h-full w-full"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
