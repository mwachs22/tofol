import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .order("invited_at", { ascending: true })
    .limit(1)
    .single();

  if (!member) {
    redirect("/onboarding");
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("handle")
    .eq("id", member.workspace_id)
    .single();

  if (!workspace) redirect("/onboarding");

  redirect(`/${workspace.handle}`);
}
