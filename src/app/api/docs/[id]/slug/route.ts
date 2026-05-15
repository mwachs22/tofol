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

/** PATCH /api/docs/:id/slug — change slug, record redirect */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const service = await createServiceClient();
  const { data: doc } = await service
    .from("documents")
    .select("id, workspace_id, slug")
    .eq("id", id)
    .single();

  if (!doc) return problem(404, "Not Found", "Document not found.");

  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", doc.workspace_id)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role === "viewer") {
    return problem(403, "Forbidden", "Editors and admins can change slugs.");
  }

  const body = await request.json().catch(() => null);
  const newSlug = typeof body?.slug === "string"
    ? body.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 80)
    : null;

  if (!newSlug) return problem(400, "Bad Request", "slug is required.");
  if (newSlug === doc.slug) return NextResponse.json({ slug: doc.slug });

  // Check new slug is available in this workspace
  const { data: conflict } = await service
    .from("documents")
    .select("id")
    .eq("workspace_id", doc.workspace_id)
    .eq("slug", newSlug)
    .maybeSingle();

  if (conflict) return problem(409, "Conflict", `The slug "${newSlug}" is already in use.`);

  // Record the old slug as a redirect
  await service.from("slug_redirects").upsert({
    workspace_id: doc.workspace_id,
    old_slug: doc.slug,
    document_id: id,
  });

  const { error } = await service
    .from("documents")
    .update({ slug: newSlug, last_edited_by: user.id })
    .eq("id", id);

  if (error) return problem(500, "Server error", error.message);

  return NextResponse.json({ slug: newSlug });
}
