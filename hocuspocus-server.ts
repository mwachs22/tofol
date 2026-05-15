// Standalone Hocuspocus WebSocket server.
// Run with: npx ts-node --esm hocuspocus-server.ts
// Or: node dist/hocuspocus-server.js

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from "@hocuspocus/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./src/lib/supabase/types.js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

const server = new Server({
  port: parseInt(process.env.HOCUSPOCUS_PORT ?? "1234"),

  async onAuthenticate(data: any) {
    const { token, documentName } = data;
    if (!token) throw new Error("Unauthenticated");

    const { data: doc } = await supabase
      .from("documents")
      .select("id, workspace_id, share_mode")
      .eq("id", documentName)
      .single();

    if (!doc) throw new Error("Document not found");

    return { documentId: doc.id, workspaceId: doc.workspace_id };
  },

  async onLoadDocument(data: any) {
    const { documentName, document } = data;

    const { data: doc } = await supabase
      .from("documents")
      .select("body")
      .eq("id", documentName)
      .single();

    if (doc?.body) {
      const yText = document.getText("content");
      if (yText.length === 0) {
        yText.insert(0, doc.body);
      }
    }

    return document;
  },

  async onStoreDocument(data: any) {
    const { documentName, document } = data;
    const yText = document.getText("content");
    const body = yText.toString();

    await supabase
      .from("documents")
      .update({ body })
      .eq("id", documentName);
  },
});

server.listen().then(() => {
  console.log(
    `Hocuspocus server running on port ${(server as any).configuration?.port ?? 1234}`
  );
});
