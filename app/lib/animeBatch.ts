export type BatchAnime = {
  id: number;
  title: { romaji: string; english: string | null };
  coverImage: { large: string } | null;
  episodes: number | null;
  genres: string[];
};

const CHUNK_SIZE = 50; // must match MAX_IDS in app/api/anime/batch/route.ts

// Looks up many anime with one request per 50 ids (instead of one request each).
// Anime that could not be loaded are simply missing from the returned map.
export async function fetchAnimeByIds(
  ids: number[]
): Promise<Map<number, BatchAnime>> {
  const unique = [...new Set(ids)];
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    chunks.push(unique.slice(i, i + CHUNK_SIZE));
  }

  const settled = await Promise.allSettled(
    chunks.map(async (chunk): Promise<BatchAnime[]> => {
      const res = await fetch(`/api/anime/batch?ids=${chunk.join(",")}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed: ${res.status}`);
      return data as BatchAnime[];
    })
  );

  // If every request failed, tell the caller instead of returning an empty map
  if (settled.length > 0 && settled.every((r) => r.status === "rejected")) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }

  const found = new Map<number, BatchAnime>();
  for (const result of settled) {
    if (result.status === "fulfilled") {
      for (const anime of result.value) found.set(anime.id, anime);
    }
  }
  return found;
}
