-- Fashion Marketing HQ — Supabase Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
-- Content Library (Agent 1 outputs)
-- ─────────────────────────────────────────
create table if not exists content_items (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('caption', 'description', 'email', 'image', 'video', 'canva_template')),
  title text not null,
  body text,
  image_url text,
  video_url text,
  canva_url text,
  metadata jsonb default '{}',
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Trend Reports (Agent 2 outputs)
-- ─────────────────────────────────────────
create table if not exists trend_reports (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  summary text,
  colors text[] default '{}',
  styles text[] default '{}',
  silhouettes text[] default '{}',
  raw_data jsonb default '{}',
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Campaigns (Agent 3 outputs)
-- ─────────────────────────────────────────
create table if not exists campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  start_date date not null,
  end_date date not null,
  status text default 'draft' check (status in ('draft', 'active', 'completed', 'paused')),
  google_drive_url text,
  todoist_project_id text,
  calendar_event_ids text[] default '{}',
  brief jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists campaign_milestones (
  id uuid primary key default uuid_generate_v4(),
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  due_date date,
  week_number int,
  todoist_task_id text,
  calendar_event_id text,
  completed boolean default false,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Performance Reports (Agent 4 inputs/outputs)
-- ─────────────────────────────────────────
create table if not exists performance_reports (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  period_start date,
  period_end date,
  metrics jsonb default '{}',
  insights text,
  google_drive_url text,
  raw_csv_url text,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Agent Run Logs
-- ─────────────────────────────────────────
create table if not exists agent_runs (
  id uuid primary key default uuid_generate_v4(),
  agent text not null check (agent in ('creator', 'trend_analyst', 'campaign_planner', 'performance_reviewer')),
  status text default 'running' check (status in ('running', 'completed', 'failed')),
  input jsonb default '{}',
  output jsonb default '{}',
  error text,
  duration_ms int,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Storage buckets (run via Supabase dashboard or CLI)
-- ─────────────────────────────────────────
-- insert into storage.buckets (id, name, public) values ('content-media', 'content-media', true);
-- insert into storage.buckets (id, name, public) values ('csv-uploads', 'csv-uploads', false);

-- ─────────────────────────────────────────
-- Updated_at triggers
-- ─────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_items_updated_at before update on content_items
  for each row execute procedure update_updated_at();

create trigger campaigns_updated_at before update on campaigns
  for each row execute procedure update_updated_at();
