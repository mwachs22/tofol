import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

interface RouteParams {
  params: Promise<{ id: string; memberId: string }>;
}

async function assertAdmin(workspaceId: string, userId: string) {
  const service = await createServiceClient();
  const { data } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();
  return data?.role === "admin";
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized", "Sign in required.");
  if (!(await assertAdmin(workspaceId, user.id)))
    return problem(403, "Forbidden", "Only admins can change roles.");

  const body = await request.json().catch(() => null);
  const role = ["admin", "editor", "viewer"].includes(body?.role) ? body.role : null;
  if (!role) return problem(400, "Bad Request", "role must be admin, editor, or viewer.");

  const service = await createServiceClient();
  await service.from("members").update({ role }).eq("id", memberId).eq("workspace_id", workspaceId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, memberId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized", "Sign in required.");
  if (!(await assertAdmin(workspaceId, user.id)))
    return problem(403, "Forbidden", "Only admins can remove members.");

  const service = await createServiceClient();
  await service.from("members").delete().eq("id", memberId).eq("workspace_id", workspaceId);

  return new NextResponse(null, { status: 204 });
}
