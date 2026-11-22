-- Teachers, professors and admins use @pup.edu.ph.
-- Students keep iskolarngbayan.pup.edu.ph (added in the earlier migration).
-- The enforce_allowed_email trigger matches the domain exactly, so the two
-- domains do not overlap.
insert into public.allowed_email_domains (domain)
values ('pup.edu.ph')
on conflict do nothing;