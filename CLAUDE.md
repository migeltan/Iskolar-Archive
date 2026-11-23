# Iskolar-Archive: context for Claude

Read briefly, then continue from section 6. Do not re-ask decided items or re-inspect files this file describes. Conserve tokens.

## 1. Start here (every new conversation)

Sync the clone (section 2). Read-only: no installs, no downloads. Run the Verify command (section 5). Reply with one short line: current state and what you will do next. Then work on section 6.
Kickoff prompt: "Continue the LMS. Clone main, read /CLAUDE.md, verify status, continue from Next."

## 2. How we work

Solo project: Migel is the only developer. No roles, file owners or teammates to warn. Repo, Supabase, hosting, env, Git, docs, backend, schema and UI are all his. Still say which files each change touches.
Git: commits go straight to main (no branches, no PRs). Because nothing is reviewed, remind him to run `ng build` before each push.
Phases: understand (no code) -> discuss (no code) -> implement only when he says "go" or "next". One small step at a time. A clear bug report ("fix this") may be answered with the fix directly. A bare "go" after a screenshot means: do the next step in section 6.
Format: every path from the repo root (D:\Projects\pup-lms), e.g. frontend\src\app\shared\course-dialog\...; shared/ and features/ have look-alike folders. He prefers full drop-in files (full TS/HTML/SCSS files; new files with path + one-line reason); small edits as Replace this: (verbatim, must match once) then with this:. List manual fills (paths, URLs, imports) explicitly. Group by file in implementation order, risky change (routes) last. No unrelated refactors. He applies changes himself (Windows, PowerShell, VS Code); PowerShell commands one per line (no &&). No output files unless asked (CLAUDE.md is the exception: downloadable .md). Code goes in chat. If a snippet cannot match, ask him to paste the file, then return it in full. State manual steps explicitly (commands, dashboard clicks, SQL, env values).
Cannot run Angular, Supabase, Docker or a browser here. Verify by applying snippets to a scratch copy with an exact-match script, brace-balance checks on SCSS/templates (strip {{ }}), and `tsc --noEmit --skipLibCheck --target es2022 --experimentalDecorators <files>` filtered to TS1xxx (tsc at /home/claude/.npm-global/bin/tsc, no sass). Say "syntax-checked" vs "not run". SQL is read-checked only. He runs npm start, ng build, npx supabase ... and sends output or screenshots.
Never ask for or paste secrets (service_role key, DB password, user passwords). Project URL and anon key are fine. Tokens: grep -n, sed -n ranges only; never cat big files. Concise replies, at most one question per reply (prefer a stated default). Be direct; flag risks and unverified guesses.
Windows gotchas: never Move-Item a project across drives; if ng is blocked, Set-ExecutionPolicy -Scope CurrentUser RemoteSigned; npm 11 allow-scripts warnings are harmless; never npm audit fix --force; PowerShell 5.1 `>` writes UTF-16 (use `| Out-File -Encoding utf8`); VS Code keeps stale Problems for deleted files until Reload Window.
Clone: `mkdir -p /home/claude/lms && cd /home/claude/lms; [ -d repo ] || git clone --depth 1 https://github.com/migeltan/CCIS-LMS.git repo; cd repo && git fetch --depth 15 origin main && git reset --hard FETCH_HEAD && git log --oneline -5`. Read-only reference; never push. Shows only main; his local copy may be ahead (a "Replace this" may need his local text). If he says main is latest, trust the clone, do not ask for pastes. Never npm install/ci or pip install. Ignore node_modules and package-lock.json.

## 3. Project

Classroom/Canvas-style LMS for CCIS, PUP. School project (Systems Integration and Architecture), used by ~50 students plus the professor, free stack. Original deadline Nov 11, 2026 (passed; do not plan from the old timeline without asking). Plan: docs/Project_Plan.md (grep a section, do not read in full).
Goal: teachers take courses and sections; post announcements, upload materials (PDF/PPT/links), create activities; students join a section with a code, see stream/materials/activities, submit work, see grades. Quizzes are Google Form links. Admin approves teachers. Must also run offline for the demo (later).

