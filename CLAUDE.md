LMS-CCIS: context for Claude (Lead role only)
Read this briefly, then continue from Next. Do not re-ask decided items or re-inspect files this file already describes. Conserve tokens.

Start here (every new conversation)
Sync the clone (section 2). Read-only: no installs, no downloads.
Run the Verify commands (section 5) to see what has landed on main.
Reply with one short line: current state and what you will do next. Then work on Next.
Kickoff prompt: "Continue the LMS. Clone main, read /CLAUDE.md, verify status, continue from Next."

1. How we work
   Scope: the Lead role only (Migel). You help with infrastructure and integration: repo, Supabase project config, hosting, environment files, Git workflow, docs, PR review, offline demo. Teammates' feature code (section 4, ownership) is out of scope unless he asks; if a task touches their folders, name the owner.
   Phases: understand (no code) -> discuss (no code) -> implement only when he says "go" or "next". One step at a time, small. Present exact snippets grouped by file in implementation order: Replace this: (existing text, verbatim) then with this:. New file or heavy rewrite: exact path, one-line reason, full contents. No unrelated refactors.
   He applies changes himself (Windows, PowerShell, VS Code, project at D:\Projects\pup-lms). Give PowerShell commands one per line (no &&). No output files unless he asks (CLAUDE.md is the exception: downloadable .md). Code goes in chat.
   Match files by content. If a snippet cannot match, ask him to paste the file, then return it in full. If a change can break something before its supporting piece exists, order the steps so the risky change comes last.
   State manual steps explicitly: commands, dashboard clicks, what to paste where, env values, redirect URLs.
   Cannot run Angular, Supabase, Docker or a browser here. Verify by applying each snippet to a scratch copy with an exact-match script (each "Replace this" must match once) and by parsing JSON/TOML/YAML. Say "syntax-checked" vs "not run". He runs npm start, ng build, npx supabase ... and sends output or screenshots.
   Never ask for or paste secrets (service_role key, Google client secret, DB password). The Supabase project URL and anon key are fine.
   Tokens: grep -n, sed -n ranges only; never cat big files. Concise replies, at most one question per reply (prefer a stated default). Be direct; flag risks and unverified guesses honestly.
   Windows gotchas: never Move-Item a project across drives (it split this repo once); if ng is blocked, Set-ExecutionPolicy -Scope CurrentUser RemoteSigned; npm 11 prints harmless allow-scripts warnings; never run npm audit fix --force.
2. Seeing the code
   mkdir -p /home/claude/lms && cd /home/claude/lms
   [ -d repo ] || git clone --depth 1 https://github.com/migeltan/CCIS-LMS.git repo
   cd repo && git fetch --depth 15 origin main && git reset --hard FETCH_HEAD && git log --oneline -5
   Read-only reference; never push. It shows only what is pushed to main; his local copy is often ahead (treat unpushed work as intentional). If the clone fails (private repo or different URL), ask him for the exact URL; do not guess.
   Never run npm install, npm ci or pip install. Ignore node_modules and package-lock.json.
3. Project
   Classroom/Canvas-style LMS for CCIS, PUP. School project for Systems Integration and Architecture, but it must be actually usable by about 50 students plus the professor, on a free stack. Team of 5 (3rd years). Deadline: Nov 11, 2026. Full plan: docs/Project_Plan.md (source of truth for roles, timeline, flowcharts, ERD; do not re-read it in full, grep a section).

Goal: teachers take courses and handle sections; they post announcements, upload materials (PDF/PPT/links) and create activities; students join a section with a code, see the stream, materials and activities, submit work and see grades. Quizzes are Google Form links. Admin approves teachers. Must also run offline for the demo.

# Role Side

1 Lead / DevOps / Integration (Migel, this file) repo, hosting, config, reviews
2 Database / Supabase backend: migrations, RLS, functions, seed
3 Auth / Admin / App shell frontend core, login, guards, layout
4 Teacher side courses, sections, stream, materials
5 Student side + activities dashboard, activities, submissions, grades

