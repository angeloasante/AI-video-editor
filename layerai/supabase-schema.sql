-- ============================================================
-- LayerAI Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- 1. Profiles table (extends Supabase auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Projects table (user's editor projects)
create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null default 'Untitled Project',
  description text,
  thumbnail_url text,
  scene_dna jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_projects_user_id on public.projects(user_id);

-- 3. Studio state (timeline, clips, text overlays per project)
create table if not exists public.studio_state (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  clips jsonb default '[]'::jsonb,
  text_overlays jsonb default '[]'::jsonb,
  transitions jsonb default '[]'::jsonb,
  selected_ratio text default '16:9',
  video_overlays jsonb default '[]'::jsonb,
  clip_edits_map jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

create index if not exists idx_studio_state_project on public.studio_state(project_id);
create index if not exists idx_studio_state_user on public.studio_state(user_id);

-- 4. Transcriptions (per clip, per project)
create table if not exists public.transcriptions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  clip_id text not null,
  source_url text not null,
  full_text text not null,
  language_code text default 'en',
  captions jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_transcriptions_project on public.transcriptions(project_id);
create unique index if not exists idx_transcriptions_clip on public.transcriptions(project_id, clip_id);

-- 5. AI chat history (per user, per project)
create table if not exists public.ai_chat_messages (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  type text check (type in ('text', 'video', 'image')),
  media_url text,
  enhanced_prompt text,
  request_id text,
  model_id text,
  created_at timestamptz default now()
);

create index if not exists idx_chat_user on public.ai_chat_messages(user_id);
create index if not exists idx_chat_project on public.ai_chat_messages(project_id);
create index if not exists idx_chat_created on public.ai_chat_messages(created_at);

-- 5. User media files (tracks uploaded + AI-generated files per user)
create table if not exists public.user_media (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  url text not null,
  path text not null,
  type text not null check (type in ('video', 'image', 'audio', 'unknown')),
  source text default 'upload' check (source in ('upload', 'ai-generated')),
  size_bytes bigint,
  duration_seconds float,
  created_at timestamptz default now()
);

create index if not exists idx_user_media_user on public.user_media(user_id);
create index if not exists idx_user_media_project on public.user_media(project_id);

-- 6. Scene DNA (per project)
create table if not exists public.scene_dna (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.projects(id) on delete cascade not null unique,
  user_id uuid references auth.users(id) on delete cascade not null,
  dna jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS) — users only see their own data
-- ============================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.studio_state enable row level security;
alter table public.transcriptions enable row level security;
alter table public.ai_chat_messages enable row level security;
alter table public.user_media enable row level security;
alter table public.scene_dna enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Projects: users can CRUD their own projects
create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);
create policy "Users can create projects" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);

-- Studio state: users can CRUD their own
create policy "Users can view own studio state" on public.studio_state
  for select using (auth.uid() = user_id);
create policy "Users can create studio state" on public.studio_state
  for insert with check (auth.uid() = user_id);
create policy "Users can update own studio state" on public.studio_state
  for update using (auth.uid() = user_id);
create policy "Users can delete own studio state" on public.studio_state
  for delete using (auth.uid() = user_id);

-- Transcriptions: users can CRUD their own
create policy "Users can view own transcriptions" on public.transcriptions
  for select using (auth.uid() = user_id);
create policy "Users can create transcriptions" on public.transcriptions
  for insert with check (auth.uid() = user_id);
create policy "Users can update own transcriptions" on public.transcriptions
  for update using (auth.uid() = user_id);
create policy "Users can delete own transcriptions" on public.transcriptions
  for delete using (auth.uid() = user_id);

-- AI chat: users can CRUD their own messages
create policy "Users can view own chat" on public.ai_chat_messages
  for select using (auth.uid() = user_id);
create policy "Users can create chat messages" on public.ai_chat_messages
  for insert with check (auth.uid() = user_id);
create policy "Users can update own chat" on public.ai_chat_messages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own chat" on public.ai_chat_messages
  for delete using (auth.uid() = user_id);

-- User media: users can CRUD their own files
create policy "Users can view own media" on public.user_media
  for select using (auth.uid() = user_id);
create policy "Users can create media" on public.user_media
  for insert with check (auth.uid() = user_id);
create policy "Users can update own media" on public.user_media
  for update using (auth.uid() = user_id);
create policy "Users can delete own media" on public.user_media
  for delete using (auth.uid() = user_id);

-- Scene DNA: users can CRUD their own
create policy "Users can view own scene dna" on public.scene_dna
  for select using (auth.uid() = user_id);
create policy "Users can create scene dna" on public.scene_dna
  for insert with check (auth.uid() = user_id);
create policy "Users can update own scene dna" on public.scene_dna
  for update using (auth.uid() = user_id);
create policy "Users can delete own scene dna" on public.scene_dna
  for delete using (auth.uid() = user_id);

-- ============================================================
-- Storage policies — scope media bucket to user folders
-- ============================================================
-- Users upload to: media/{user_id}/filename
-- Users can only access their own folder

-- Allow authenticated users to upload to their own folder
create policy "Users can upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to read their own files
create policy "Users can read own files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own files
create policy "Users can delete own files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read for AI-generated content (shared folder)
create policy "Public read for ai-generations" on storage.objects
  for select to public
  using (
    bucket_id = 'media' and
    (storage.foldername(name))[1] = 'ai-generations'
  );

-- ============================================================
-- Updated_at trigger
-- ============================================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute procedure public.update_updated_at();
create trigger update_projects_updated_at before update on public.projects
  for each row execute procedure public.update_updated_at();
create trigger update_studio_state_updated_at before update on public.studio_state
  for each row execute procedure public.update_updated_at();
create trigger update_scene_dna_updated_at before update on public.scene_dna
  for each row execute procedure public.update_updated_at();
