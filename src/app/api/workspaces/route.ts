import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const RESERVED_HANDLES = new Set([
  "api","app","admin","settings","login","signup","pricing",
  "docs","blog","about","help","www","status","support",
]);

const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    {
      status,
      headers: { "Content-Type": "application/problem+json" },
    }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return problem(401, "Unauthorized", "You must be signed in to create a workspace.");
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || typeof body.handle !== "string") {
    return problem(400, "Bad Request", "name and handle are required strings.");
  }

  const { name, handle } = body as { name: string; handle: string };

  if (!HANDLE_RE.test(handle)) {
    return problem(
      400,
      "Invalid handle",
      "Handles must be 3–32 lowercase alphanumeric characters or hyphens."
    );
  }

  if (RESERVED_HANDLES.has(handle)) {
    return problem(400, "Reserved handle", `"${handle}" is a reserved name.`);
  }

  // Use service client to bypass RLS for the insert
  const service = await createServiceClient();

  const { data: workspace, error: workspaceError } = await service
    .from("workspaces")
    .insert({ name, handle, admin_user_id: user.id })
    .select("id, handle")
    .single();

  if (workspaceError) {
    if (workspaceError.code === "23505") {
      return problem(409, "Handle taken", `The handle "${handle}" is already in use.`);
    }
    return problem(500, "Server error", "Failed to create workspace.");
  }

  // Add creator as admin member
  await service.from("members").insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: "admin",
    accepted_at: new Date().toISOString(),
  });

  return NextResponse.json({ id: workspace.id, handle: workspace.handle }, { status: 201 });
}
