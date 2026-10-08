import { NextResponse } from "next/server";

type YouTubeItem = {
  id: { videoId?: string; playlistId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails?: { medium?: { url: string } };
  };
};

// Channels treated as "official". Edit this list freely.
const OFFICIAL_CHANNELS = [
  "crunchyroll",
  "muse asia",
  "muse indonesia",
  "ani-one",
  "ani one",
  "aniplex",
  "netflix anime",
  "toho animation",
  "funimation",
  "hidive",
  "anime limited",
  "viz media",
  "bandai namco",
  "kadokawa",
  "shueisha",
];

// Videos with these words are almost never the real thing
const JUNK_WORDS = [
  "reaction",
  "react",
  "review",
  "amv",
  "explained",
  "recap",
  "ranking",
  "top 10",
  "gameplay",
  "fan made",
  "fanmade",
  "tier list",
];

const DURATIONS = ["short", "medium", "long"];

function decode(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Lowercase and strip everything except letters/numbers so titles compare fairly
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const type = searchParams.get("type") === "playlist" ? "playlist" : "video";
  const duration = searchParams.get("duration") ?? "";
  const officialOnly = searchParams.get("official") === "1";
  const titles = (searchParams.get("titles") ?? "")
    .split("|")
    .map((t) => normalize(t))
    .filter((t) => t.length >= 3);

  if (!q || q.length > 150 || titles.length === 0) {
    return NextResponse.json({ error: "Invalid search" }, { status: 400 });
  }

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY is missing in .env.local" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    part: "snippet",
    type,
    maxResults: "25",
    q,
    key,
  });

  if (type === "video") {
    params.set("videoEmbeddable", "true");
    if (DURATIONS.includes(duration)) {
      params.set("videoDuration", duration);
    }
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params}`,
      { next: { revalidate: 3600 } }
    );
    const json = await response.json();

    if (!response.ok) {
      console.error("[YouTube error]", response.status, JSON.stringify(json));
      return NextResponse.json(
        { error: json.error?.message ?? "YouTube search failed" },
        { status: 502 }
      );
    }

    const results = (json.items as YouTubeItem[])
      .filter((item) => item.id.videoId || item.id.playlistId)
      .map((item) => {
        const title = decode(item.snippet.title);
        const channel = decode(item.snippet.channelTitle);
        const channelLower = channel.toLowerCase();
        return {
          id: (item.id.videoId ?? item.id.playlistId) as string,
          kind: item.id.playlistId ? "playlist" : "video",
          title,
          channel,
          thumbnail: item.snippet.thumbnails?.medium?.url ?? null,
          official: OFFICIAL_CHANNELS.some((c) => channelLower.includes(c)),
        };
      })
      // Must actually be about this anime
      .filter((r) => {
        const t = normalize(r.title);
        return titles.some((name) => t.includes(name));
      })
      // No reactions, reviews, AMVs...
      .filter((r) => {
        const t = r.title.toLowerCase();
        return !JUNK_WORDS.some((w) => t.includes(w));
      })
      // Official channels first
      .sort((a, b) => Number(b.official) - Number(a.official));

    const final = officialOnly ? results.filter((r) => r.official) : results;

    return NextResponse.json(final.slice(0, 10));
  } catch (err) {
    console.error("[YouTube request failed]", err);
    return NextResponse.json(
      { error: "Could not reach YouTube" },
      { status: 502 }
    );
  }
}