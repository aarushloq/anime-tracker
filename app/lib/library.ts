import { createClient } from "./supabase";

export const STATUSES = ["Watching", "Completed", "Plan to Watch", "Dropped"] as const;

export type Status = (typeof STATUSES)[number];

export type LibraryEntry = {
  id: number;
  status: Status;
  watched: number;
  updatedAt: number;
};

type Row = {
  anime_id: number;
  status: Status;
  watched: number;
  updated_at: string;
};

const COLUMNS = "anime_id, status, watched, updated_at";

function toEntry(row: Row): LibraryEntry {
  return {
    id: row.anime_id,
    status: row.status,
    watched: row.watched,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

async function currentUserId(): Promise<string> {
  const { data } = await createClient().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Please log in first");
  return id;
}

// RLS makes the database return only the logged-in user's rows
export async function getLibrary(): Promise<LibraryEntry[]> {
  const { data, error } = await createClient()
    .from("library")
    .select(COLUMNS)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as Row[]).map(toEntry);
}

export async function getEntry(id: number): Promise<LibraryEntry | null> {
  const { data, error } = await createClient()
    .from("library")
    .select(COLUMNS)
    .eq("anime_id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toEntry(data as Row) : null;
}

// Adds a new entry or changes the status of an existing one
export async function saveEntry(
  id: number,
  status: Status,
  episodes: number | null
): Promise<LibraryEntry> {
  const userId = await currentUserId();
  const existing = await getEntry(id);

  const watched =
    status === "Completed" && episodes ? episodes : (existing?.watched ?? 0);

  const { data, error } = await createClient()
    .from("library")
    .upsert(
      {
        user_id: userId,
        anime_id: id,
        status,
        watched,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,anime_id" }
    )
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toEntry(data as Row);
}

// Changes the episode count and adjusts the status automatically
export async function setProgress(
  id: number,
  watched: number,
  episodes: number | null
): Promise<LibraryEntry> {
  const existing = await getEntry(id);
  if (!existing) throw new Error("Add this anime to your library first");

  const capped = episodes ? Math.min(watched, episodes) : watched;
  const clamped = Math.max(0, capped);

  let status = existing.status;
  if (episodes && clamped >= episodes) {
    status = "Completed";
  } else if (clamped > 0 && (status === "Plan to Watch" || status === "Completed")) {
    status = "Watching";
  }

  const { data, error } = await createClient()
    .from("library")
    .update({
      watched: clamped,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("anime_id", id)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toEntry(data as Row);
}

export async function removeEntry(id: number): Promise<void> {
  const { error } = await createClient()
    .from("library")
    .delete()
    .eq("anime_id", id);

  if (error) throw new Error(error.message);
}