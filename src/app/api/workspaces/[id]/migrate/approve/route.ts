import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { GBrainAdapter, type GBrainConfig } from "@/lib/adapter/gbrain";
import { decryptAdapterConfig } from "@/lib/crypto/adapter-encryption";

function problem(status: number, detail: string) {
  return NextResponse.json({ detail }, { status });
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

  if (!user) return problem(401, "Unauthorized");

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") return problem(403, "Admins only.");

  const body = await request.json().catch(() => null);
  if (!body?.docId) return problem(400, "docId required.");

  const service = await createServiceClient();

  const { data: ws } = await service
    .from("workspaces")
    .select("adapter_type, adapter_config")
    .eq("id", workspaceId)
    .single();

  if (!ws?.adapter_config) return problem(400, "No adapter configured.");

  const { data: doc } = await service
    .from("documents")
    .select("id, title, slug, body, frontmatter, tags")
    .eq("id", body.docId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!doc) return problem(404, "Document not found.");

  try {
    const config = await decryptAdapterConfig(ws.adapter_config);
    const adapter = new GBrainAdapter(config as unknown as GBrainConfig);
    await adapter.push({
      id: doc.id,
      title: doc.title,
      slug: doc.slug,
      body: doc.body,
      frontmatter: doc.frontmatter as Record<string, unknown>,
      tags: doc.tags,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    return problem(500, `Push failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Remove from review_queue in the latest job
  const { data: job } = await service
    .from("migration_jobs")
    .select("id, review_queue")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (job) {
    const queue = (job.review_queue as Array<{ docId: string }>) ?? [];
    await service
      .from("migration_jobs")
      .update({ review_queue: queue.filter((q) => q.docId !== body.docId) })
      .eq("id", job.id);
  }

  return NextResponse.json({ ok: true });
}
