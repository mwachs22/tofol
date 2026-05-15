// Hand-written type stub matching the migration schema.
// Run `supabase gen types typescript` to regenerate from a live project.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type EmptyRecord = Record<string, never>;

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string;
          name: string;
          handle: string;
          admin_user_id: string;
          adapter_type: string | null;
          adapter_config: string | null;
          theme_config: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          handle: string;
          admin_user_id: string;
          adapter_type?: string | null;
          adapter_config?: string | null;
          theme_config?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: "admin" | "editor" | "viewer";
          invited_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: "admin" | "editor" | "viewer";
          invited_at?: string;
          accepted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["members"]["Insert"]>;
        Relationships: [];
      };
      folders: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          slug: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          slug: string;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["folders"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          workspace_id: string;
          folder_id: string | null;
          title: string;
          slug: string;
          body: string;
          frontmatter: Json;
          tags: string[];
          share_mode: "none" | "public_view" | "public_edit";
          created_by: string;
          last_edited_by: string | null;
          last_edited_by_key: string | null;
          current_revision_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          folder_id?: string | null;
          title?: string;
          slug: string;
          body?: string;
          frontmatter?: Json;
          tags?: string[];
          share_mode?: "none" | "public_view" | "public_edit";
          created_by: string;
          last_edited_by?: string | null;
          last_edited_by_key?: string | null;
          current_revision_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      slug_redirects: {
        Row: {
          id: string;
          workspace_id: string;
          old_slug: string;
          document_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          old_slug: string;
          document_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["slug_redirects"]["Insert"]>;
        Relationships: [];
      };
      revisions: {
        Row: {
          id: string;
          document_id: string;
          body: string;
          frontmatter: Json;
          author_type: "human" | "agent";
          author_id: string | null;
          author_key_id: string | null;
          author_display_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          body: string;
          frontmatter?: Json;
          author_type: "human" | "agent";
          author_id?: string | null;
          author_key_id?: string | null;
          author_display_name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["revisions"]["Insert"]>;
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          workspace_id: string;
          key_hash: string;
          agent_name: string;
          permissions: "read" | "read-write" | "admin";
          created_at: string;
          last_used_at: string | null;
          expires_at: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          key_hash: string;
          agent_name: string;
          permissions?: "read" | "read-write" | "admin";
          created_at?: string;
          last_used_at?: string | null;
          expires_at?: string | null;
          revoked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["api_keys"]["Insert"]>;
        Relationships: [];
      };
      starred_docs: {
        Row: {
          user_id: string;
          document_id: string;
          starred_at: string;
        };
        Insert: {
          user_id: string;
          document_id: string;
          starred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["starred_docs"]["Insert"]>;
        Relationships: [];
      };
      migration_jobs: {
        Row: {
          id: string;
          workspace_id: string;
          status: "queued" | "running" | "paused" | "complete" | "failed";
          from_adapter: string | null;
          to_adapter: string;
          total_docs: number;
          completed_docs: number;
          failed_docs: number;
          review_queue: Json;
          is_workspace_locked: boolean;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          status?: "queued" | "running" | "paused" | "complete" | "failed";
          from_adapter?: string | null;
          to_adapter: string;
          total_docs?: number;
          completed_docs?: number;
          failed_docs?: number;
          review_queue?: Json;
          is_workspace_locked?: boolean;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["migration_jobs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: EmptyRecord;
    Functions: EmptyRecord;
    Enums: EmptyRecord;
    CompositeTypes: EmptyRecord;
  };
};
