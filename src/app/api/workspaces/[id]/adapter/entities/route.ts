import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { GBrainAdapter, type GBrainConfig } from "@/lib/adapter/gbrain";
import { decryptAdapterConfig } from "@/lib/crypto/adapter-encryption";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: workspaceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!member) return NextResponse.json({ detail: "Not a member." }, { status: 403 });

  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json([]);

  const service = await createServiceClient();
  const { data: ws } = await service
    .from("workspaces")
    .select("adapter_type, adapter_config")
    .eq("id", workspaceId)
    .single();

  if (!ws?.adapter_config || ws.adapter_type !== "gbrain") return NextResponse.json([]);

  try {
    const config = await decryptAdapterConfig(ws.adapter_config);
    const adapter = new GBrainAdapter(config as unknown as GBrainConfig);
    const results = await adapter.entities(q);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
