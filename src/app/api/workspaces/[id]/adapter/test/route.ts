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

export async function POST(request: NextRequest, { params }: RouteParams) {
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
    return problem(403, "Forbidden", "Only admins can test adapter connections.");
  }

  const body = await request.json().catch(() => null);
  if (!body?.adapterType) return problem(400, "Bad Request", "adapterType required.");

  if (body.adapterType === "gbrain") {
    const { repoPath } = body.config ?? {};
    if (!repoPath) {
      return NextResponse.json({ ok: false, message: "repoPath is required for GBrain." });
    }

    try {
      const fs = await import("fs/promises");
      await fs.access(repoPath);
      return NextResponse.json({
        ok: true,
        message: `Connected. Found repo at ${repoPath}.`,
      });
    } catch {
      return NextResponse.json({
        ok: false,
        message: `Cannot access ${repoPath} — check that the path exists and is readable.`,
      });
    }
  }

  return NextResponse.json({ ok: true, message: "No adapter selected." });
}
