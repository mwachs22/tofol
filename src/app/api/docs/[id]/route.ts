import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/api/rate-limit";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function problem(status: number, title: string, detail: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail, ...extra },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/docs/:id */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authenticateApiKey(request, "read");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(auth.key.id);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) return problem(429, "Too Many Requests", "Rate limit exceeded.");

  const supabase = await createServiceClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", auth.key.workspace_id)
    .single();

  if (!doc) return problem(404, "Not Found", `Document "${id}" not found.`);

  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/markdown")) {
    return new NextResponse(doc.body, {
      headers: { ...rlHeaders, "Content-Type": "text/markdown; charset=utf-8" },
    });
  }

  return NextResponse.json(doc, { headers: rlHeaders });
}

/** PUT /api/docs/:id — full document replace (requires If-Match header) */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authenticateApiKey(request, "read-write");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(auth.key.id);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) return problem(429, "Too Many Requests", "Rate limit exceeded.");

  const ifMatch = request.headers.get("If-Match");
  if (!ifMatch) {
    return problem(
      428,
      "Precondition Required",
      "PUT requires an If-Match header with the current revision ID to prevent conflicts."
    );
  }

  const supabase = await createServiceClient();
  const { data: current } = await supabase
    .from("documents")
    .select("id, current_revision_id, body, frontmatter, tags")
    .eq("id", id)
    .eq("workspace_id", auth.key.workspace_id)
    .single();

  if (!current) return problem(404, "Not Found", `Document "${id}" not found.`);

  if (current.current_revision_id !== ifMatch) {
    return problem(
      409,
      "Conflict",
      "The document has been modified since you last read it. Re-read and retry.",
      { current_revision_id: current.current_revision_id }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) return problem(400, "Bad Request", "Request body must be valid JSON.");

  const markdown: string = body.body ?? current.body;
  const frontmatter = body.frontmatter ?? current.frontmatter;
  const tags: string[] = body.tags ?? current.tags;
  const title: string = body.title;

  // Create revision snapshot
  const { data: revision } = await supabase
    .from("revisions")
    .insert({
      document_id: id,
      body: current.body,
      frontmatter: current.frontmatter,
      author_type: "agent",
      author_key_id: auth.key.id,
      author_display_name: auth.key.agent_name,
    })
    .select("id")
    .single();

  const { data: updated, error } = await supabase
    .from("documents")
    .update({
      body: markdown,
      frontmatter,
      tags,
      ...(title ? { title } : {}),
      last_edited_by_key: auth.key.id,
      current_revision_id: revision?.id ?? null,
    })
    .eq("id", id)
    .select("id, title, slug, updated_at, current_revision_id")
    .single();

  if (error) return problem(500, "Server error", error.message);

  return NextResponse.json(updated, { headers: rlHeaders });
}

/** PATCH /api/docs/:id — partial update (accepts session auth or API key) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  // Try session auth first (editor UI); fall back to API key auth (agents)
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

    const { data: member } = await sessionClient
      .from("members")
      .select("role")
      .eq("workspace_id", docRow.workspace_id)
      .eq("user_id", sessionUser.id)
      .single();

    if (!member || member.role === "viewer") {
      return problem(403, "Forbidden", "Editors and admins can update documents.");
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
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (!current) return problem(404, "Not Found", `Document "${id}" not found.`);

  const body = await request.json().catch(() => null);
  if (!body) return problem(400, "Bad Request", "Request body must be valid JSON.");

  const { data: updated, error } = await service
    .from("documents")
    .update({
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.body === "string" ? { body: body.body } : {}),
      ...(body.tags ? { tags: body.tags as string[] } : {}),
      ...("folder_id" in body ? { folder_id: body.folder_id as string | null } : {}),
      ...(editorId ? { last_edited_by: editorId } : {}),
      ...(keyId ? { last_edited_by_key: keyId } : {}),
    })
    .eq("id", id)
    .select("id, title, slug, updated_at")
    .single();

  if (error) return problem(500, "Server error", error.message);

  return NextResponse.json(updated, { headers: rlHeaders });
}

/** DELETE /api/docs/:id */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authenticateApiKey(request, "read-write");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(auth.key.id);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) return problem(429, "Too Many Requests", "Rate limit exceeded.");

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("workspace_id", auth.key.workspace_id);

  if (error) return problem(500, "Server error", error.message);

  return new NextResponse(null, { status: 204, headers: rlHeaders });
}
