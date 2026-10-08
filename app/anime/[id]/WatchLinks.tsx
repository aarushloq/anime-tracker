"use client";

import { getLinks } from "../../lib/episodeLinks";
import type { EpisodeLink } from "../../lib/episodeLinks";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { getEntry, saveEntry, setProgress } from "../../lib/library";
import { getCurrentUser } from "../../lib/auth";

const HIANIME_SEARCH = "https://hianime.at/search?keyword=";
const DEFAULT_INTRO_SECONDS = 85;

// An episode counts as watched once you pass this part of it (so credits don't matter)
const WATCHED_FRACTION = 0.85;

export type ExternalLink = {
  site: string;
  url: string;
  type: string | null;
};

type Embed = { videoId: string | null; list: string | null };

// Where you stopped inside an episode (saved in this browser only)
type Resume = { ep: number; time: number };

function resumeKey(animeId: number): string {
  return `anime-resume:${animeId}`;
}

function readResume(animeId: number): Resume | null {
  try {
    const raw = localStorage.getItem(resumeKey(animeId));
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data?.ep === "number" && typeof data?.time === "number") {
      return { ep: data.ep, time: data.time };
    }
    return null;
  } catch {
    return null;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Turns a YouTube link into a video ID and/or playlist ID, or null if we can't embed it
function toEmbed(input: string): Embed | null {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^(www|m|music)\./, "");
    const listParam = url.searchParams.get("list");
    const list = listParam && /^[\w-]+$/.test(listParam) ? listParam : null;

    let videoId: string | null = null;

    if (host === "youtu.be") {
      videoId = url.pathname.slice(1).split("/")[0];
    } else if (host === "youtube.com") {
      const parts = url.pathname.split("/");

      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      } else if (["embed", "shorts", "live"].includes(parts[1])) {
        videoId = parts[2] ?? null;
      } else if (
        parts[1] === "channel" &&
        /^UC[\w-]{22}$/.test(parts[2] ?? "")
      ) {
        // A channel's "uploads" playlist is the channel ID with UC -> UU
        return { videoId: null, list: `UU${parts[2].slice(2)}` };
      }
    } else {
      return null;
    }

    const cleanVideo = videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null;

    if (cleanVideo || list) return { videoId: cleanVideo, list };
    return null;
  } catch {
    return null;
  }
}

// Extra settings for "Clean player"
const CLEAN_PARAMS = "controls=0&cc_load_policy=0&disablekb=1&fs=0";