## 4. Decisions / rules (do not re-ask)

Stack: Angular 22 (standalone, app.ts/app.html naming) + Angular Material; Supabase (Postgres, Auth, Storage, RLS); no separate backend (custom logic = Postgres RPC or Edge Functions). Hosting: frontend/vercel.json exists (SPA rewrite) but the live link he uses is https://ccis-lms.pages.dev (looks like Cloudflare Pages; which host auto-deploys is UNVERIFIED). Offline demo = Docker + local Supabase + built Angular (environment.local.ts), later.
Repo: frontend/, backend/ (Supabase CLI), docs/, .github/ (PR template + keep-alive workflow). All schema changes are NEW migration files in backend/supabase/migrations/; never click schema in the dashboard, never edit an applied migration. One-off DATA fixes via SQL Editor are fine.
Auth: EMAIL + PASSWORD ONLY (no Google sign-in). Domains enforced by DB trigger: students @iskolarngbayan.pup.edu.ph, staff @pup.edu.ph. Role in profiles.role (default student; admin approves teachers; users cannot promote themselves). Login dropdown only picks the domain suffix (demouser needs "Teacher"). Role checks in Angular guards and RLS. homeFor(): teacher -> /courses, admin -> /admin, student -> /dashboard.
Secrets: URL and anon key are committed in frontend/src/environments/. Never commit service_role or DB password.

## 5. Status (Nov 24)

Main HEAD in the clone was b31a997; the restyle below is applied locally by him and may not be pushed yet. Verify: `cd /home/claude/lms/repo && git log --oneline -5; ls backend/supabase/migrations; ls frontend/src/app/core/services`.
REAL in Supabase (all working): auth + profiles (avatar), courses, sections (join_code), enrollments, announcements + comments, materials with file attachments, activities, submissions, grading, topics, sign-up (staff request teacher access), admin pending-teacher page, teacher grades table. Test data: course ITEC 101 / Systems Integration and Architecture, section BSIT 3-1, code 2D92B0; accounts demouser@pup.edu.ph (teacher, shows as "Rodel V"), migelhtan@iskolarngbayan.pup.edu.ph (student). Never record passwords.
NOT in the app: forgot-password / reset link (only change-password in /settings).
DESIGN TARGET = the student maroon shell: flat #800000 sidebar (icon rail by default, menu button opens it), warm off-white page bg, white panels with 1px border (var(--mat-sys-outline-variant)) and header rule, count badge (maroon pill), grid-line panel body, maroon pill buttons (mat-flat-button / mat-stroked-button + mat-icon), banners from sectionDesign(id) in frontend\src\app\features\dashboard\section-design.ts (8 warm colours + 5 plaid patterns), page width `.page {max-width:1100px; margin:0 auto}` with no per-page padding (shell .content gives 24px), focus ring gold #e8b84a, Roboto/Material icons (mat-icon), no serif font, no coral/peach.
TEACHER RESTYLE PROGRESS (each page uses the pattern above):

