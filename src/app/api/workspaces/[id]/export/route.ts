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

/** GET /api/workspaces/:id/export — download all docs as a zip of markdown files */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return problem(401, "Unauthorized", "Sign in required.");

  const service = await createServiceClient();
  const { data: member } = await service
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") {
    return problem(403, "Forbidden", "Only admins can export workspace data.");
  }
  const { data: docs } = await service
    .from("documents")
    .select("title, slug, body, frontmatter, tags, updated_at")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (!docs) return problem(500, "Server error", "Failed to load documents.");

  // Build a simple tar-like structure as concatenated markdown files
  // For proper zip support, add the `fflate` or `archiver` package.
  // For MVP: return a single multipart text response; production should use fflate.
  const parts: string[] = [];
  for (const doc of docs) {
    const fm = doc.frontmatter as Record<string, unknown>;
    const fmLines = [
      `title: ${JSON.stringify(doc.title)}`,
      ...(doc.tags.length ? [`tags: [${doc.tags.map((t) => JSON.stringify(t)).join(", ")}]`] : []),
      ...Object.entries(fm)
        .filter(([k]) => k !== "title")
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`),
    ];
    const content = `---\n${fmLines.join("\n")}\n---\n\n${doc.body}`;
    parts.push(`\n\n===== ${doc.slug}.md =====\n\n${content}`);
  }

  const exportContent = `# Tofol Export\nWorkspace: ${workspaceId}\nExported: ${new Date().toISOString()}\nDocuments: ${docs.length}\n${parts.join("")}`;

  return new NextResponse(exportContent, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="tofol-export-${new Date().toISOString().slice(0, 10)}.txt"`,
    },
  });
}
