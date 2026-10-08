"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "./supabase";
import { signOut } from "./auth";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/my-anime", label: "My Anime" },
  { href: "/profile", label: "Profile" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Check once on load
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setReady(true);
    });

    // Update automatically whenever the user logs in or out
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      setReady(true);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  // The bar gets a little darker once you scroll
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu after moving to another page
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <>
      {/* The bar is fixed to the top edge of the screen and is 64px tall */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-white/10 text-white backdrop-blur-xl transition-[background-color,box-shadow] duration-500 ${
          scrolled
            ? "bg-[#07070a]/95 shadow-xl shadow-black/50"
            : "bg-[#07070a]/80"
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          {/* Desktop links */}
          <div className="hidden items-center gap-1 text-sm md:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 transition-colors duration-300 ${
                  isActive(link.href)
                    ? "bg-white/10 font-medium text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 text-sm md:ml-0">
            {ready &&
              (email ? (
                <button
                  onClick={handleSignOut}
                  className="rounded-full border border-white/15 px-5 py-2.5 text-gray-200 transition-colors duration-300 hover:bg-white/10"
                >
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="rounded-full bg-white px-5 py-2.5 font-medium text-black transition-colors duration-300 hover:bg-violet-200"
                >
                  Log in
                </Link>
              ))}

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              className="grid h-10 w-10 place-items-center rounded-full text-gray-300 transition hover:bg-white/10 md:hidden"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 8h16M4 16h16" />
                )}
              </svg>
            </button>
          </div>
        </nav>

        {/* Mobile dropdown (solid, attached under the bar) */}
        {menuOpen && (
          <div className="border-t border-white/10 bg-[#0e0e14] px-4 py-3 shadow-2xl shadow-black/70 md:hidden">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-2xl px-4 py-3 text-sm transition ${
                  isActive(link.href)
                    ? "bg-white/10 font-medium text-white"
                    : "text-gray-300 hover:bg-white/5"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Takes the bar's space so the page content starts below it, not under it */}
      <div aria-hidden className="h-16" />
    </>
  );
}