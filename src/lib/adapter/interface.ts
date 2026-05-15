export type AdapterType = "gbrain" | "none";

export interface DocumentPayload {
  id: string;
  title: string;
  slug: string;
  body: string;           // clean CommonMark markdown
  frontmatter: Record<string, unknown>;
  tags: string[];
  updatedAt: string;
}

export interface EntityResult {
  id: string;
  name: string;
  type: string;           // e.g. 'person', 'company'
}

export interface AdapterSchema {
  frontmatterFields: {
    key: string;
    label: string;
    type: "text" | "date" | "tags" | "entity";
    entityType?: string; // e.g. 'works_at', 'invested_in'
    required: boolean;
  }[];
}

export interface BackendAdapter {
  /** Write a document to the backend (ongoing sync). */
  push(doc: DocumentPayload): Promise<void>;

  /** Read a document from the backend (import only). */
  pull(externalId: string): Promise<DocumentPayload>;

  /** List all documents in the backend (import only). */
  list(): Promise<{ id: string; title: string }[]>;

  /** Return the expected frontmatter schema for this backend. */
  schema(): Promise<AdapterSchema>;

  /** Search the backend's entity graph — used for @-mention autocomplete. */
  entities?(query: string): Promise<EntityResult[]>;
}
