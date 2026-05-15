import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id: docId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const { data: existing } = await supabase
    .from("starred_docs")
    .select("document_id")
    .eq("user_id", user.id)
    .eq("document_id", docId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("starred_docs")
      .delete()
      .eq("user_id", user.id)
      .eq("document_id", docId);
    return NextResponse.json({ starred: false });
  }

  await supabase
    .from("starred_docs")
    .insert({ user_id: user.id, document_id: docId });

  return NextResponse.json({ starred: true });
}
