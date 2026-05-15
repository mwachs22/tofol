import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/api/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

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
  const auth = await authenticateApiKey(request, "read-write");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(auth.key.id);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) return problem(429, "Too Many Requests", "Rate limit exceeded.");

  const supabase = await createServiceClient();
  const { data: current } = await supabase
    .from("documents")
    .select("id, frontmatter, tags")
    .eq("id", id)
    .eq("workspace_id", auth.key.workspace_id)
    .single();

  if (!current) return problem(404, "Not Found", `Document "${id}" not found.`);

  const body = await request.json().catch(() => null);
  if (!body) return problem(400, "Bad Request", "Request body must be valid JSON.");

  // Merge field-by-field; absent fields are preserved
  const mergedFm = {
    ...(current.frontmatter as Record<string, unknown>),
    ...(body.frontmatter ?? {}),
  };
  const tags: string[] = body.tags ?? current.tags;

  const { data: updated, error } = await supabase
    .from("documents")
    .update({ frontmatter: mergedFm, tags, last_edited_by_key: auth.key.id })
    .eq("id", id)
    .select("id, frontmatter, tags, updated_at")
    .single();

  if (error) return problem(500, "Server error", error.message);

  return NextResponse.json(updated, { headers: rlHeaders });
}
