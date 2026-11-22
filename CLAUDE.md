# LMS-CCIS: context for Claude (Lead role only)

Read this briefly, then continue from section 6. Do not re-ask decided items or re-inspect files this file already describes. Conserve tokens.

## 1. Start here (every new conversation)

Sync the clone (section 2). Read-only: no installs, no downloads. Run the Verify commands (section 5) to see what has landed on main. Reply with one short line: current state and what you will do next. Then work on Next (section 6).
Kickoff prompt: "Continue the LMS. Clone main, read /CLAUDE.md, verify status, continue from Next."

## 2. How we work

Scope: the Lead role only (Migel). You help with infrastructure and integration: repo, Supabase config, hosting, environment files, Git workflow, docs, PR review, offline demo. Right now he also has you on the UI polish pass, which touches teammates' files: name the owner each time (section 4) so he can tell them.
Phases: understand (no code) -> discuss (no code) -> implement only when he says "go" or "next". One step at a time, small. A clear bug report ("fix this") may be answered with the fix directly.
Format: exact snippets grouped by file in implementation order: Replace this: (existing text, verbatim) then with this:. New file or heavy rewrite: exact path, one-line reason, full contents. No unrelated refactors. He applies changes himself (Windows, PowerShell, VS Code, D:\Projects\pup-lms). PowerShell commands one per line (no &&). No output files unless he asks (CLAUDE.md is the exception: downloadable .md). Code goes in chat. If a snippet cannot match, ask him to paste the file, then return it in full. If a change can break something before its supporting piece exists, put the risky change last. State manual steps explicitly: commands, dashboard clicks, SQL to paste, env values, redirect URLs.
Cannot run Angular, Supabase, Docker or a browser here. Verify by applying each snippet to a scratch copy with an exact-match script (each "Replace this" must match once), brace-balance checks on SCSS and templates (strip {{ }} first), and `tsc --noEmit --skipLibCheck` filtered to TS1xxx (syntax only; tsc is at /home/claude/.npm-global/bin/tsc, no sass). Say "syntax-checked" vs "not run". He runs npm start, ng build, npx supabase ... and sends output or screenshots.
Never ask for or paste secrets (service_role key, DB password, user passwords). The Supabase project URL and anon key are fine. Tokens: grep -n, sed -n ranges only; never cat big files. Concise replies, at most one question per reply (prefer a stated default). Be direct; flag risks and unverified guesses honestly.
Windows gotchas: never Move-Item a project across drives; if ng is blocked, Set-ExecutionPolicy -Scope CurrentUser RemoteSigned; npm 11 prints harmless allow-scripts warnings; never run npm audit fix --force.
Seeing the code: `mkdir -p /home/claude/lms && cd /home/claude/lms; [ -d repo ] || git clone --depth 1 https://github.com/migeltan/CCIS-LMS.git repo; cd repo && git fetch --depth 15 origin main && git reset --hard FETCH_HEAD && git log --oneline -5`. Read-only reference; never push. It shows only what is on main; his local copy is ahead (treat unpushed work as intentional, and note a snippet's "Replace this" may need his local text, not main's). If the clone fails, ask for the exact URL. Never run npm install, npm ci or pip install. Ignore node_modules and package-lock.json.

## 3. Project

Classroom/Canvas-style LMS for CCIS, PUP. School project (Systems Integration and Architecture) that must be usable by about 50 students plus the professor, on a free stack. Team of 5 (3rd years). Original deadline Nov 11, 2026 (passed; treat the plan timeline as history, do not plan from it without asking). Plan: docs/Project_Plan.md (grep a section, do not read in full).
Goal: teachers take courses and handle sections; post announcements, upload materials (PDF/PPT/links), create activities; students join a section with a code, see stream/materials/activities, submit work and see grades. Quizzes are Google Form links. Admin approves teachers. Must also run offline for the demo.
Roles: 1 Lead/DevOps/Integration (Migel, this file); 2 Database/Supabase backend (migrations, RLS, functions, seed); 3 Auth/Admin/App shell (login, guards, layout); 4 Teacher side (Nicole: courses, sections, stream, materials; full-screen routes outside the shell); 5 Student side + activities (Gwen: dashboard, activities, submissions, grades).

## 4. Decisions / rules already made (do not re-ask)

