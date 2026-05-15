import { NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runMigration } from "@/lib/migration/engine";
import { GBRAIN_SCHEMA } from "@/lib/adapter/gbrain";
import { decryptAdapterConfig } from "@/lib/crypto/adapter-encryption";
import { GBrainAdapter, type GBrainConfig } from "@/lib/adapter/gbrain";
import type { AdapterSchema } from "@/lib/adapter/interface";

function err(status: number, detail: string) {
  return new Response(JSON.stringify({ detail }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** POST /api/workspaces/:id/migrate — start a migration, stream progress via SSE */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return err(401, "Unauthorized");

  const service = await createServiceClient();
  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") return err(403, "Only admins can run migrations.");

  const { data: ws } = await service
    .from("workspaces")
    .select("id, adapter_type, adapter_config")
    .eq("id", workspaceId)
    .single();

  if (!ws) return err(404, "Workspace not found.");
  if (!ws.adapter_type) return err(400, "No adapter configured. Set up a backend adapter first.");
  if (ws.adapter_type !== "gbrain") return err(400, `Adapter "${ws.adapter_type}" is not yet supported for migration.`);

  // Build adapter instance
  let adapter: GBrainAdapter;
  try {
    const rawConfig = await decryptAdapterConfig(ws.adapter_config!);
    adapter = new GBrainAdapter(rawConfig as unknown as GBrainConfig);
  } catch {
    return err(500, "Could not decrypt adapter config. Check ADAPTER_ENCRYPTION_KEY.");
  }

  const targetSchema: AdapterSchema = GBRAIN_SCHEMA;

  // Load all docs
  const { data: docs } = await service
    .from("documents")
    .select("id, slug, title, body, frontmatter, tags")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (!docs) return err(500, "Failed to load documents.");

  // Create migration job record
  const { data: job } = await service
    .from("migration_jobs")
    .insert({
      workspace_id: workspaceId,
      to_adapter: ws.adapter_type,
      total_docs: docs.length,
      status: "running",
      is_workspace_locked: true,
    })
    .select("id")
    .single();

  if (!job) return err(500, "Failed to create migration job.");

  // Lock workspace
  await service
    .from("migration_jobs")
    .update({ is_workspace_locked: true })
    .eq("id", job.id);

  // Stream SSE response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const reviewQueue: Array<{ docId: string; reasons: string[] }> = [];
        let completedCount = 0;
        let failedCount = 0;

        for await (const event of runMigration({
          workspaceId,
          jobId: job.id,
          targetAdapterType: ws.adapter_type!,
          targetSchema,
          docs,
          pushDoc: async (doc) => adapter.push(doc),
        })) {
          send(event);

          if (event.type === "doc" && event.result) {
            completedCount++;
            if (!event.result.pushed) {
              failedCount++;
              reviewQueue.push({ docId: event.result.docId, reasons: event.result.reasons });
            }

            // Update job progress
            await service
              .from("migration_jobs")
              .update({
                completed_docs: completedCount,
                failed_docs: failedCount,
                review_queue: reviewQueue,
              })
              .eq("id", job.id);
          }

          if (event.type === "complete") {
            // Unlock workspace and finalize job
            await service
              .from("migration_jobs")
              .update({
                status: "complete",
                is_workspace_locked: false,
                completed_at: new Date().toISOString(),
                completed_docs: completedCount,
                failed_docs: failedCount,
                review_queue: reviewQueue,
              })
              .eq("id", job.id);
          }
        }
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
        await service
          .from("migration_jobs")
          .update({ status: "failed", is_workspace_locked: false })
          .eq("id", job.id);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/** GET /api/workspaces/:id/migrate — get current job status */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response(null, { status: 401 });

  const service = await createServiceClient();
  const { data: job } = await service
    .from("migration_jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return Response.json(job ?? null);
}
