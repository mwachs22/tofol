import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string; folderId: string }>;
}

function problem(status: number, detail: string) {
  return NextResponse.json({ detail }, { status });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, folderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized");

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member || member.role === "viewer") return problem(403, "Editors and admins only.");

  const body = await request.json().catch(() => null);
  if (!body) return problem(400, "Request body required.");

  const updates: { name?: string; slug?: string } = {};
  if (typeof body.name === "string") updates.name = body.name.trim().slice(0, 100);
  if (typeof body.slug === "string") updates.slug = body.slug.trim().slice(0, 100);

  if (Object.keys(updates).length === 0) return problem(400, "No updatable fields.");

  const service = await createServiceClient();
  const { data: folder, error } = await service
    .from("folders")
    .update(updates)
    .eq("id", folderId)
    .eq("workspace_id", workspaceId)
    .select("id, name, slug")
    .single();

  if (error) {
    if (error.code === "23505") return problem(409, "A folder with that slug already exists.");
    return problem(500, error.message);
  }

  return NextResponse.json(folder);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, folderId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized");

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member || member.role !== "admin") return problem(403, "Admins only.");

  const service = await createServiceClient();
  // Documents in this folder have folder_id set to null by FK on delete set null
  await service.from("folders").delete().eq("id", folderId).eq("workspace_id", workspaceId);

  return new NextResponse(null, { status: 204 });
}
