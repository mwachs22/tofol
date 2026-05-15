-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────────
-- workspaces
-- ────────────────────────────────────────────────────────────────
create table workspaces (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  handle         text not null unique,
  admin_user_id  uuid not null references auth.users(id) on delete restrict,
  adapter_type   text,                     -- 'gbrain' | null
  adapter_config text,                     -- AES-256-GCM encrypted JSON (envelope encryption)
  theme_config   jsonb not null default '{}',
  created_at     timestamptz not null default now(),

  constraint handle_format check (
    handle ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
  ),
  constraint handle_not_reserved check (
    handle not in (
      'api','app','admin','settings','login','signup','pricing',
      'docs','blog','about','help','www','status','support'
    )
  )
);

create index on workspaces(admin_user_id);

-- ────────────────────────────────────────────────────────────────
-- members (workspace ↔ user, roles)
-- ────────────────────────────────────────────────────────────────
create table members (
  id          uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('admin','editor','viewer')),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,

  unique(workspace_id, user_id)
);

create index on members(workspace_id);
create index on members(user_id);

-- ────────────────────────────────────────────────────────────────
-- folders (flat, one level for MVP)
-- ────────────────────────────────────────────────────────────────
create table folders (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  slug         text not null,
  created_by   uuid not null references auth.users(id) on delete restrict,
  created_at   timestamptz not null default now(),

  unique(workspace_id, slug)
);

create index on folders(workspace_id);

-- ────────────────────────────────────────────────────────────────
-- api_keys
-- ────────────────────────────────────────────────────────────────
create table api_keys (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  key_hash     text not null,              -- bcrypt hash of plaintext key
  agent_name   text not null,
  permissions  text not null default 'read' check (permissions in ('read','read-write','admin')),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz
);

create index on api_keys(workspace_id);

-- ────────────────────────────────────────────────────────────────
-- documents
-- ────────────────────────────────────────────────────────────────
create table documents (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  folder_id           uuid references folders(id) on delete set null,
  title               text not null default 'Untitled',
  slug                text not null,
  body                text not null default '',
  frontmatter         jsonb not null default '{}',
  tags                text[] not null default '{}',
  share_mode          text not null default 'none' check (share_mode in ('none','public_view','public_edit')),
  created_by          uuid not null references auth.users(id) on delete restrict,
  last_edited_by      uuid references auth.users(id) on delete set null,
  last_edited_by_key  uuid references api_keys(id) on delete set null,
  current_revision_id uuid,               -- FK added after revisions table
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- full-text search vector (kept in sync via trigger)
  search_vector       tsvector generated always as (
    to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,''))
  ) stored,

  unique(workspace_id, slug)
);

create index on documents(workspace_id);
create index on documents(folder_id);
create index on documents(workspace_id, updated_at desc);
create index on documents using gin(tags);
create index on documents using gin(search_vector);

-- ────────────────────────────────────────────────────────────────
-- slug redirect log (old slug → new slug)
-- ────────────────────────────────────────────────────────────────
create table slug_redirects (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  old_slug     text not null,
  document_id  uuid not null references documents(id) on delete cascade,
  created_at   timestamptz not null default now(),

  unique(workspace_id, old_slug)
);

create index on slug_redirects(workspace_id, old_slug);

-- ────────────────────────────────────────────────────────────────
-- revisions
-- ────────────────────────────────────────────────────────────────
create table revisions (
  id                  uuid primary key default uuid_generate_v4(),
  document_id         uuid not null references documents(id) on delete cascade,
  body                text not null,
  frontmatter         jsonb not null default '{}',
  author_type         text not null check (author_type in ('human','agent')),
  author_id           uuid,               -- references auth.users for human, null for agent
  author_key_id       uuid references api_keys(id) on delete set null,
  author_display_name text not null,
  created_at          timestamptz not null default now()
);

create index on revisions(document_id, created_at desc);

-- back-fill FK from documents → revisions
alter table documents
  add constraint fk_current_revision
  foreign key (current_revision_id) references revisions(id) on delete set null;

-- ────────────────────────────────────────────────────────────────
-- starred_docs
-- ────────────────────────────────────────────────────────────────
create table starred_docs (
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  starred_at  timestamptz not null default now(),

  primary key (user_id, document_id)
);

create index on starred_docs(user_id);

-- ────────────────────────────────────────────────────────────────
-- migration_jobs
-- ────────────────────────────────────────────────────────────────
create table migration_jobs (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references workspaces(id) on delete cascade,
  status              text not null default 'queued'
    check (status in ('queued','running','paused','complete','failed')),
  from_adapter        text,
  to_adapter          text not null,
  total_docs          int not null default 0,
  completed_docs      int not null default 0,
  failed_docs         int not null default 0,
  review_queue        jsonb not null default '[]',  -- [{doc_id, reasons[]}]
  is_workspace_locked boolean not null default false,
  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

create index on migration_jobs(workspace_id, status);

-- ────────────────────────────────────────────────────────────────
-- auto-update documents.updated_at
-- ────────────────────────────────────────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_updated_at
  before update on documents
  for each row execute function touch_updated_at();
