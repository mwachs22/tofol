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

/** GET /api/docs/:id/history */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await authenticateApiKey(request, "read");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(auth.key.id);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) return problem(429, "Too Many Requests", "Rate limit exceeded.");

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const after = searchParams.get("after");

  const supabase = await createServiceClient();

  // Verify doc belongs to this workspace
  const { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.key.workspace_id)
    .single();

  if (!doc) return problem(404, "Not Found", `Document "${id}" not found.`);

  let query = supabase
    .from("revisions")
    .select("id, author_type, author_display_name, created_at")
    .eq("document_id", id)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (after) {
    query = query.lt("created_at", after);
  }

  const { data: revisions, error } = await query;
  if (error) return problem(500, "Server error", error.message);

  const hasNext = revisions.length > limit;
  const results = hasNext ? revisions.slice(0, limit) : revisions;
  const nextCursor = hasNext ? results[results.length - 1].created_at : null;

  return NextResponse.json(
    { data: results, pagination: { limit, after: nextCursor } },
    { headers: rlHeaders }
  );
}
