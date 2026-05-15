import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function problem(status: number, detail: string) {
  return NextResponse.json({ detail }, { status });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized");

  const service = await createServiceClient();
  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) return problem(403, "Not a member.");

  const { data: folders } = await service
    .from("folders")
    .select("id, name, slug, created_at")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  return NextResponse.json(folders ?? []);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized");

  const service = await createServiceClient();
  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member || member.role === "viewer") return problem(403, "Editors and admins only.");

  const body = await request.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") return problem(400, "name required.");

  const name = body.name.trim().slice(0, 100);
  const slug =
    body.slug?.toString().trim() ||
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const { data: folder, error } = await service
    .from("folders")
    .insert({ workspace_id: workspaceId, name, slug, created_by: user.id })
    .select("id, name, slug")
    .single();

  if (error) {
    if (error.code === "23505") return problem(409, "A folder with that slug already exists.");
    return problem(500, error.message);
  }

  return NextResponse.json(folder, { status: 201 });
}
