import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/auth";
import { checkRateLimit, rateLimitHeaders } from "@/lib/api/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";

function problem(status: number, title: string, detail: string, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail, ...extra },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";
}

async function uniqueSlug(workspaceId: string, base: string): Promise<string> {
  const supabase = await createServiceClient();
  let slug = base;
  let suffix = 2;

  while (true) {
    const { data } = await supabase
      .from("documents")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;
    slug = `${base}-${suffix++}`;
  }
}

/** GET /api/docs?workspace=<id>&search=<q>&page=<n>&limit=<n>&after=<cursor> */
export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request, "read");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(auth.key.id);
  const rlHeaders = rateLimitHeaders(rl);

  if (!rl.allowed) {
    return problem(429, "Too Many Requests", "Rate limit exceeded.", { ...rlHeaders });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const after = searchParams.get("after");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  const supabase = await createServiceClient();
  let query = supabase
    .from("documents")
    .select("id, title, slug, tags, updated_at, created_at")
    .eq("workspace_id", auth.key.workspace_id)
    .order("updated_at", { ascending: false })
    .limit(limit + 1); // fetch one extra to detect next page

  if (search) {
    query = query.textSearch("search_vector", search, { type: "websearch" });
  }

  if (after) {
    query = query.lt("updated_at", after);
  }

  const { data: docs, error } = await query;
  if (error) return problem(500, "Server error", error.message);

  const hasNext = docs.length > limit;
  const results = hasNext ? docs.slice(0, limit) : docs;
  const nextCursor = hasNext ? results[results.length - 1].updated_at : null;

  return NextResponse.json(
    {
      data: results,
      pagination: { limit, after: nextCursor },
    },
    { headers: rlHeaders }
  );
}

/** POST /api/docs — create a new document */
export async function POST(request: NextRequest) {
  const auth = await authenticateApiKey(request, "read-write");
  if ("error" in auth) return auth.error;

  const rl = checkRateLimit(auth.key.id);
  const rlHeaders = rateLimitHeaders(rl);
  if (!rl.allowed) return problem(429, "Too Many Requests", "Rate limit exceeded.");

  const body = await request.json().catch(() => null);
  if (!body) return problem(400, "Bad Request", "Request body must be valid JSON.");

  const title: string = body.title ?? "Untitled";
  const markdown: string = body.body ?? "";
  const frontmatter = (body.frontmatter ?? {}) as import("@/lib/supabase/types").Json;
  const tags: string[] = body.tags ?? [];
  const sharePublic: boolean = body.share === "public";

  const baseSlug = slugify(title);
  const supabase = await createServiceClient();
  const slug = await uniqueSlug(auth.key.workspace_id, baseSlug);

  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: auth.key.workspace_id,
      title,
      slug,
      body: markdown,
      frontmatter,
      tags,
      share_mode: sharePublic ? "public_view" : "none",
      created_by: auth.key.id, // agent key acts as author reference
      last_edited_by_key: auth.key.id,
    })
    .select("id, title, slug, share_mode, created_at")
    .single();

  if (error) return problem(500, "Server error", error.message);

  const publicUrl = sharePublic
    ? `${request.headers.get("origin") ?? "https://tofol.io"}/${auth.key.workspace_id}/${slug}`
    : undefined;

  return NextResponse.json(
    { ...doc, ...(publicUrl ? { public_url: publicUrl } : {}) } as Record<string, unknown>,
    { status: 201, headers: rlHeaders }
  );
}
