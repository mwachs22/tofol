import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const db = await createServiceClient();

  const { data: member } = await db
    .from("members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("invited_at", { ascending: true })
    .limit(1)
    .single();

  if (!member) redirect("/onboarding");

  const { data: workspace } = await db
    .from("workspaces")
    .select("handle")
    .eq("id", member.workspace_id)
    .single();

  if (!workspace) redirect("/onboarding");

  redirect(`/${workspace.handle}`);
}