export default function WatchLinks({
  title,
  externalLinks,
}: {
  title: string;
  externalLinks: ExternalLink[] | null;
}) {
  const routeParams = useParams<{ id: string }>();
  const animeId = Number(routeParams.id);

  // Official free YouTube uploads, as listed on AniList
  const youtubeLinks = (externalLinks ?? []).filter(
    (l) =>
      l.site.toLowerCase().includes("youtube") &&
      (l.type ?? "").toUpperCase() === "STREAMING"
  );

  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [watched, setWatched] = useState(0);
  const [episodes, setEpisodes] = useState<number | null>(null);
  const [resumeInfo, setResumeInfo] = useState<Resume | null>(null);
  // ep = the episode shown in the controls; startEp = the episode the player was loaded at.
  // They differ when a playlist moves on to the next video by itself.
  const [ep, setEp] = useState(1);
  const [startEp, setStartEp] = useState(1);
  // The second and play/pause state the player loads with (used after a reload)
  const [startTime, setStartTime] = useState(0);
  const [startPlay, setStartPlay] = useState(true);
  const [epInput, setEpInput] = useState("1");
  const [clean, setClean] = useState(false);
  const [malId, setMalId] = useState<number | null>(null);
  const [savedLinks, setSavedLinks] = useState<EpisodeLink[]>([]);

  const playerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Latest info that YouTube tells us about the video
  const timeRef = useRef(0);
  const durationRef = useRef(0);
  const playingRef = useRef(true);
  const lastStateRef = useRef(0);

  // Where the intro ends for the current episode (null = unknown)
  const introEndRef = useRef<number | null>(null);

  // Backup for the jump: if the player ignores the start time, we seek once it is ready
  const seekFallbackRef = useRef<{ time: number } | null>(null);
  const ignoreFollowUntilRef = useRef(0);
  const needJumpRef = useRef(false);

  // Bookkeeping so the same episode isn't counted twice
  const markedEpRef = useRef(0);
  const lastEndedAtRef = useRef(0);
  const lastSaveAtRef = useRef(0);

  // Latest values for code that runs outside of React's render (the YouTube message listener)
  const live = useRef({
    ep: 1,
    watched: 0,
    episodes: null as number | null,
    isPlaylist: false,
  });

  // The episode to start from: the one after your last watched, or episode 1 for a rewatch
  function resumeEpisode(w: number, total: number | null): number {
    if (total && w >= total) return 1;
    return w + 1;
  }

  // Reads your tracked progress from the database
  async function refreshWatched(): Promise<number> {
    setResumeInfo(readResume(animeId));
    try {
      const user = await getCurrentUser();
      if (!user || !Number.isFinite(animeId)) return 0;
      const entry = await getEntry(animeId);
      const w = entry?.watched ?? 0;
      setWatched(w);
      live.current.watched = w;
      return w;
    } catch {
      return 0; // not logged in: start from the beginning
    }
  }

  // Puts the anime on your Watching list when you start watching it
  async function ensureWatching() {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const entry = await getEntry(animeId);
      if (
        !entry ||
        entry.status === "Plan to Watch" ||
        entry.status === "Dropped"
      ) {
        await saveEntry(animeId, "Watching", live.current.episodes);
        // Tells the "Add to My Anime" box on this page to reload
        window.dispatchEvent(new Event("library-updated"));
      }
    } catch {
      // saving failed: the player still works
    }
  }

  // Opens the player at the right episode (and the right second, if you stopped mid-episode)
  function openAt(w: number) {
    ignoreFollowUntilRef.current = Date.now() + 4000;
    const target = resumeEpisode(w, live.current.episodes);
    const saved = readResume(animeId);
    goTo(target, saved && saved.ep === target ? saved.time : 0);
    setOpen(true);
    ensureWatching();
  }

  // Load progress on page open. With ?play=1 in the URL (from Continue Watching) the player opens by itself.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const w = await refreshWatched();
      if (cancelled) return;

      const wantsPlay =
        new URLSearchParams(window.location.search).get("play") === "1";
      if (wantsPlay && youtubeLinks.length > 0) openAt(w);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId]);

  // Get the MyAnimeList ID (AniSkip needs it) and the episode count from AniList
  useEffect(() => {
    let cancelled = false;

    async function loadMedia() {
      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query:
              "query ($id: Int) { Media(id: $id, type: ANIME) { idMal episodes } }",
            variables: { id: animeId },
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        setMalId(json?.data?.Media?.idMal ?? null);
        setEpisodes(json?.data?.Media?.episodes ?? null);
      } catch {
        // no MAL id: we will use the default intro length
      }
    }

    if (Number.isFinite(animeId)) loadMedia();
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  // Get the intro end time for the current episode from AniSkip
  useEffect(() => {
    let cancelled = false;
    introEndRef.current = null;

    async function loadIntro() {
      try {
        const res = await fetch(
          `https://api.aniskip.com/v2/skip-times/${malId}/${ep}?types[]=op&episodeLength=0`
        );
        const json = await res.json();
        const op = (json?.results ?? []).find(
          (r: { skipType: string }) => r.skipType === "op"
        );
        if (!cancelled && op?.interval?.endTime) {
          introEndRef.current = op.interval.endTime;
        }
      } catch {
        // not found: we will use the default intro length
      }
    }

    if (malId) loadIntro();
    return () => {
      cancelled = true;
    };
  }, [malId, ep]);

  const current = youtubeLinks[active] ?? null;
  const embed = current ? toEmbed(current.url) : null;
  const isPlaylist = !!embed?.list;

  // Keep the "live" copy up to date for the YouTube message listener
  useEffect(() => {
    live.current.ep = ep;
    live.current.watched = watched;
    live.current.episodes = episodes;
    live.current.isPlaylist = isPlaylist;
  }, [ep, watched, episodes, isPlaylist]);

  // Player settings. "start" makes the video begin at a given second, "autoplay=0" keeps it paused.
  const params =
    `autoplay=${startPlay ? 1 : 0}&rel=0&modestbranding=1&iv_load_policy=3` +
    `&playsinline=1&enablejsapi=1` +
    (startTime > 0 ? `&start=${Math.floor(startTime)}` : "") +
    (clean ? `&${CLEAN_PARAMS}` : "");

  // The player loads at startEp. When a playlist advances by itself we do NOT change
  // startEp, so the video doesn't reload.
  let src: string | null = null;
  if (embed?.list) {
    src = `https://www.youtube-nocookie.com/embed/videoseries?list=${embed.list}&index=${startEp - 1}&${params}`;
  } else if (embed?.videoId) {
    src = `https://www.youtube-nocookie.com/embed/${embed.videoId}?${params}`;
  }

  const youtubeUrl = embed?.list
    ? `https://www.youtube.com/watch?list=${embed.list}&index=${ep}`
    : current?.url ?? "https://www.youtube.com";

  // Sends a command (like "playVideo") to the YouTube player
  function sendCommand(func: string, args: unknown[] = []) {
    const message = JSON.stringify({ event: "command", func: func, args: args });
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }

  // Tells YouTube to start sending us the current time and play state
  function startListening() {
    const message = JSON.stringify({ event: "listening", id: 1, channel: "widget" });
    iframeRef.current?.contentWindow?.postMessage(message, "*");
  }

  // Runs every time the player (re)loads
  function onPlayerLoad() {
    durationRef.current = 0;
    timeRef.current = 0;
    lastStateRef.current = 0;
    playingRef.current = startPlay;
    startListening();
    needJumpRef.current = live.current.isPlaylist && live.current.ep > 1;
  }

  function seekBy(seconds: number) {
    const newTime = Math.max(0, timeRef.current + seconds);
    timeRef.current = newTime;
    sendCommand("seekTo", [newTime, true]);
  }

  function skipIntro() {
    if (introEndRef.current !== null) {
      timeRef.current = introEndRef.current;
      sendCommand("seekTo", [introEndRef.current, true]);
    } else {
      seekBy(DEFAULT_INTRO_SECONDS);
    }
  }

  function togglePlay() {
    if (playingRef.current) {
      sendCommand("pauseVideo");
      playingRef.current = false;
    } else {
      sendCommand("playVideo");
      playingRef.current = true;
    }
  }

  function goFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerRef.current?.requestFullscreen();
    }
  }

  // Remembers the second you are at (in this browser) so the next visit can continue from it
  function saveResume() {
    try {
      if (timeRef.current < 10) return;
      localStorage.setItem(
        resumeKey(animeId),
        JSON.stringify({ ep: live.current.ep, time: Math.floor(timeRef.current) })
      );
    } catch {
      // storage unavailable: no mid-episode resume, everything else still works
    }
  }

  // Saves "episode N watched" to your library (adds the anime as Watching if it isn't there yet)
  async function markWatched(finished: number) {
    const total = live.current.episodes;
    if (finished <= live.current.watched) return; // never move progress backwards

    try {
      const user = await getCurrentUser();
      if (!user) return;

      let entry = await getEntry(animeId);
      if (!entry) entry = await saveEntry(animeId, "Watching", total);
      if (finished <= entry.watched) {
        setWatched(entry.watched);
        live.current.watched = entry.watched;
        return;
      }

      const updated = await setProgress(animeId, finished, total);
      setWatched(updated.watched);
      live.current.watched = updated.watched;
      window.dispatchEvent(new Event("library-updated"));
    } catch {
      // saving failed: nothing breaks, the episode just isn't counted
    }
  }

  // Listen to messages from YouTube so we always know the time and play state
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!String(e.origin).includes("youtube")) return;

      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data?.event !== "infoDelivery" || !data.info) return;
        const info = data.info;

        if (typeof info.currentTime === "number") {
          timeRef.current = info.currentTime;
        }
        if (typeof info.duration === "number" && info.duration > 0) {
          durationRef.current = info.duration;
        }
        if (typeof info.playerState === "number") {
          lastStateRef.current = info.playerState;
          // 1 = playing, 2 = paused
          if (info.playerState === 1) playingRef.current = true;
          if (info.playerState === 2) playingRef.current = false;
        }

        // Backup jump: if the player ignored the start time, seek once it is ready
        const fallback = seekFallbackRef.current;
        if (fallback && durationRef.current > 0) {
          seekFallbackRef.current = null;
          if (timeRef.current < fallback.time - 5) {
            timeRef.current = fallback.time;
            sendCommand("seekTo", [fallback.time, true]);
          }
        }

        // If a playlist moved to another video (e.g. YouTube's own next button), follow it
        // Make sure the playlist is on the episode we asked for (YouTube may ignore the index)
        if (needJumpRef.current && typeof info.playlistIndex === "number") {
          needJumpRef.current = false;
          const wanted = live.current.ep - 1;
          if (info.playlistIndex !== wanted) {
            sendCommand("playVideoAt", [wanted]);
          }
        }

        // If a playlist moved to another video by itself, follow it
        // (ignored for a few seconds after you pick an episode)
        if (
          live.current.isPlaylist &&
          lastStateRef.current === 1 &&
          Date.now() > ignoreFollowUntilRef.current &&
          typeof info.playlistIndex === "number"
        ) {
          const idx = info.playlistIndex + 1;
          const total = live.current.episodes;
          if (idx !== live.current.ep && (!total || idx <= total)) {
            live.current.ep = idx;
            setEp(idx);
            setEpInput(String(idx));
          }
        }

        // While playing: count the episode once you pass the limit, and remember your position
        if (
          typeof info.currentTime === "number" &&
          durationRef.current > 0 &&
          lastStateRef.current === 1
        ) {
          const currentEp = live.current.ep;
          if (
            timeRef.current / durationRef.current >= WATCHED_FRACTION &&
            markedEpRef.current !== currentEp
          ) {
            markedEpRef.current = currentEp;
            markWatched(currentEp);
          }

          const now = Date.now();
          if (now - lastSaveAtRef.current > 5000) {
            lastSaveAtRef.current = now;
            saveResume();
          }
        }

        // The video reached its end
        if (info.playerState === 0) {
          const now = Date.now();
          if (now - lastEndedAtRef.current < 3000) return; // duplicate message
          lastEndedAtRef.current = now;

          const { ep: finished, episodes: total, isPlaylist: playlist } = live.current;

          if (markedEpRef.current !== finished) {
            markedEpRef.current = finished;
            markWatched(finished);
          }

          // A playlist starts the next video by itself, so move the counter along
          const next = finished + 1;
          if (playlist && (!total || next <= total)) {
            live.current.ep = next;
            setEp(next);
            setEpInput(String(next));
          }
        }
      } catch {
        // ignore messages we don't understand
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId]);

  // Save your position when you leave or reload the page
  useEffect(() => {
    function onLeave() {
      if (iframeRef.current) saveResume();
    }
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId]);

  // Keyboard shortcuts (only in Clean player mode)
  useEffect(() => {
    if (!open || !clean) return;

    function isTyping(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      return target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTyping(e)) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        seekBy(10);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekBy(-10);
      } else if (e.key === " " || e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        goFullscreen();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        skipIntro();
      }
    }

    // Stops Space from also "clicking" a button that has focus
    function onKeyUp(e: KeyboardEvent) {
      if (isTyping(e)) return;
      if (e.key === " ") e.preventDefault();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [open, clean]);

  // Jumps to an episode and reloads the player there. seekTime > 0 continues from that second.
  function goTo(n: number, seekTime = 0) {
    let next = Math.max(1, Math.floor(n) || 1);
    const total = live.current.episodes;
    if (total) next = Math.min(next, total);

    seekFallbackRef.current = seekTime > 0 ? { time: seekTime } : null;
    markedEpRef.current = 0;
    live.current.ep = next;
    setEp(next);
    setStartEp(next);
    setStartTime(seekTime);
    setStartPlay(true);
    setEpInput(String(next));
  }

  async function toggle() {
    if (open) {
      saveResume();
      setResumeInfo(readResume(animeId));
      setOpen(false);
      return;
    }
    // Re-read your progress so it's right even if you just changed it with + / -
    const w = await refreshWatched();
    openAt(w);
  }

  function pick(i: number) {
    setActive(i);
    goTo(resumeEpisode(watched, episodes));
  }

  // Switching Clean player reloads the video, so remember the exact second and continue from it
  function toggleClean() {
    if (src) {
      const time = timeRef.current;
      seekFallbackRef.current = time > 3 ? { time } : null;
      setStartTime(time);
      setStartPlay(playingRef.current);
      setStartEp(live.current.ep); // stay on the episode that is playing now
    }
    setClean((c) => !c);
  }

  const nextEp = resumeEpisode(watched, episodes);
  const hiLink = savedLinks.find(
    (l) => l.episode === nextEp && !l.url.includes("youtu")
  );
  const rewatch = !!episodes && watched >= episodes;
  const savedTime =
    resumeInfo && resumeInfo.ep === nextEp && resumeInfo.time >= 10
      ? resumeInfo.time
      : 0;

  const resumeLabel =
    savedTime > 0
      ? `Continue Episode ${nextEp} (${formatTime(savedTime)})`
      : rewatch
        ? "Rewatch from Episode 1"
        : watched > 0
          ? `Continue Episode ${nextEp}`
          : "Start Episode 1";

  const controlButton =
    "rounded-full bg-white/10 px-5 py-2.5 text-sm text-gray-100 transition duration-300 hover:bg-white/20";

  // Load the episode links you saved for this anime
