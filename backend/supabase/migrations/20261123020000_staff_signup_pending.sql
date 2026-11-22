-- Staff-domain signups start as pending_teacher: registering is the teacher request.
-- The role stays 'student' until an admin runs approve_teacher.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, status)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    case when split_part(lower(new.email), '@', 2) = 'pup.edu.ph'
         then 'pending_teacher' else 'active' end
  )
  on conflict do nothing;
  return new;
end; $$;