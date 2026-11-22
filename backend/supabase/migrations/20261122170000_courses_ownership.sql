-- Course ownership, per-teacher course codes, cover columns, and the course-covers bucket.

-- 1) Columns
alter table public.courses
  add column if not exists owner_id uuid references public.profiles(id) on delete set null default auth.uid(),
  add column if not exists cover_gradient text,
  add column if not exists cover_url text;

create index if not exists courses_owner_id_idx on public.courses(owner_id);

-- 2) Course code unique per owner, not globally
alter table public.courses drop constraint if exists courses_code_key;
create unique index if not exists courses_owner_code_uidx on public.courses(owner_id, code);

-- 3) Ownership helper (security definer, same pattern as teaches_section)
create or replace function public.owns_course(p_course_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.courses
    where id::text = p_course_id and owner_id = auth.uid()
  );
$$;

-- 4) Courses RLS: select stays open to signed-in users (students need title/code in class views)
drop policy if exists "courses_insert" on public.courses;
drop policy if exists "courses_update" on public.courses;
drop policy if exists "courses_delete" on public.courses;

create policy "courses_insert" on public.courses for insert to authenticated
  with check ((public.is_teacher() and owner_id = auth.uid()) or public.is_admin());
create policy "courses_update" on public.courses for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy "courses_delete" on public.courses for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- 5) Public course-covers bucket: 2 MB, images only; writes only inside your own course folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-covers', 'course-covers', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "course_covers_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'course-covers'
    and (public.owns_course((storage.foldername(name))[1]) or public.is_admin())
  );
create policy "course_covers_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'course-covers'
    and (public.owns_course((storage.foldername(name))[1]) or public.is_admin())
  );
create policy "course_covers_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'course-covers'
    and (public.owns_course((storage.foldername(name))[1]) or public.is_admin())
  );