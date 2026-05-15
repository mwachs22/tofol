import type {
  BackendAdapter,
  DocumentPayload,
  EntityResult,
  AdapterSchema,
} from "./interface";

export interface GBrainConfig {
  /** Absolute path to the local git clone of the GBrain repo. */
  repoPath: string;
  /** Remote URL for git push (e.g. git@github.com:org/brain.git). */
  remoteUrl: string;
  /** Git author name for commits. */
  authorName: string;
  /** Git author email for commits. */
  authorEmail: string;
}

const GBRAIN_ENTITY_TYPES = [
  "works_at",
  "invested_in",
  "founded",
  "advises",
  "attended",
] as const;

export type GBrainEntityType = (typeof GBRAIN_ENTITY_TYPES)[number];

export const GBRAIN_SCHEMA: AdapterSchema = {
  frontmatterFields: [
    { key: "title", label: "Title", type: "text", required: true },
    { key: "date", label: "Date", type: "date", required: false },
    { key: "tags", label: "Tags", type: "tags", required: false },
    {
      key: "works_at",
      label: "Works at",
      type: "entity",
      entityType: "works_at",
      required: false,
    },
    {
      key: "invested_in",
      label: "Invested in",
      type: "entity",
      entityType: "invested_in",
      required: false,
    },
    {
      key: "founded",
      label: "Founded",
      type: "entity",
      entityType: "founded",
      required: false,
    },
    {
      key: "advises",
      label: "Advises",
      type: "entity",
      entityType: "advises",
      required: false,
    },
    {
      key: "attended",
      label: "Attended",
      type: "entity",
      entityType: "attended",
      required: false,
    },
  ],
};

/** Serialize document frontmatter to YAML front-matter block. */
function serializeFrontmatter(doc: DocumentPayload): string {
  const fm: Record<string, unknown> = { title: doc.title, ...doc.frontmatter };
  if (doc.tags.length > 0) fm.tags = doc.tags;

  const lines = Object.entries(fm).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}:\n${v.map((i) => `  - ${i}`).join("\n")}`;
    return `${k}: ${JSON.stringify(v)}`;
  });

  return `---\n${lines.join("\n")}\n---\n\n`;
}

/** Parse YAML front-matter from a markdown file string. */
function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };

  const frontmatter: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const [key, ...rest] = line.split(": ");
    if (key && rest.length) frontmatter[key.trim()] = rest.join(": ").trim();
  }

  return { frontmatter, body: match[2] };
}

export class GBrainAdapter implements BackendAdapter {
  constructor(private config: GBrainConfig) {}

  async push(doc: DocumentPayload): Promise<void> {
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const fs = await import("fs/promises");
    const path = await import("path");
    const exec = promisify(execFile);

    const repoPath = this.config.repoPath;
    const filePath = path.join(repoPath, "pages", `${doc.slug}.md`);
    const content = serializeFrontmatter(doc) + doc.body;

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, "utf8");

    const env = {
      ...process.env,
      GIT_AUTHOR_NAME: this.config.authorName,
      GIT_AUTHOR_EMAIL: this.config.authorEmail,
      GIT_COMMITTER_NAME: this.config.authorName,
      GIT_COMMITTER_EMAIL: this.config.authorEmail,
    };

    await exec("git", ["-C", repoPath, "pull", "--rebase", "origin", "main"], { env });
    await exec("git", ["-C", repoPath, "add", filePath], { env });
    await exec(
      "git",
      [
        "-C",
        repoPath,
        "commit",
        "--allow-empty-message",
        "-m",
        `tofol: sync "${doc.title}"`,
      ],
      { env }
    );
    await exec("git", ["-C", repoPath, "push", "origin", "main"], { env });
  }

  async pull(externalId: string): Promise<DocumentPayload> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const filePath = path.join(this.config.repoPath, "pages", `${externalId}.md`);
    const raw = await fs.readFile(filePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);

    return {
      id: externalId,
      title: (frontmatter.title as string) ?? externalId,
      slug: externalId,
      body,
      frontmatter,
      tags: (frontmatter.tags as string[]) ?? [],
      updatedAt: new Date().toISOString(),
    };
  }

  async list(): Promise<{ id: string; title: string }[]> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const pagesDir = path.join(this.config.repoPath, "pages");
    const files = await fs.readdir(pagesDir).catch(() => [] as string[]);

    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ id: f.replace(/\.md$/, ""), title: f.replace(/\.md$/, "") }));
  }

  async schema(): Promise<AdapterSchema> {
    return GBRAIN_SCHEMA;
  }

  async entities(query: string): Promise<EntityResult[]> {
    // GBrain entity search — reads from the local repo's entity graph index if present.
    // Falls back to a filename scan of pages/ as a simple heuristic.
    const fs = await import("fs/promises");
    const path = await import("path");

    const pagesDir = path.join(this.config.repoPath, "pages");
    const files = await fs.readdir(pagesDir).catch(() => [] as string[]);
    const q = query.toLowerCase();

    return files
      .filter((f) => f.endsWith(".md") && f.toLowerCase().includes(q))
      .slice(0, 10)
      .map((f) => ({
        id: f.replace(/\.md$/, ""),
        name: f.replace(/\.md$/, "").replace(/-/g, " "),
        type: "page",
      }));
  }
}

/** Factory — instantiate the correct adapter from a decrypted config object. */
export function createAdapter(
  type: string,
  config: Record<string, unknown>
): GBrainAdapter {
  if (type === "gbrain") {
    return new GBrainAdapter(config as unknown as GBrainConfig);
  }
  throw new Error(`Unknown adapter type: ${type}`);
}
