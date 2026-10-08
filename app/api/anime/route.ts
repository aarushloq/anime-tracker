import { NextResponse } from "next/server";

const QUERY = `
query (
  $page: Int
  $perPage: Int
  $search: String
  $sort: [MediaSort]
  $genres: [String]
  $statusNot: MediaStatus
) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    media(
      type: ANIME
      search: $search
      sort: $sort
      genre_in: $genres
      status_not: $statusNot
      isAdult: false
    ) {
      id
      title { romaji english }
      coverImage { large extraLarge }
      bannerImage
      averageScore
      popularity
      seasonYear
      format
      status
      episodes
      genres
    }
  }
}`;

function pickSort(raw: string | null, hasSearch: boolean): string {
  const s = (raw ?? "").toLowerCase().replace(/[\s_-]+/g, "");

  if (s === "trending") return "TRENDING_DESC";
  if (
    s === "score" ||
    s === "rating" ||
    s === "highestrated" ||
    s === "toprated"
  )
    return "SCORE_DESC";
  if (s === "newest" || s === "new" || s === "latest" || s === "date")
    return "START_DATE_DESC";
  if (s === "popular" || s === "popularity") return "POPULARITY_DESC";

  return hasSearch ? "SEARCH_MATCH" : "POPULARITY_DESC";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const search = (
    searchParams.get("search") ??
    searchParams.get("q") ??
    ""
  ).trim();
  const sort = pickSort(searchParams.get("sort"), search.length > 0);
  const genreParam =
    searchParams.get("genre") ?? searchParams.get("genres") ?? "";
  const genres = genreParam
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g && g.toLowerCase() !== "all");

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const perPage = Math.min(
    50,
    Math.max(1, Number(searchParams.get("perPage")) || 24)
  );

  const variables: Record<string, unknown> = {
    page,
    perPage,
    sort: [sort],
  };
  if (search) variables.search = search;
  if (genres.length > 0) variables.genres = genres;
  if (sort === "START_DATE_DESC") variables.statusNot = "NOT_YET_RELEASED";

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables }),
      cache: "no-store",
    });

    const json = await response.json();

    if (json.errors || !json.data?.Page) {
      console.error(
        "[AniList list error]",
        response.status,
        JSON.stringify(json.errors ?? json)
      );
      return NextResponse.json(
        { error: json.errors?.[0]?.message ?? "AniList request failed" },
        { status: 502 }
      );
    }

    // Return AniList's reply as-is: { data: { Page: { pageInfo, media } } }
    return NextResponse.json(json);
  } catch (err) {
    console.error("[AniList list request failed]", err);
    return NextResponse.json(
      { error: "Could not reach AniList" },
      { status: 502 }
    );
  }
}