import { createClient, createServiceClient } from "@/lib/supabase/server";

/** Get the authenticated user from the session cookie. Returns null if not signed in. */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Get authenticated user + their membership role in a workspace.
 * Uses the service client for the membership query so RLS doesn't block it.
 */
export async function getWorkspaceMember(workspaceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, member: null };

  const service = await createServiceClient();
  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  return { user, member };
}
