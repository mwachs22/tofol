import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const service = await createServiceClient();
  const { data: doc } = await service
    .from("documents")
    .select("id, workspace_id")
    .eq("id", id)
    .single();

  if (!doc) return problem(404, "Not Found", "Document not found.");

  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", doc.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role === "viewer") {
    return problem(403, "Forbidden", "Editors and admins can change share settings.");
  }

  const body = await request.json().catch(() => null);
  const valid = ["none", "public_view", "public_edit"];
  if (!body?.shareMode || !valid.includes(body.shareMode)) {
    return problem(400, "Bad Request", "shareMode must be none, public_view, or public_edit.");
  }

  await service
    .from("documents")
    .update({ share_mode: body.shareMode })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
