create table if not exists public.documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'Non classe',
  language text not null default 'fr',
  text text not null default '',
  translated_text text not null default '',
  summary text not null default '',
  cards text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents enable row level security;

drop policy if exists "Users can read their documents" on public.documents;
create policy "Users can read their documents"
on public.documents
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their documents" on public.documents;
create policy "Users can create their documents"
on public.documents
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their documents" on public.documents;
create policy "Users can update their documents"
on public.documents
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their documents" on public.documents;
create policy "Users can delete their documents"
on public.documents
for delete
to authenticated
using (auth.uid() = user_id);
