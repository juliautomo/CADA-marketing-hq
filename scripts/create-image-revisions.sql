-- Run once in Supabase SQL editor to create the image revisions table
create table if not exists cada_image_revisions (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references cada_scheduled_posts(id) on delete cascade,
  client_id    text,
  media_url    text not null,
  media_urls   text[],
  image_model  text,
  prompt_used  text,
  correction_note text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_cada_image_revisions_post_id on cada_image_revisions(post_id);
create index if not exists idx_cada_image_revisions_client_id on cada_image_revisions(client_id);
