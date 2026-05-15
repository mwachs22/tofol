import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "untitled"
  );
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return problem(401, "Unauthorized", "Sign in to create documents.");

  // Verify membership (editor or admin)
  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role === "viewer") {
    return problem(403, "Forbidden", "You need editor or admin access to create documents.");
  }

  const body = await request.json().catch(() => ({}));
  const title: string = body.title ?? "Untitled";
  const slug = await uniqueSlug(workspaceId, slugify(title));

  const service = await createServiceClient();
  const { data: doc, error } = await service
    .from("documents")
    .insert({
      workspace_id: workspaceId,
      title,
      slug,
      body: "",
      created_by: user.id,
      last_edited_by: user.id,
    })
    .select("id, slug")
    .single();

  if (error) return problem(500, "Server error", error.message);

  // Return workspace handle so client can redirect
  const { data: ws } = await supabase
    .from("workspaces")
    .select("handle")
    .eq("id", workspaceId)
    .single();

  return NextResponse.json(
    { id: doc.id, slug: doc.slug, handle: ws?.handle },
    { status: 201 }
  );
}
