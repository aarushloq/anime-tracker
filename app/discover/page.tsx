"use client";

import { useEffect, useState } from "react";

type Anime = {
  id: number;
  title: {
    romaji: string;
  };
  coverImage: {
    large: string;
  };
};

const sorts = [
  { label: "Popular", value: "POPULARITY_DESC" },
  { label: "Trending", value: "TRENDING_DESC" },
  { label: "Highest Rated", value: "SCORE_DESC" },
  { label: "Newest", value: "START_DATE_DESC" },
];

const genres = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Romance",
  "Sci-Fi",
];

export default function DiscoverPage() {
  const [anime, setAnime] = useState<Anime[]>([]);
  const [sort, setSort] = useState("POPULARITY_DESC");
  const [genre, setGenre] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAnime(
    selectedSort: string,
    selectedGenre: string
  ) {
    setLoading(true);

    const params = new URLSearchParams();

    params.set("sort", selectedSort);

    if (selectedGenre) {
      params.set("genre", selectedGenre);
    }

    const response = await fetch(
      `/api/anime?${params.toString()}`
    );

    const data = await response.json();

    if (response.ok && !data.errors) {
      setAnime(data.data.Page.media);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAnime(sort, genre);
  }, [sort, genre]);

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-10 py-12 text-white">
      <div className="mx-auto max-w-6xl">

        {/* Navigation */}
        <nav className="mb-16 flex items-center justify-between">
          <a
            href="/"
            className="text-sm text-gray-400 hover:text-white"
          >
            ← Home
          </a>

          <h1 className="text-xl font-semibold">
            Discover
          </h1>

          <span />
        </nav>

        {/* Heading */}
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-purple-400">
            Explore
          </p>

          <h2 className="mt-3 text-4xl font-bold">
            Discover Anime
          </h2>

          <p className="mt-3 text-gray-400">
            Browse anime by popularity, rating, trends and release date.
          </p>
        </div>

        {/* Sorting */}
        <div className="mb-5">
          <p className="mb-3 text-sm text-gray-500">
            Sort by
          </p>

          <div className="flex flex-wrap gap-3">
            {sorts.map((item) => (
              <button
                key={item.value}
                onClick={() => setSort(item.value)}
                className={`rounded-full px-5 py-2 text-sm transition ${
                  sort === item.value
                    ? "bg-purple-600 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Genres */}
        <div className="mb-10">
          <p className="mb-3 text-sm text-gray-500">
            Genre
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setGenre("")}
              className={`rounded-full px-5 py-2 text-sm transition ${
                genre === ""
                  ? "bg-purple-600 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              All Genres
            </button>

            {genres.map((item) => (
              <button
                key={item}
                onClick={() => setGenre(item)}
                className={`rounded-full px-5 py-2 text-sm transition ${
                  genre === item
                    ? "bg-purple-600 text-white"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Anime Grid */}
        {loading && (
          <p className="text-gray-400">
            Loading anime...
          </p>
        )}

        {!loading && anime.length === 0 && (
          <p className="text-gray-400">
            No anime found.
          </p>
        )}

        {!loading && anime.length > 0 && (
          <div className="grid grid-cols-2 gap-6 md:grid-cols-5">
            {anime.map((item) => (
              <a
                href={`/anime/${item.id}`}
                key={item.id}
                className="group"
              >
                <img
                  src={item.coverImage.large}
                  alt={item.title.romaji}
                  className="aspect-[2/3] w-full rounded-xl object-cover transition group-hover:scale-[1.02]"
                />

                <h3 className="mt-3 font-medium">
                  {item.title.romaji}
                </h3>
              </a>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}