Stack: Angular 22 (standalone, app.ts/app.html naming) + Angular Material; Supabase (Postgres, Auth, Storage, RLS); no separate backend (custom logic = Postgres RPC or Edge Functions). Hosting: Vercel (frontend/vercel.json SPA rewrite), auto-deploy main. Offline demo = Docker + local Supabase + built Angular on one laptop (environment.local.ts), tested later; offline uses seeded email/password.
Repo layout: frontend/, backend/ (Supabase CLI), docs/, .github/. All schema changes are migration files in backend/supabase/migrations/; never click schema in the dashboard, never edit an applied migration. One-off DATA fixes (reset a test password, set a role) via the SQL Editor are fine.
Auth: EMAIL + PASSWORD ONLY (Google sign-in was removed Nov 22; do not re-add). Domains enforced by DB trigger: students @iskolarngbayan.pup.edu.ph, staff @pup.edu.ph. Role lives in profiles.role (default student, admin approves teachers; users cannot promote themselves, a DB trigger blocks it). The login dropdown only picks the domain suffix, never the role. Role checks in both Angular guards and RLS.
Secrets: project URL and anon key are committed in frontend/src/environments/. Never commit service_role or DB password.
Git: main protected (PR + 1 review); short-lived branches feat/, fix/, db/, style/; squash merge; branches live at most 2 days.
Ownership. Lead: .github/, docs/, README.md, angular.json, src/environments/, backend/package.json, config.toml, hosting. Role 3: core/auth, core/guards, login, shell, styles.scss, app.config.ts, index.html. Role 5: features/dashboard (dashboard, enrolled-nav, class-view, join dialog), activities, grades, todo. Role 2 regenerates core/models/database.types.ts. Role 4: features/courses, features/sections, stream.

## 5. Where things are and status (Nov 22, ~23:15)

Name: "Iskolar Archive". Repo migeltan/CCIS-LMS, local folder pup-lms/. On main (HEAD 7bdb3b6 "restyle: ui of landing page and added a sidebar"): feature pages, 9 migrations, login redesign, shell with Sidebar v2. `.github/` still NOT on main. docs/ has only Project_Plan.md.
Student side, applied locally and confirmed working by him (screenshots), NOT confirmed pushed (put on a style/ branch from origin/main, tell owners):

