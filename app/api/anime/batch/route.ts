import { NextResponse } from "next/server";

// AniList allows at most 50 results per page
const MAX_IDS = 50;

// One request that returns many anime at once (instead of one request per anime)
const QUERY = `
query ($ids: [Int], $perPage: Int) {
  Page(page: 1, perPage: $perPage) {
    media(id_in: $ids, type: ANIME) {
      id
      title { romaji english }
      coverImage { large }
      episodes
      genres
    }
  }
}`;

// Usage: GET /api/anime/batch?ids=1,20,21
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const ids = [
    ...new Set(
      (searchParams.get("ids") ?? "")
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];

  if (ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json(
      { error: `Send between 1 and ${MAX_IDS} valid ids` },
      { status: 400 }
    );
  }

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: { ids, perPage: ids.length },
      }),
      cache: "no-store",
    });

    const json = await response.json();

    if (json.errors || !json.data?.Page) {
      console.error(
        "[AniList batch error]",
        response.status,
        JSON.stringify(json.errors ?? json)
      );
      return NextResponse.json(
        { error: json.errors?.[0]?.message ?? "AniList request failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(json.data.Page.media);
  } catch (err) {
    console.error("[AniList batch request failed]", err);
    return NextResponse.json(
      { error: "Could not reach AniList" },
      { status: 502 }
    );
  }
}
