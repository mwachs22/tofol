// Migration engine: translates documents from Tofol's canonical store
// to a new adapter's schema and pushes them, scoring each doc for confidence.

import type { AdapterSchema } from "@/lib/adapter/interface";
import type { Json } from "@/lib/supabase/types";

export interface MigrationDocResult {
  docId: string;
  slug: string;
  title: string;
  confidence: "auto" | "needs-review";
  reasons: string[];          // plain-English explanations for flagged fields
  pushed: boolean;
}

/**
 * Translate a document's frontmatter from its current shape to the target adapter schema.
 * Returns confidence score and per-field reasons for any issues found.
 */
export function translateFrontmatter(
  currentFm: Record<string, unknown>,
  targetSchema: AdapterSchema
): { translated: Record<string, unknown>; confidence: "auto" | "needs-review"; reasons: string[] } {
  const schemaKeys = new Set(targetSchema.frontmatterFields.map((f) => f.key));
  const reasons: string[] = [];
  const translated: Record<string, unknown> = {};

  // Copy over known schema fields directly
  for (const field of targetSchema.frontmatterFields) {
    if (field.key in currentFm) {
      translated[field.key] = currentFm[field.key];
    } else if (field.required) {
      reasons.push(`Required field "${field.key}" (${field.label}) is missing.`);
    }
  }

  // Flag unknown fields that won't map to the new schema
  for (const [key, value] of Object.entries(currentFm)) {
    if (!schemaKeys.has(key)) {
      translated[key] = value; // preserve unknown fields as plain text
      reasons.push(
        `Field "${key}" doesn't exist in the new schema — kept as a plain metadata field.`
      );
    }
  }

  return {
    translated,
    confidence: reasons.length === 0 ? "auto" : "needs-review",
    reasons,
  };
}

export interface MigrationProgress {
  type: "progress" | "doc" | "complete" | "error";
  completed?: number;
  total?: number;
  result?: MigrationDocResult;
  message?: string;
  reviewCount?: number;
}

/**
 * Run the migration as an async generator, yielding progress events.
 * Caller is responsible for pushing each event over SSE.
 */
export async function* runMigration(params: {
  workspaceId: string;
  jobId: string;
  targetAdapterType: string;
  targetSchema: AdapterSchema;
  docs: Array<{
    id: string;
    slug: string;
    title: string;
    body: string;
    frontmatter: Json;
    tags: string[];
  }>;
  pushDoc: (doc: {
    id: string;
    title: string;
    slug: string;
    body: string;
    frontmatter: Record<string, unknown>;
    tags: string[];
    updatedAt: string;
  }) => Promise<void>;
}): AsyncGenerator<MigrationProgress> {
  const { docs, targetSchema, pushDoc } = params;
  const total = docs.length;
  let completed = 0;
  const reviewQueue: Array<{ docId: string; reasons: string[] }> = [];

  yield { type: "progress", completed: 0, total };

  for (const doc of docs) {
    const currentFm = (doc.frontmatter as Record<string, unknown>) ?? {};
    const { translated, confidence, reasons } = translateFrontmatter(currentFm, targetSchema);

    const result: MigrationDocResult = {
      docId: doc.id,
      slug: doc.slug,
      title: doc.title,
      confidence,
      reasons,
      pushed: false,
    };

    if (confidence === "auto") {
      try {
        await pushDoc({
          id: doc.id,
          title: doc.title,
          slug: doc.slug,
          body: doc.body,
          frontmatter: translated,
          tags: doc.tags,
          updatedAt: new Date().toISOString(),
        });
        result.pushed = true;
      } catch (err) {
        result.confidence = "needs-review";
        result.reasons = [
          `Push to adapter failed: ${err instanceof Error ? err.message : String(err)}`,
        ];
        result.pushed = false;
      }
    }

    if (!result.pushed) {
      reviewQueue.push({ docId: doc.id, reasons: result.reasons });
    }

    completed++;
    yield { type: "doc", completed, total, result };
  }

  yield {
    type: "complete",
    completed,
    total,
    reviewCount: reviewQueue.length,
    message: `Migration complete. ${completed - reviewQueue.length} docs migrated. ${reviewQueue.length} need your review.`,
  };
}
