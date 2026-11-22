# LMS-CCIS: context for Claude (Lead role only)

Read this briefly, then continue from section 6. Do not re-ask decided items or re-inspect files this file already describes. Conserve tokens.

## 1. Start here (every new conversation)

Sync the clone (section 2). Read-only: no installs, no downloads. Run the Verify commands (section 5) to see what has landed on main. Reply with one short line: current state and what you will do next. Then work on Next (section 6).
Kickoff prompt: "Continue the LMS. Clone main, read /CLAUDE.md, verify status, continue from Next."

## 2. How we work

Scope: the Lead role only (Migel). You help with infrastructure and integration: repo, Supabase config, hosting, environment files, Git workflow, docs, PR review, offline demo. Right now he also has you on the UI polish pass, which touches teammates' files: name the owner each time (section 4) so he can tell them.
Phases: understand (no code) -> discuss (no code) -> implement only when he says "go" or "next". One step at a time, small. A clear bug report ("fix this") may be answered with the fix directly.
Format: exact snippets grouped by file in implementation order: Replace this: (existing text, verbatim) then with this:. New file or heavy rewrite: exact path, one-line reason, full contents. No unrelated refactors. He applies changes himself (Windows, PowerShell, VS Code, D:\Projects\pup-lms). PowerShell commands one per line (no &&). No output files unless he asks (CLAUDE.md is the exception: downloadable .md). Code goes in chat. If a snippet cannot match, ask him to paste the file, then return it in full. If a change can break something before its supporting piece exists, put the risky change last. State manual steps explicitly: commands, dashboard clicks, SQL to paste, env values, redirect URLs.
Cannot run Angular, Supabase, Docker or a browser here. Verify by applying each snippet to a scratch copy with an exact-match script (each "Replace this" must match once), brace-balance checks on SCSS, and `tsc --noEmit --skipLibCheck` filtered to TS1xxx (syntax only; tsc is at /home/claude/.npm-global/bin/tsc, no sass). Say "syntax-checked" vs "not run". He runs npm start, ng build, npx supabase ... and sends output or screenshots.
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

## 5. Where things are and status (Nov 22, ~22:30)

Name: "Iskolar Archive". Repo migeltan/CCIS-LMS, local folder pup-lms/. On main (HEAD 3b04341): all feature pages, 9 migrations (latest: allow_pup_staff_domain, allow_teacher_domain), login redesign (split layout, 3-slide placeholder slideshow), vercel.json. `.github/` still NOT on main. docs/ has only Project_Plan.md.
Local, applied by him, not confirmed pushed (put on a style/ branch from origin/main, tell owners):

- Real Supabase auth: AuthService restores the session (`ready` awaited by guards), loads the profiles row, signs out suspended users; `useMockAuth` flag (false) in all 3 environment files keeps the old mock available; login shows "Cannot reach the server" for fetch errors and logs "Sign-in failed:" to the console. Google removed from login.html/ts and AuthService.
- Sidebar v1: icon rail, opens on click, locked "Enrolled" item until a section is joined, user + Logout in the footer, mobile drawer (shell._, \_nav.scss, enrolled-nav._ with `collapsed` input). He saw it and liked it. Maroon tokens override the azure Material tokens in styles.scss.
  Delivered Nov 22, not yet confirmed applied or viewed: Sidebar v2 (flat #800000 rail, whole-rail click toggles + hover edge line, plain avatar/role, Material Symbols Rounded via Google Fonts link in index.html + default font set in app.config.ts, filled icon on the active page, onRailClick in shell.ts).
  Supabase test accounts (never record passwords): demouser@pup.edu.ph (staff domain; role set via SQL, check profiles), migehltan@iskolarngbayan.pup.edu.ph (student, spelled m-i-g-e-h-l-t-a-n; password reset via SQL), panen.alfred14@gmail.com (old). Sign-in with a real account is NOT yet confirmed working (last failures were username typos).
  Data: only auth is real. Enrollments, submissions, grades etc. are still mock (seed assumes user id '1', so the real user sees none of it). Fonts (Roboto, Poppins, icons) load from Google Fonts, so the offline demo needs them self-hosted.
  Verify (run in the clone): `cd /home/claude/lms/repo && git log --oneline -5; ls backend/supabase/migrations .github docs 2>/dev/null; grep -n "signInWithGoogle\|useMockAuth" -r frontend/src | head`.

## 6. Next (one at a time; say "go" before each)

1. He applies Sidebar v2 and sends screenshots (collapsed, open, phone width). Check the icon font loaded (Network: fonts.googleapis.com; icons showing as words means it did not). Fix regressions precisely.
2. Step 3, profile settings page `/settings` for all roles, opened from the sidebar user chip (make it a link): edit full_name (profiles update, RLS allows own row), change password (supabase.auth.updateUser, real mode only), read-only email/role/status/joined, initials avatar (no photo: that needs an avatars bucket + db/ migration from role 2). Needs AuthService.updateProfile/updatePassword and a route in app.routes.ts (role 3).
3. Step 4, dashboard sectioning: bordered header band, ruled panels/grid lines, card grid, framed empty state, fix double padding (shell .content 24px + dashboard .page 24px); section-design.ts banner palette is blue/multicolor, decide whether to make it maroon-friendly.
4. He picks further screens (class view, to-do, my grades, admin) one by one; update this file after each delivered batch.
   Leftovers: .github (PR template, CODEOWNERS with teammates' usernames); confirm branch protection is enforced; confirm Vercel URL and Supabase Site URL (Google is gone, so only the Site URL matters); keep-alive for the Supabase free project (it paused from inactivity once); role-based landing page after sign-in; move the mock services to Supabase (role 2/4/5); offline demo test (Docker, environment.local.ts, self-hosted fonts); real PUP campus photos for the 3 login slides (his files, permission needed); dead `.divider` CSS in login.scss; update Project_Plan.md for email-only auth.

## 7. Known risks (state them, do not hide them)

- All UI work this phase is syntax-checked only: never compiled or viewed here. Sidebar v2 specifics: the Google Fonts Rounded axis URL, `@use 'nav'` partial path from enrolled-nav, click handler logic.
- Real auth only proven by his login attempts; roles must be set by SQL in the dashboard. If profiles has no row or the status is suspended, sign-in is rejected on purpose.
- Snippets assume his local files equal what Claude delivered earlier; replacements may need adjusting if he edited them.
- Global maroon tokens recolor teammates' screens inside the shell; Nicole's full-screen routes (/courses, /section/:id) keep their own look. Merge conflicts are possible in role 3 and role 5 files; tell the owners before he pushes.
- Free tier: Supabase idle pausing, storage and upload caps not verified; recheck before any demo. Docker Desktop (WSL2) for the offline demo not confirmed on his laptop. Branch protection may not be enforced on a free private repo.
- Teacher email domain: staff domain @pup.edu.ph is allowed by migrations; teachers on other domains would be blocked.

## 8. Updating this file

Only when the conversation nears ~90% usage, he says it is ending, or he asks: update sections 5-7 only, deliver the full file once as a downloadable .md (dense, under ~130 lines, drop stale detail), and remind him to commit it to the repo root and push to main so a fresh clone sees it.
