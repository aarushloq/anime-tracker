"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        router.push("/my-anime");
      } else {
        setMessage("Check your email to confirm your account, then log in.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/my-anime");
      }
    }

    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-10 py-12 text-white">
      <a href="/" className="text-sm text-gray-400 hover:text-white">
        ← Home
      </a>

      <div className="mx-auto mt-16 max-w-sm">
        <p className="text-sm uppercase tracking-[0.3em] text-purple-400">
          Anime Tracker
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl bg-white/10 px-5 py-4 outline-none placeholder:text-gray-500"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl bg-white/10 px-5 py-4 outline-none placeholder:text-gray-500"
          />

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-purple-600 px-5 py-4 font-medium hover:bg-purple-500 disabled:opacity-50"
          >
            {busy ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {message && <p className="mt-4 text-sm text-green-400">{message}</p>}

        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setMessage(null);
          }}
          className="mt-6 text-sm text-gray-400 hover:text-white"
        >
          {mode === "login"
            ? "No account? Sign up"
            : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}