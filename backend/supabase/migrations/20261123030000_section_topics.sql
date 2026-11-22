-- B4: persisted classwork topics (a topic can exist before it has any item).
create table public.section_topics (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create unique index section_topics_name_uidx on public.section_topics(section_id, lower(name));

alter table public.section_topics enable row level security;

create policy "section_topics_select" on public.section_topics for select to authenticated
  using (public.teaches_section(section_id) or public.is_enrolled(section_id) or public.is_admin());
create policy "section_topics_manage" on public.section_topics for all to authenticated
  using (public.teaches_section(section_id) or public.is_admin())
  with check (public.teaches_section(section_id) or public.is_admin());