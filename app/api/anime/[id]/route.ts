import { NextResponse } from "next/server";

const QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english }
    coverImage { large extraLarge }
    bannerImage
    description(asHtml: false)
    episodes
    status
    genres
    averageScore
    seasonYear
    format
    studios(isMain: true) { nodes { name } }
    trailer { id site }
    externalLinks { site url type }
  }
}`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId < 1) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { id: numericId } }),
      cache: "no-store",
    });

    const json = await response.json();

    if (json.errors || !json.data?.Media) {
      console.error("[AniList error]", response.status, JSON.stringify(json.errors ?? json));

      return NextResponse.json(
        { error: json.errors?.[0]?.message ?? "Anime not found" },
        { status: response.status === 404 ? 404 : 502 }
      );
    }

    return NextResponse.json(json.data.Media);
  } catch (err) {
    console.error("[AniList request failed]", err);
    return NextResponse.json({ error: "Could not reach AniList" }, { status: 502 });
  }
}