- DONE step 1: /courses (frontend\src\app\features\courses\dashboard\dashboard.component.{ts,html,scss}) now inside the shell: header band, "My courses" panel, 340px course cards (banner = cover image if set, else sectionDesign(course.id); old purple coverGradient is ignored), section rows with 4 icon links, Create section. His screenshot confirmed it looks right.
- DONE (delivered, screenshot NOT yet seen) step 2: section layout frontend\src\app\features\sections\section-layout\*: inside the shell, "My courses" back link, banner (sectionDesign(section id); keeps "Section code" + Change cover, cover still localStorage per browser), pill tabs Stream/Classwork/Grades/People (maroon active pill), router-outlet. app.routes.ts: both `courses` and `section/:id` (with its 5 children) are now children of the shell route, guarded by roleGuard('teacher','admin'). Children read the id via route.parent, unchanged.
- Teacher sidebar (shell) shows "My courses"; the avatar links to /settings (so teachers have Settings now). A section list in the teacher sidebar (like the student ENROLLED list) was NOT built; optional later.
  Pages still in the OLD coral/serif style (their own padding and max-width): stream (800px, features\stream\stream), classwork, grades, people, submissions (features\sections\{classwork,grades,people,submissions}), and dialogs shared\{course-dialog,section-dialog,confirm-dialog}. activity-create/:sectionId and gradebook/:activityId were already in the shell (not yet checked for style).
  Leftover files: shared\styles_stripes.scss (coral stripes mixin) is likely unused now; shared\mock may be deletable (not verified). Fonts (Roboto, Poppins, icons) load from Google Fonts; the offline demo needs them self-hosted.

## 6. Next: continue the teacher restyle, one screen per step

First ask for / look at his screenshot of /section/:id/stream to confirm step 2 (fix anything broken before moving on). Then, in order (understand the files, say the plan briefly, implement on "go"; keep behaviour identical, only restyle): 3. Stream (features\stream\stream): drop 800px/2rem padding and coral; use white panels with header rule, maroon pill buttons, like the student stream/announcements panels (see features\dashboard\class-view for the look). 4. Classwork (also restyle its custom-lms-menu coral menu, defined in classwork.component.scss), 5. Grades, 6. People, 7. Submissions. 8. Dialogs (course, section, confirm) to the maroon style. Also check activity-create and gradebook styling. 9. Leftovers: delete unused \_stripes.scss and any dead coral assets/fonts once nothing uses them; confirm unseen student screens by screenshot (to-do, my grades, activity-submit); admin page styling.

SIDELINED (do not start unless he asks):

- Forgot-password flow. Default if asked: "Forgot password?" link on sign-in calling supabase.auth.resetPasswordForEmail, a reset-landing screen (updateUser), Site URL/redirect URLs in Supabase. Built-in email limit is only a few per hour; custom SMTP would be needed for 50 users.
- His LOCAL dev server once did not show the new login (live link did): likely stale `npm start`; restart it and hard-refresh.
- Ops: hosted Supabase settings (Site URL, redirect URLs, email confirmation, SMTP), confirm which host deploys. Offline demo (Docker local Supabase, environment.local.ts, self-hosted fonts, seeded users).
- Real PUP campus photos for the 3 login slides (his files, permission needed); dead `.divider` CSS in login.scss; real section cover column (now localStorage); first/last name columns instead of splitting full_name.

## 7. Known risks (state them, do not hide them)

- UI work is syntax-checked only; never compiled or viewed here. Ask for screenshots after each step. SQL is read-checked only.
- Straight-to-main with no review: a broken build goes live; he should run `ng build` first.
- Global tokens (colours in styles.scss) recolor shell screens: do not break student pages.
- Accounts: email confirmation OFF means anyone can claim any address in an allowed domain; ON depends on Supabase's low built-in email rate limit. Hosted Supabase settings are unverified.
- AuthService selects avatar_url: deploy only after migrations are applied. database.types.ts may be stale until regenerated.
- RLS notes: courses readable by every signed-in user; join_section has no throttle; deleting a course leaves storage files. Name parsing splits full_name on spaces (wrong for "dela Cruz").
- Snippets assume his local files equal what Claude delivered earlier; adjust if he edited them.
- Free tier: Supabase idle pausing (paused once; keep-alive workflow added, unverified), storage/upload caps unverified; recheck before any demo. Docker Desktop (WSL2) for the offline demo not confirmed.

## 8. Updating this file

Only when the conversation nears ~90% usage, he says it is ending, or he asks: update sections 5-7 only (plus section 2 if a rule changed), deliver the full file once as a downloadable .md (dense, under ~130 lines, drop stale detail), and remind him to commit it to the repo root and push to main so a fresh clone sees it.
