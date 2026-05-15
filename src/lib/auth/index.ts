// Auth abstraction — wraps Supabase Auth.
// All callers import from here so swapping the provider only touches this file.

export { createClient as createBrowserAuth } from "@/lib/supabase/client";
export { createClient as createServerAuth, createServiceClient } from "@/lib/supabase/server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Returns the authenticated user or redirects to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}

/** Returns the authenticated user or null (no redirect). */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
