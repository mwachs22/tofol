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

/** POST /api/workspaces/:id/members — invite by email */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const service = await createServiceClient();
  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") {
    return problem(403, "Forbidden", "Only admins can invite members.");
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || typeof body.email !== "string") {
    return problem(400, "Bad Request", "email is required.");
  }

  const role = ["admin", "editor", "viewer"].includes(body.role) ? body.role : "editor";

  // Look up the invitee by email via Supabase Auth admin API
  const {
    data: { users },
  } = await service.auth.admin.listUsers();

  const invitee = users.find((u) => u.email === body.email);

  if (!invitee) {
    // Could send an email invite here — for now return a clear message
    return problem(
      404,
      "User not found",
      `No Tofol account found for ${body.email}. They need to sign up first.`
    );
  }

  const { error } = await service.from("members").insert({
    workspace_id: workspaceId,
    user_id: invitee.id,
    role,
  });

  if (error) {
    if (error.code === "23505") {
      return problem(409, "Already a member", `${body.email} is already in this workspace.`);
    }
    return problem(500, "Server error", error.message);
  }

  return NextResponse.json({ message: `${body.email} added as ${role}.` }, { status: 201 });
}
