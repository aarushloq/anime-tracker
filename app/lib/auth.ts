import { createClient } from "./supabase";

export async function getCurrentUser() {
  const { data } = await createClient().auth.getSession();
  return data.session?.user ?? null;
}

export async function signOut() {
  await createClient().auth.signOut();
}