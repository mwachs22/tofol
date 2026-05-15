import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { encryptAdapterConfig } from "@/lib/crypto/adapter-encryption";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
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
    return problem(403, "Forbidden", "Only admins can configure adapters.");
  }

  const body = await request.json().catch(() => null);
  if (!body) return problem(400, "Bad Request", "Request body required.");

  const adapterType: string = body.adapterType === "gbrain" ? "gbrain" : "none";
  let encryptedConfig: string | null = null;

  if (adapterType === "gbrain" && body.config) {
    encryptedConfig = await encryptAdapterConfig(body.config);
  }

  const service = await createServiceClient();
  const { error } = await service
    .from("workspaces")
    .update({
      adapter_type: adapterType === "none" ? null : adapterType,
      adapter_config: encryptedConfig,
    })
    .eq("id", workspaceId);

  if (error) return problem(500, "Server error", error.message);

  return NextResponse.json({ ok: true });
}
