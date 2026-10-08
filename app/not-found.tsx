import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center bg-[#0b0b0f] px-10 text-center text-white">
      <p className="text-sm uppercase tracking-[0.3em] text-purple-400">Error 404</p>
      <h1 className="mt-4 text-5xl font-bold">Page not found</h1>
      <p className="mt-4 max-w-md text-gray-400">
        This page doesn't exist, or the anime you're looking for moved.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-purple-600 px-6 py-3 font-medium hover:bg-purple-500"
      >
        Back to home
      </Link>
    </main>
  );
}