useEffect(() => {
  getLinks(animeId).then(setSavedLinks).catch(() => {});
}, [animeId]);

// Refresh the count when it changes elsewhere (for example the + button)
useEffect(() => {
  window.addEventListener("library-updated", refreshWatched);
  return () => window.removeEventListener("library-updated", refreshWatched);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [animeId]);

  return (
    <section className="glass mt-12 rounded-[2rem] p-6 sm:p-8">
      <h2 className="text-2xl font-black tracking-tight">Where to watch</h2>

      <div className="mt-5 flex flex-wrap gap-3">
        {youtubeLinks.length > 0 && (
          <button
            onClick={toggle}
            aria-expanded={open}
            className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition duration-300 hover:scale-[1.03] hover:bg-red-500"
          >
            {open ? "✕ Close" : `▶ ${resumeLabel} on YouTube`}
          </button>
        )}

        <a
          href={hiLink ? hiLink.url : `${HIANIME_SEARCH}${encodeURIComponent(title)}`}
          onClick={ensureWatching}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white transition duration-300 hover:bg-white/10"
        >
          {hiLink ? `Continue Episode ${nextEp} on HiAnime ↗` : "Search on HiAnime ↗"}
        </a>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {youtubeLinks.length > 0
          ? "YouTube plays here (official). HiAnime opens in a new tab."
          : "No official YouTube upload listed. HiAnime opens in a new tab."}
      </p>

      {open && current && (
        <div className="mt-6">
          {youtubeLinks.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {youtubeLinks.map((l, i) => (
                <button
                  key={l.url}
                  onClick={() => pick(i)}
                  className={`rounded-full px-4 py-1.5 text-xs transition ${
                    i === active
                      ? "bg-red-600 text-white"
                      : "bg-white/10 text-gray-300 hover:bg-white/20"
                  }`}
                >
                  Upload {i + 1}
                </button>
              ))}
            </div>
          )}

          {src && (
            <div
              ref={playerRef}
              className="flex items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl shadow-black/60"
            >
              {/* This box is the visible video area */}
              <div className="relative aspect-video w-full overflow-hidden">
                <iframe
                  key={src}
                  ref={iframeRef}
                  src={src}
                  onLoad={onPlayerLoad}
                  title={`${title} on YouTube`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="absolute left-0 w-full"
                  // In clean mode the iframe is taller than the box and moved up,
                  // so YouTube's top and bottom bars fall outside the visible area
                  style={
                    clean
                      ? { top: "-40%", height: "180%" }
                      : { top: 0, height: "100%" }
                  }
                />

                {/* Invisible layer: blocks YouTube's hover UI, click = play/pause */}
                {clean && (
                  <div
                    onClick={togglePlay}
                    onDoubleClick={goFullscreen}
                    className="absolute inset-0 cursor-pointer"
                  />
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isPlaylist && (
              <div className="flex items-center gap-1 rounded-full bg-white/10 p-1">
                <button
                  onClick={() => goTo(ep - 1)}
                  disabled={ep <= 1}
                  aria-label="Previous episode"
                  className="h-9 w-9 rounded-full text-sm transition hover:bg-white/10 disabled:opacity-30"
                >
                  ◀
                </button>

                <label className="flex items-center gap-1.5 px-1 text-xs text-gray-400">
                  Ep
                  <input
                    type="number"
                    min={1}
                    value={epInput}
                    onChange={(e) => setEpInput(e.target.value)}
                    onBlur={() => goTo(Number(epInput))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") goTo(Number(epInput));
                    }}
                    aria-label="Episode number"
                    className="w-14 rounded-full bg-black/40 px-2 py-1.5 text-center text-sm text-white outline-none focus:ring-1 focus:ring-violet-400"
                  />
                </label>

                <button
                  onClick={() => goTo(ep + 1)}
                  aria-label="Next episode"
                  className="h-9 w-9 rounded-full text-sm transition hover:bg-white/10"
                >
                  ▶
                </button>
              </div>
            )}

            <button
              onClick={toggleClean}
              aria-pressed={clean}
              className={`rounded-full px-5 py-2.5 text-sm transition duration-300 ${
                clean
                  ? "bg-white text-black"
                  : "bg-white/10 text-gray-100 hover:bg-white/20"
              }`}
            >
              {clean ? "Clean player: ON" : "Clean player: OFF"}
            </button>

            <button onClick={skipIntro} className={controlButton}>
              ⏭ Skip intro
            </button>

            <button onClick={goFullscreen} className={controlButton}>
              ⛶ Fullscreen
            </button>

            <a
              href={youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={controlButton}
            >
              {isPlaylist ? `Open ep ${ep} on YouTube ↗` : "Open on YouTube ↗"}
            </a>
          </div>

          {clean && (
            <p className="mt-3 text-xs text-gray-500">
              Keys: ← → seek 10s, Space or K play/pause, S skip intro, F
              fullscreen. Click the video to play or pause, double-click for
              fullscreen.
            </p>
          )}
        </div>
      )}
    </section>
  );
}