import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { GBRAIN_SCHEMA } from "@/lib/adapter/gbrain";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
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

  const service = await createServiceClient();
  const { data: ws } = await service
    .from("workspaces")
    .select("adapter_type")
    .eq("id", workspaceId)
    .single();

  if (!ws?.adapter_type) return NextResponse.json(null);

  if (ws.adapter_type === "gbrain") {
    return NextResponse.json(GBRAIN_SCHEMA);
  }

  return NextResponse.json(null);
}
