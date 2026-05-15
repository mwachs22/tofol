// API key authentication for agent REST API endpoints.

import { createServiceClient } from "@/lib/supabase/server";
import { compare } from "bcrypt";
import { NextRequest } from "next/server";

export type ApiPermission = "read" | "read-write" | "admin";

export interface AuthenticatedKey {
  id: string;
  workspace_id: string;
  agent_name: string;
  permissions: ApiPermission;
}

function problem(status: number, title: string, detail: string) {
  return Response.json(
    { type: "about:blank", title, status, detail },
    { status, headers: { "Content-Type": "application/problem+json" } }
  );
}

/** Extract and verify an API key from the Authorization: Bearer header. */
export async function authenticateApiKey(
  request: NextRequest,
  requiredPermission: ApiPermission = "read"
): Promise<{ key: AuthenticatedKey } | { error: Response }> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: problem(401, "Unauthorized", "Missing Authorization: Bearer header.") };
  }

  const plaintextKey = authHeader.slice(7).trim();
  if (!plaintextKey) {
    return { error: problem(401, "Unauthorized", "Empty API key.") };
  }

  const supabase = await createServiceClient();

  // Load candidate keys (we can't query by hash directly, so we load and compare)
  // In production, add an indexed prefix (first 8 chars) column to narrow the scan.
  const { data: keys } = await supabase
    .from("api_keys")
    .select("id, workspace_id, key_hash, agent_name, permissions, expires_at, revoked_at")
    .is("revoked_at", null);

  if (!keys) {
    return { error: problem(500, "Server error", "Could not verify API key.") };
  }

  let matchedKey: (typeof keys)[0] | null = null;
  for (const candidate of keys) {
    const match = await compare(plaintextKey, candidate.key_hash);
    if (match) {
      matchedKey = candidate;
      break;
    }
  }

  if (!matchedKey) {
    return { error: problem(401, "Unauthorized", "Invalid API key.") };
  }

  if (matchedKey.expires_at && new Date(matchedKey.expires_at) < new Date()) {
    return { error: problem(401, "Unauthorized", "API key has expired.") };
  }

  const permissionRank: Record<ApiPermission, number> = {
    read: 0,
    "read-write": 1,
    admin: 2,
  };

  if (permissionRank[matchedKey.permissions as ApiPermission] < permissionRank[requiredPermission]) {
    return {
      error: problem(
        403,
        "Forbidden",
        `This key has "${matchedKey.permissions}" permission but "${requiredPermission}" is required.`
      ),
    };
  }

  // Update last_used_at asynchronously
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", matchedKey.id)
    .then(() => {});

  return {
    key: {
      id: matchedKey.id,
      workspace_id: matchedKey.workspace_id,
      agent_name: matchedKey.agent_name,
      permissions: matchedKey.permissions as ApiPermission,
    },
  };
}
