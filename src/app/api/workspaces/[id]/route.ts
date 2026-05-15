import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const RESERVED = new Set([
  "api","app","admin","settings","login","signup","pricing",
  "docs","blog","about","help","www","status","support",
]);

function problem(status: number, detail: string) {
  return NextResponse.json({ detail }, { status });
}

async function getAdminMember(workspaceId: string) {
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const { user, member } = await getAdminMember(workspaceId);
  if (!user) return problem(401, "Unauthorized");
  if (!member || member.role !== "admin") return problem(403, "Admins only.");

  const body = await request.json().catch(() => null);
  if (!body) return problem(400, "Request body required.");

  const updates: { name?: string; handle?: string; theme_config?: Json } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return problem(400, "name cannot be empty.");
    updates.name = name;
  }

  if (typeof body.handle === "string") {
    const h = body.handle.trim().toLowerCase();
    if (!HANDLE_RE.test(h)) return problem(400, "Invalid handle format.");
    if (RESERVED.has(h)) return problem(400, `"${h}" is a reserved handle.`);
    updates.handle = h;
  }

  if (body.themeConfig !== undefined) {
    updates.theme_config = body.themeConfig as Json;
  }

  if (Object.keys(updates).length === 0) return problem(400, "No updatable fields.");

  const service = await createServiceClient();
  const { data: ws, error } = await service
    .from("workspaces")
    .update(updates)
    .eq("id", workspaceId)
    .select("id, name, handle, theme_config")
    .single();

  if (error) {
    if (error.code === "23505") return problem(409, "That handle is already taken.");
    return problem(500, error.message);
  }

  return NextResponse.json(ws);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const { user, member } = await getAdminMember(workspaceId);
  if (!user) return problem(401, "Unauthorized");
  if (!member || member.role !== "admin") return problem(403, "Admins only.");

  const service = await createServiceClient();
  // Cascade deletes handle documents, members, folders, etc. via FK constraints
  const { error } = await service.from("workspaces").delete().eq("id", workspaceId);
  if (error) return problem(500, error.message);

  return new NextResponse(null, { status: 204 });
}
