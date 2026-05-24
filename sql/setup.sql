create extension if not exists "pgcrypto";

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position text not null,
  company_name text not null,
  job_listing_url text,
  notes text not null default '',
  about_role text not null default '',
  about_company text not null default '',
  responsibilities text not null default '',
  requirements text not null default '',
  cover_letter text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.applications
  add column if not exists about_role text not null default '',
  add column if not exists about_company text not null default '',
  add column if not exists responsibilities text not null default '',
  add column if not exists requirements text not null default '',
  add column if not exists cover_letter text not null default '';

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = excluded.public;

create table if not exists public.user_resumes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('ready', 'applied', 'interviewing', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists applications_user_id_idx
  on public.applications (user_id);

create index if not exists status_history_application_created_idx
  on public.status_history (application_id, created_at desc, id desc);

create index if not exists status_history_user_id_idx
  on public.status_history (user_id);

create index if not exists user_resumes_storage_path_idx
  on public.user_resumes (storage_path);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_set_updated_at on public.applications;

create trigger applications_set_updated_at
before update on public.applications
for each row
execute function public.set_updated_at();

drop trigger if exists user_resumes_set_updated_at on public.user_resumes;

create trigger user_resumes_set_updated_at
before update on public.user_resumes
for each row
execute function public.set_updated_at();

alter table public.applications enable row level security;
alter table public.status_history enable row level security;
alter table public.user_resumes enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, delete on public.status_history to authenticated;
grant select, insert, update, delete on public.user_resumes to authenticated;

drop policy if exists "Users can select their applications" on public.applications;
create policy "Users can select their applications"
on public.applications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert their applications" on public.applications;
create policy "Users can insert their applications"
on public.applications
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their applications" on public.applications;
create policy "Users can update their applications"
on public.applications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their applications" on public.applications;
create policy "Users can delete their applications"
on public.applications
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can select their status history" on public.status_history;
create policy "Users can select their status history"
on public.status_history
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert status history for their applications" on public.status_history;
create policy "Users can insert status history for their applications"
on public.status_history
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.applications
    where applications.id = status_history.application_id
      and applications.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their status history through cascade" on public.status_history;
create policy "Users can delete their status history through cascade"
on public.status_history
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can select their resume metadata" on public.user_resumes;
create policy "Users can select their resume metadata"
on public.user_resumes
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert their resume metadata" on public.user_resumes;
create policy "Users can insert their resume metadata"
on public.user_resumes
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update their resume metadata" on public.user_resumes;
create policy "Users can update their resume metadata"
on public.user_resumes
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete their resume metadata" on public.user_resumes;
create policy "Users can delete their resume metadata"
on public.user_resumes
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can select their resume files" on storage.objects;
create policy "Users can select their resume files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can insert their resume files" on storage.objects;
create policy "Users can insert their resume files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their resume files" on storage.objects;
create policy "Users can update their resume files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their resume files" on storage.objects;
create policy "Users can delete their resume files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
