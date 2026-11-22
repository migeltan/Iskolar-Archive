-- B1: topics, comments, teacher-created submissions, server-side submission protection.

-- 1) Topics (classwork grouping)
alter table public.materials  add column if not exists topic text check (char_length(topic) <= 100);
alter table public.activities add column if not exists topic text check (char_length(topic) <= 100);

-- 2) Helpers
create or replace function public.section_of_announcement(p_announcement_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select section_id from public.announcements where id = p_announcement_id;
$$;

create or replace function public.student_in_section(p_section_id uuid, p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments
    where section_id = p_section_id and student_id = p_student_id
  );
$$;

-- 3) Comment tables. author_name is filled by a trigger so classmates never need to read each other's profiles.
create table public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index announcement_comments_announcement_idx on public.announcement_comments(announcement_id, created_at);

create table public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index activity_comments_thread_idx on public.activity_comments(activity_id, student_id, created_at);

create or replace function public.set_comment_author_name()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(btrim(full_name), ''), email) into new.author_name
  from public.profiles where id = new.author_id;
  return new;
end; $$;

create trigger announcement_comments_author_name
before insert on public.announcement_comments
for each row execute function public.set_comment_author_name();

create trigger activity_comments_author_name
before insert on public.activity_comments
for each row execute function public.set_comment_author_name();

alter table public.announcement_comments enable row level security;
alter table public.activity_comments enable row level security;

-- announcement comments: section teacher + enrolled students read and write; author or teacher deletes
create policy "ann_comments_select" on public.announcement_comments for select to authenticated
  using (
    public.teaches_section(public.section_of_announcement(announcement_id))
    or public.is_enrolled(public.section_of_announcement(announcement_id))
    or public.is_admin()
  );
create policy "ann_comments_insert" on public.announcement_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      public.teaches_section(public.section_of_announcement(announcement_id))
      or public.is_enrolled(public.section_of_announcement(announcement_id))
    )
  );
create policy "ann_comments_delete" on public.announcement_comments for delete to authenticated
  using (
    author_id = auth.uid()
    or public.teaches_section(public.section_of_announcement(announcement_id))
    or public.is_admin()
  );

-- activity comments: private thread per (activity, student); only that student and the section teacher
create policy "act_comments_select" on public.activity_comments for select to authenticated
  using (
    student_id = auth.uid()
    or public.teaches_section(public.section_of_activity(activity_id))
    or public.is_admin()
  );
create policy "act_comments_insert" on public.activity_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and (
      (student_id = auth.uid() and public.is_enrolled(public.section_of_activity(activity_id)))
      or (
        public.teaches_section(public.section_of_activity(activity_id))
        and public.student_in_section(public.section_of_activity(activity_id), student_id)
      )
    )
  );
create policy "act_comments_delete" on public.activity_comments for delete to authenticated
  using (
    author_id = auth.uid()
    or public.teaches_section(public.section_of_activity(activity_id))
    or public.is_admin()
  );

-- 4) Submissions: teacher may create a row for an enrolled student (grade or zero a blank "Pending" cell)
alter table public.submissions alter column submitted_at drop not null;  -- null = teacher-created, never submitted

drop policy if exists "submissions_insert" on public.submissions;
create policy "submissions_insert" on public.submissions for insert to authenticated
  with check (
    (student_id = auth.uid() and public.is_enrolled(public.section_of_activity(activity_id)))
    or (
      public.teaches_section(public.section_of_activity(activity_id))
      and public.student_in_section(public.section_of_activity(activity_id), student_id)
    )
    or public.is_admin()
  );

-- 5) Server-side protection: status, submitted_at, identity columns, lock after grading
create or replace function public.protect_submission_columns()
returns trigger language plpgsql as $$
declare
  v_staff boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;  -- SQL editor / service role
  end if;

  if tg_op = 'UPDATE'
     and (new.activity_id is distinct from old.activity_id
          or new.student_id is distinct from old.student_id) then
    raise exception 'Activity and student cannot be changed';
  end if;

  v_staff := public.teaches_section(public.section_of_activity(new.activity_id)) or public.is_admin();

  if v_staff then
    if tg_op = 'INSERT' and new.student_id <> auth.uid() then
      new.submitted_at := null;  -- teacher-created row, the student never submitted
    end if;
    return new;
  end if;

  -- student path
  if new.status not in ('draft', 'submitted') then
    raise exception 'Only the teacher can mark a submission as graded';
  end if;

  if tg_op = 'INSERT' then
    new.submitted_at := now();
  else
    if old.status = 'graded' or old.grade_released then
      raise exception 'This submission is graded and locked';
    end if;
    new.submitted_at := case when new.status = 'submitted' then now() else old.submitted_at end;
  end if;
  return new;
end; $$;

create trigger protect_submission_columns
before insert or update on public.submissions
for each row execute function public.protect_submission_columns();

-- 6) Students cannot add or remove files on a graded/locked submission
create or replace function public.protect_submission_attachments()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_submission uuid;
  v_activity uuid;
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;
  v_submission := coalesce(new.submission_id, old.submission_id);
  if v_submission is not null then
    select activity_id into v_activity from public.submissions where id = v_submission;
    if v_activity is not null
       and not (public.teaches_section(public.section_of_activity(v_activity)) or public.is_admin())
       and exists (
         select 1 from public.submissions s
         where s.id = v_submission and (s.status = 'graded' or s.grade_released)
       ) then
      raise exception 'This submission is graded and locked';
    end if;
  end if;
  return coalesce(new, old);
end; $$;

create trigger protect_submission_attachments
before insert or delete on public.attachments
for each row execute function public.protect_submission_attachments();