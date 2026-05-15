import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

interface RouteParams {
  params: Promise<{ id: string; keyId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId, keyId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") {
    return problem(403, "Forbidden", "Only admins can revoke API keys.");
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("workspace_id", workspaceId);

  if (error) return problem(500, "Server error", error.message);

  return new NextResponse(null, { status: 204 });
}
