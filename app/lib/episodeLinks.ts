import { createClient } from "./supabase";

export type EpisodeLink = {
  id: string;
  animeId: number;
  episode: number;
  url: string;
  label: string | null;
  createdAt: number;
};

type Row = {
  id: string;
  anime_id: number;
  episode: number;
  url: string;
  label: string | null;
  created_at: string;
};

const COLUMNS = "id, anime_id, episode, url, label, created_at";

function toLink(row: Row): EpisodeLink {
  return {
    id: row.id,
    animeId: row.anime_id,
    episode: row.episode,
    url: row.url,
    label: row.label,
    createdAt: new Date(row.created_at).getTime(),
  };
}

// Only plain web links are allowed (blocks things like javascript: links)
export function cleanUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function hostOf(input: string): string {
  try {
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}

// Turns a YouTube link into its embeddable player address, or null if it isn't YouTube
export function getYouTubeEmbed(input: string): string | null {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^(www|m)\./, "");
    let id: string | null = null;

    if (host === "youtu.be") {
      id = url.pathname.slice(1).split("/")[0];
    } else if (host === "youtube.com" || host === "music.youtube.com") {
      const parts = url.pathname.split("/");

      if (url.pathname === "/watch") {
        id = url.searchParams.get("v");
      } else if (["embed", "shorts", "live"].includes(parts[1])) {
        id = parts[2] ?? null;
      } else if (url.pathname === "/playlist") {
        const list = url.searchParams.get("list");
        if (list && /^[\w-]+$/.test(list)) {
          return `https://www.youtube.com/embed/videoseries?list=${list}`;
        }
      }
    }

    return id && /^[\w-]{11}$/.test(id)
      ? `https://www.youtube.com/embed/${id}`
      : null;
  } catch {
    return null;
  }
}

async function currentUserId(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Please log in first");
  return id;
}

// All saved links for one anime, newest first
export async function getLinks(animeId: number): Promise<EpisodeLink[]> {
  const { data, error } = await createClient()
    .from("episode_links")
    .select(COLUMNS)
    .eq("anime_id", animeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Row[]).map(toLink);
}

export async function addLink(
  animeId: number,
  episode: number,
  url: string,
  label: string
): Promise<EpisodeLink> {
  const userId = await currentUserId();

  const clean = cleanUrl(url);
  if (!clean) throw new Error("That doesn't look like a valid link");

  const { data, error } = await createClient()
    .from("episode_links")
    .insert({
      user_id: userId,
      anime_id: animeId,
      episode,
      url: clean,
      label: label.trim().slice(0, 60) || null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toLink(data as Row);
}

export async function removeLink(id: string): Promise<void> {
  const { error } = await createClient()
    .from("episode_links")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}