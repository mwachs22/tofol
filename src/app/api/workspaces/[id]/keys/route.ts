import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { hash } from "bcrypt";
import { randomBytes } from "crypto";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

function generateApiKey(): string {
  // tofol_<32 random hex chars>
  return `tofol_${randomBytes(16).toString("hex")}`;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    return problem(403, "Forbidden", "Only admins can create API keys.");
  }

  const body = await request.json().catch(() => null);
  if (!body?.agentName || typeof body.agentName !== "string") {
    return problem(400, "Bad Request", "agentName is required.");
  }

  const validPerms = ["read", "read-write", "admin"];
  const permissions = validPerms.includes(body.permissions)
    ? (body.permissions as "read" | "read-write" | "admin")
    : "read";

  const plaintext = generateApiKey();
  const keyHash = await hash(plaintext, 12);

  const service = await createServiceClient();
  const { data: record, error } = await service
    .from("api_keys")
    .insert({
      workspace_id: workspaceId,
      key_hash: keyHash,
      agent_name: body.agentName,
      permissions,
      expires_at: body.expiresAt ?? null,
    })
    .select("id, agent_name, permissions, created_at, last_used_at, expires_at, revoked_at")
    .single();

  if (error) return problem(500, "Server error", error.message);

  // Return plaintext once — never stored or retrievable again
  return NextResponse.json({ key: plaintext, record }, { status: 201 });
}