- Real Supabase auth works: student account signs in. Test accounts (never record passwords): migelhtan@iskolarngbayan.pup.edu.ph (student, spelled m-i-g-e-l-h-t-a-n; the old spelling "migehltan" was a typo and caused the earlier login failures), demouser@pup.edu.ph (teacher, active), panen.alfred14@gmail.com (old student). Roles are set by SQL.
- Sidebar v2 (flat #800000 rail, same maroon as buttons; hover no longer changes colour), Material Symbols icons, whole-rail click toggles.
- /settings page (all roles): edit name, change password (real mode only), read-only email/role/status/joined, profile photo upload. Sidebar user chip links to it.
- Profile pictures: migration 20261122150000_profile_avatars.sql (profiles.avatar_url, public `avatars` bucket 2 MB, own-folder policies) applied; photo shows in sidebar. Client crops to a 256px square JPEG. Role 2 still to add avatar_url to database.types.ts; confirm the migration file is committed on a db/ branch.
- Dashboard sectioning: framed header band (no maroon side accent, by his choice), ruled panel with count chip and faint grid, dashed empty state. Warm 8-colour banner palette in section-design.ts.
  Delivered, not yet confirmed applied or viewed: dashboard "Welcome back, <first name>" header; removal of the yellow active-item bar in \_nav.scss (keyboard-focus ring is still gold #e8b84a); class-view rewrite (activity-list: two columns, Activities panel + To do this week + Your work panels, same panel style; banner radius 12).
  UI rules he set: one shared page width (max-width 1100px, no per-page padding; the shell .content gives 24px) on every in-shell page; sidebar closes when he clicks the page content or a nav item; no extra accents. Page-width snippets were given for to-do, my-grades, gradebook, activity-list, activity-submit, activity-create, class-view, settings.
  Teacher side (Nicole, role 4) is a different design from the student side: peach/coral striped background, serif display font, its own white topbar (logo, "Demo data" toggle, name, Log out) on /courses (welcome pill, "My courses" panel, course cards with purple/pink gradients, section pills with stream/classwork/grades/people icons, ADD COURSE / CREATE SECTION buttons), and a section layout at /section/:id/{stream,classwork,grades,people,submissions/:activityId} with its own light left sidebar (Stream, Classwork, Grades, People, "My courses" back pill) and a gradient section header. These routes sit OUTSIDE the shell. Data is mock (shared/mock/lms-mock-data.ts, `demoDataLoaded` signal drives the Demo data toggle). Teacher avatar there is a localStorage mock (section-layout), not the real profile photo. He says codes and anything technical do not work yet on this side.
  Data: only auth and profiles are real. Enrollments, courses, sections, activities, submissions, grades are mock (seed assumes user id '1', so a real user sees none of it). Fonts (Roboto, Poppins, icons) load from Google Fonts, so the offline demo needs them self-hosted.
  Verify (run in the clone): `cd /home/claude/lms/repo && git log --oneline -5; ls backend/supabase/migrations .github docs 2>/dev/null; ls frontend/src/app/features/settings; grep -n "avatar_url" -r frontend/src | head`.

## 6. Next (one at a time; say "go" before each)

1. NEW, his priority: restyle the TEACHER side. He wants the same workflow kept but a major design change so it matches the student side. Start in the understand/discuss phase (no code): read features/courses, features/sections, features/stream and section-layout (grep and ranges only); propose a direction, default = bring teacher routes inside the shell (maroon sidebar, ruled panels, 1100px page, warm palette) and drop the coral stripes, topbar and separate sidebar; get his OK on the direction and on what "Demo data" should become. Then implement screen by screen: courses list first, then section layout (stream, classwork, grades, people, submissions). Every snippet touches role 4 files: name Nicole each time and tell him to warn her before pushing. Switch the teacher avatar to profile.avatar_url.
2. List what "does not work" on the teacher side (section codes, create course/section, materials, anything mock) with him and map it to role 2/4 work (RPCs, RLS, services replacing the mock). Do not fix the backend wiring unless he asks; flag it.
3. Student screens still to restyle: to-do and my grades together (shared layout), then activity-submit and gradebook, then admin. Confirm the delivered batch (welcome line, class view, accent removal) with screenshots first.
   Leftovers: .github (PR template, CODEOWNERS with teammates' usernames); confirm branch protection is enforced; confirm Vercel URL and Supabase Site URL; keep-alive for the Supabase free project (it paused from inactivity once); role-based landing page after sign-in (teachers currently see the student dashboard at /dashboard); move the mock services to Supabase (role 2/4/5); offline demo test (Docker, environment.local.ts, self-hosted fonts); real PUP campus photos for the 3 login slides (his files, permission needed); dead `.divider` CSS in login.scss; update Project_Plan.md for email-only auth; commit the avatars migration and push.

## 7. Known risks (state them, do not hide them)

- Almost all UI work is syntax-checked only: never compiled or viewed here. He confirms with screenshots; ask for them after each batch.
- Real auth works for the student account; the teacher account (demouser) sign-in is not confirmed. If profiles has no row or the status is suspended, sign-in is rejected on purpose.
- AuthService selects avatar_url: if main is deployed to an environment without the avatars migration, loadProfile fails and nobody can sign in. Apply the migration before deploying.
- Snippets assume his local files equal what Claude delivered earlier; replacements may need adjusting if he edited them, and some anchors only exist locally, not on main.
- Global maroon tokens recolor teammates' screens inside the shell. Moving teacher routes into the shell, or restyling them, changes Nicole's files heavily: merge conflicts are likely, so tell her first and keep the batch on a style/ branch. The activity-list rewrite changes Gwen's files the same way.
- The teacher side is mock data, so restyling it cannot prove the real flows work. A pretty teacher UI over broken join codes or empty Supabase tables will still fail the demo.
- Free tier: Supabase idle pausing, storage and upload caps not verified; recheck before any demo. Docker Desktop (WSL2) for the offline demo not confirmed on his laptop. Branch protection may not be enforced on a free private repo.
- Teacher email domain: staff domain @pup.edu.ph is allowed by migrations; teachers on other domains would be blocked.

## 8. Updating this file

Only when the conversation nears ~90% usage, he says it is ending, or he asks: update sections 5-7 only, deliver the full file once as a downloadable .md (dense, under ~130 lines, drop stale detail), and remind him to commit it to the repo root and push to main so a fresh clone sees it.