4. Decisions / rules already made (do not re-ask)
   Stack: Angular (standalone, new app.ts/app.html file naming) + Angular Material; Supabase (Postgres, Auth, Storage, RLS); no separate backend server (Laravel dropped: free PHP hosting is weak). Custom logic = Postgres RPC or Edge Functions. Hosting: Cloudflare Pages or Vercel (pick one at A5), auto-deploy main. Offline demo = Docker + local Supabase + built Angular on one laptop; designed now, tested Nov 8-9; Google sign-in needs internet, so offline uses seeded email/password.
   Repo layout: frontend/ Angular, backend/ Supabase CLI project, docs/, .github/. All schema changes are migration files in backend/supabase/migrations/; never click schema in the dashboard, never edit an applied migration.
   Auth: Google sign-in plus email fallback; only @iskolarngbayan.pup.edu.ph (also enforced by a DB trigger); teacher domain unconfirmed and may differ. Default role student; admin approves teacher. Role checks in both Angular guards and RLS.
   Secrets: project URL and anon key are committed in frontend/src/environments/ (RLS protects data). Never commit service_role, Google client secret or DB password.
   Git: main protected (PR + 1 review); short-lived branches feat/<area>-<task>, fix/, db/; squash merge; no shared feat branch, no dev branch; after the Nov 7 freeze only fix/ PRs. Branches live at most 2 days.
   Ownership (Lead's files): .github/ (CODEOWNERS, PR template), docs/, root README.md, frontend/angular.json, frontend/src/environments/, backend/package.json, backend/supabase/config.toml, hosting settings. Others stay in their own folders; DB person regenerates frontend/src/app/core/models/database.types.ts; frontend codes against mock services until schema v1 (target Oct 30).
   Setup was split: Lead does Part A of the plan, teammates then clone, npm install, npm start.

5. Where things are and status
   Project display name is now "Iskolar Archive" (was "PUP Classroom"); repo is still migeltan/CCIS-LMS, local folder pup-lms/.
   frontend/ Angular app (src/app, src/environments, public/assets/images, vercel.json, angular.json)
   backend/ Supabase CLI (supabase/config.toml, seed.sql, migrations/)
   docs/ Project_Plan.md
   README.md, CLAUDE.md
   On main as of Nov 22 (HEAD 797a948): migrations init_schema, storage_buckets (Oct 28), schema_v1, rls_policies, rpc_functions, storage_policies (Nov 6), signup_profile_and_domain (Nov 16); real supabaseUrl in environment.ts; frontend/vercel.json SPA rewrite (PR #12 chore/hosting); features pushed: login, shell/sidebar, student dashboard + enrolled nav + join-section dialog, teacher courses, stream, section pages (classwork, people, submissions, grades), gradebook, my-grades, admin-users. .github/ is NOT on main (no PR template or CODEOWNERS pushed).
   Current phase (Nov 22): UI polish pass, one screen at a time. Delivered, waiting for him to apply and send a screenshot (not run here): landing/login redesign (split layout, left 3-slide crossfade slideshow with dots, right sign-in; mobile hides the slideshow) and the rename in index.html <title> and shell.html toolbar. Files: frontend/src/app/features/auth/login/{login.ts,login.html,login.scss} (full rewrites, MatCardModule dropped), frontend/src/index.html, frontend/src/app/shared/layout/shell/shell.html. Slides use gradient placeholders; slides array and bg values live in login.ts.
   Verify (run in the clone):

cd /home/claude/lms/repo && git log --oneline -5
ls frontend/src/environments backend/supabase/migrations
grep -rn "Iskolar Archive\|PUP Classroom" frontend/src
ls .github docs 2>/dev/null
Gotchas: Angular files in app/ use app.component.ts (root) but features use login.ts/login.html style; login/shell files belong to role 3 (Auth/App shell), tell that owner before he pushes to avoid conflicts; real photos go in frontend/public/assets/images/ and are referenced as url('/assets/images/<file>').

6. Next (one at a time; say "go" before each)
   UI pass: (1) he applies the login snippets, runs npm start, sends a screenshot; fix any regression precisely. (2) Swap the 3 gradient placeholders for real PUP campus photos (he supplies files and names). (3) He picks the next screen (shell/sidebar, dashboard, course and section pages, admin) and says go; deliver snippets, then update this file.
   Leftovers: .github (PR template, CODEOWNERS with teammates' usernames); confirm branch protection actually enforced; confirm the Vercel deployed URL and its Supabase Site URL/redirect URLs; real Google OAuth (login.ts google() comment says mock); offline demo (Docker + local Supabase + environment.local.ts) status unknown, test it.
   UI rules for this pass: snippets as Replace this/with this, full file when the rewrite is heavy; no re-sending whole files for small mobile CSS fixes (send only the CSS block to append); write code only when he says go.

7. Known risks (state them, do not hide them)
   Login redesign is syntax-checked only (replacements matched once, braces balanced), never compiled or viewed; template uses @for and signals so it needs the project's Angular 17+ (it already uses them elsewhere).
   Slideshow shows gradient placeholders until real photos are added; photos must be ones he has permission to use.
   Teacher email domain unconfirmed: sign-up domain restriction (DB trigger plus migration) may block teachers.
   Free-tier limits not verified (Supabase idle pausing, storage and upload caps); recheck before any demo.
   Docker Desktop (WSL2) for the offline demo not confirmed on his laptop.
   Branch protection may not be enforced on a free private repo; UI edits touch role 3's files, so merge conflicts are possible.
   Section 3 timeline (Nov 11 deadline) predates this phase; treat it as history, do not plan from it without asking.
8. Updating this file
   Only when the conversation nears ~90% usage, he says it is ending, or he asks: update sections 5-7 only, deliver the full file once as a downloadable .md (dense, under ~130 lines, drop stale detail), and remind him to commit it to the repo root and push to main so a fresh clone sees it.
