"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  STATUSES,
  getEntry,
  removeEntry,
  saveEntry,
  setProgress,
} from "./library";
import type { LibraryEntry, Status } from "./library";
import { getCurrentUser } from "./auth";

const DOT: Record<string, string> = {
  Watching: "bg-green-400",
  Completed: "bg-blue-400",
  "Plan to Watch": "bg-yellow-400",
  Dropped: "bg-red-400",
};

function dotClass(status: string): string {
  return DOT[status] ?? "bg-gray-400";
}

export default function AddToLibrary({
  animeId,
  episodes,
}: {
  animeId: number;
  episodes: number | null;
}) {
  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  // Where the dropdown is drawn on the screen
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const user = await getCurrentUser();
        const found = user ? await getEntry(animeId) : null;
        if (cancelled) return;
        setLoggedIn(!!user);
        setEntry(found);
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

  // Reload the entry when the video player saves your progress or adds the anime
  useEffect(() => {
    async function refresh() {
      try {
        const user = await getCurrentUser();
        setLoggedIn(!!user);
        setEntry(user ? await getEntry(animeId) : null);
      } catch {
        // ignore: the numbers will fix themselves on the next page load
      }
    }

    window.addEventListener("library-updated", refresh);
    return () => window.removeEventListener("library-updated", refresh);
  }, [animeId]);

  // Close the menu when clicking outside, pressing Esc, scrolling or resizing
  useEffect(() => {
    if (!open) return;

    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      const inButton = menuRef.current?.contains(target);
      const inList = listRef.current?.contains(target);
      if (!inButton && !inList) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function close() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // The menu is 240px wide; keep it inside the screen
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 248));
      setPos({ top: rect.bottom + 12, left });
    }
    setOpen(true);
  }

  // Runs a save/update/remove action and shows any error on screen
  async function run(action: () => Promise<LibraryEntry | null>) {
    setError(null);
    try {
      setEntry(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const choose = (status: Status) => {
    setOpen(false);
    run(() => saveEntry(animeId, status, episodes));
  };

  const step = (change: number) =>
    run(() => setProgress(animeId, (entry?.watched ?? 0) + change, episodes));

  const remove = () => {
    setOpen(false);
    run(async () => {
      await removeEntry(animeId);
      return null;
    });
  };

  if (!ready) return <div className="mt-8 h-14" />;

  if (!loggedIn) {
    return (
      <div className="mt-8">
        <a
          href="/login"
          className="inline-block rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-black shadow-xl shadow-violet-900/30 transition duration-300 hover:scale-[1.03] hover:bg-violet-200"
        >
          Log in to track this anime
        </a>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    );
  }

  const percent =
    entry && episodes
      ? Math.min(100, Math.round((entry.watched / episodes) * 100))
      : 0;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <div ref={menuRef} className="relative">
          <button
            ref={buttonRef}
            onClick={toggleMenu}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={`flex items-center gap-3 rounded-full px-7 py-3.5 text-sm font-semibold transition duration-300 ${
              entry
                ? "glass text-white hover:bg-white/10"
                : "bg-white text-black shadow-xl shadow-violet-900/30 hover:scale-[1.03] hover:bg-violet-200"
            }`}
          >
            {entry ? (
              <>
                <span
                  className={`h-2 w-2 rounded-full ${dotClass(entry.status)}`}
                />
                {entry.status}
              </>
            ) : (
              "+ Add to My Anime"
            )}
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`h-4 w-4 opacity-70 transition-transform duration-300 ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* The dropdown is drawn on top of the whole page (portal) and is fully solid */}
      {open &&
        pos &&
        createPortal(
          <ul
            ref={listRef}
            role="listbox"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              backgroundColor: "#12121a",
              opacity: 1,
              backdropFilter: "none",
            }}
            className="z-[100] w-60 overflow-hidden rounded-3xl border border-white/10 bg-[#12121a] p-1.5 shadow-2xl shadow-black/80"
          >
            {STATUSES.map((s) => {
              const active = entry?.status === s;
              return (
                <li key={s}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => choose(s)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition hover:bg-white/10 ${
                      active ? "bg-white/5 text-white" : "text-gray-300"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${dotClass(s)}`}
                    />
                    <span className="flex-1">{s}</span>
                    {active && <span className="text-violet-300">✓</span>}
                  </button>
                </li>
              );
            })}

            {entry && (
              <>
                <li className="my-1.5 border-t border-white/10" />
                <li>
                  <button
                    onClick={remove}
                    className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-red-400 transition hover:bg-red-500/10"
                  >
                    <span className="h-2 w-2 shrink-0" />
                    Remove from list
                  </button>
                </li>
              </>
            )}
          </ul>,
          document.body
        )}

      {entry && (
        <div className="glass mt-5 max-w-sm rounded-3xl p-4">
          <div className="flex items-center justify-between gap-3 text-sm text-gray-300">
            <button
              onClick={() => step(-1)}
              disabled={entry.watched <= 0}
              aria-label="Watched one less episode"
              className="h-10 w-10 rounded-full bg-white/10 text-lg transition hover:bg-white/20 disabled:opacity-30"
            >
              −
            </button>

            <span className="font-medium">
              {entry.watched} / {episodes ?? "?"} episodes
            </span>

            <button
              onClick={() => step(1)}
              disabled={episodes !== null && entry.watched >= episodes}
              aria-label="Watched one more episode"
              className="h-10 w-10 rounded-full bg-white/10 text-lg transition hover:bg-white/20 disabled:opacity-30"
            >
              +
            </button>
          </div>

          {episodes && (
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-linear-to-r from-violet-400 to-fuchsia-400 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}