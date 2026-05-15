import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/api/rate-limit";
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

/** PATCH /api/docs/:id/meta — frontmatter fields only; untouched fields are preserved */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Accept both session auth (editor UI) and API key auth (agents)
  const sessionClient = await createClient();
  const {
    data: { user: sessionUser },
  } = await sessionClient.auth.getUser();

  const service = await createServiceClient();
  let workspaceId: string;
  let editorId: string | null = null;
  let keyId: string | null = null;
  const rlHeaders: Record<string, string> = {};

  if (sessionUser) {
    const { data: docRow } = await service
      .from("documents")
      .select("id, workspace_id")
      .eq("id", id)
      .single();
    if (!docRow) return problem(404, "Not Found", `Document "${id}" not found.`);

    const { data: member } = await service
      .from("members")
      .select("role")
      .eq("workspace_id", docRow.workspace_id)
      .eq("user_id", sessionUser.id)
      .single();

    if (!member || member.role === "viewer") {
      return problem(403, "Forbidden", "Editors and admins can update document metadata.");
    }

    workspaceId = docRow.workspace_id;
    editorId = sessionUser.id;
  } else {
    const auth = await authenticateApiKey(request, "read-write");
    if ("error" in auth) return auth.error;

    const rl = checkRateLimit(auth.key.id);
    Object.assign(rlHeaders, rateLimitHeaders(rl));
    if (!rl.allowed) return problem(429, "Too Many Requests", "Rate limit exceeded.");

    workspaceId = auth.key.workspace_id;
    keyId = auth.key.id;
  }

  const { data: current } = await service
    .from("documents")
    .select("id, frontmatter, tags")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!current) return problem(404, "Not Found", `Document "${id}" not found.`);

  const body = await request.json().catch(() => null);
  if (!body) return problem(400, "Bad Request", "Request body must be valid JSON.");

  const mergedFm = {
    ...(current.frontmatter as Record<string, unknown>),
    ...(body.frontmatter ?? {}),
  };
  const tags: string[] = body.tags ?? current.tags;

  const { data: updated, error } = await service
    .from("documents")
    .update({
      frontmatter: mergedFm,
      tags,
      ...(editorId ? { last_edited_by: editorId } : {}),
      ...(keyId ? { last_edited_by_key: keyId } : {}),
    })
    .eq("id", id)
    .select("id, frontmatter, tags, updated_at")
    .single();

  if (error) return problem(500, "Server error", error.message);

  return NextResponse.json(updated, { headers: rlHeaders });
}
