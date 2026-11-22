import { Routes } from '@angular/router';
import { authGuard, homeGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // 1. LOGIN
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },

  // 2. NICOLE'S TEACHER DASHBOARD (Full Screen - No Shell)
  {
    path: 'courses',
    canActivate: [authGuard, roleGuard('teacher', 'admin')],
    loadComponent: () =>
      import('./features/courses/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },

  // 3. NICOLE'S SECTION LAYOUT (Full Screen - No Shell)
  {
    path: 'section/:id',
    canActivate: [authGuard, roleGuard('teacher', 'admin')],
    loadComponent: () =>
      import('./features/sections/section-layout/section-layout.component').then(
        (m) => m.SectionLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'stream' },
      {
        path: 'stream',
        loadComponent: () =>
          import('./features/stream/stream/stream.component').then((m) => m.StreamComponent),
      },
      {
        path: 'classwork',
        loadComponent: () =>
          import('./features/sections/classwork/classwork.component').then(
            (m) => m.ClassworkComponent,
          ),
      },
      {
        path: 'submissions/:activityId',
        loadComponent: () =>
          import('./features/sections/submissions/submissions.component').then(
            (m) => m.SubmissionsComponent,
          ),
      },
      {
        path: 'grades',
        loadComponent: () =>
          import('./features/sections/grades/grades.component').then((m) => m.GradesComponent),
      },
      {
        path: 'people',
        loadComponent: () =>
          import('./features/sections/people/people.component').then((m) => m.PeopleComponent),
      },
    ],
  },

  // 4. GWEN'S SHELL (Student & Admin only)
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layout/shell/shell').then((m) => m.Shell),
    children: [
      // "/" (and the "**" fallback) goes to the signed-in user's own home.
      { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },

      // ---- Student side (Gwen) ----
      {
        path: 'dashboard',
        canActivate: [roleGuard('student')],
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'class/:sectionId',
        canActivate: [roleGuard('student')],
        loadComponent: () =>
          import('./features/dashboard/class-view/class-view').then((m) => m.ClassView),
      },
      {
        path: 'activity-submit/:activityId',
        canActivate: [roleGuard('student')],
        loadComponent: () =>
          import('./features/classwork/activities/activity-submit/activity-submit').then(
            (m) => m.ActivitySubmit,
          ),
      },
      {
        path: 'my-grades',
        canActivate: [roleGuard('student')],
        loadComponent: () =>
          import('./features/grades/my-grades/my-grades').then((m) => m.MyGrades),
      },
      {
        path: 'activity-create/:sectionId',
        canActivate: [roleGuard('teacher', 'admin')],
        loadComponent: () =>
          import('./features/classwork/activities/activity-create/activity-create').then(
            (m) => m.ActivityCreate,
          ),
      },
      {
        path: 'gradebook/:activityId',
        canActivate: [roleGuard('teacher', 'admin')],
        loadComponent: () =>
          import('./features/grades/gradebook/gradebook').then((m) => m.Gradebook),
      },
      {
        path: 'todo',
        canActivate: [roleGuard('student')],
        loadComponent: () => import('./features/todo/todo').then((m) => m.Todo),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
      },
      {
        path: 'class/:sectionId/work',
        canActivate: [roleGuard('student')],
        loadComponent: () =>
          import('./features/grades/my-grades/my-grades').then((m) => m.MyGrades),
      },

      // ---- Admin ----
      {
        path: 'admin',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/admin/admin-users/admin-users').then((m) => m.AdminUsers),
      },
    ],
  },

  // 5. WILDCARD
  { path: '**', redirectTo: '' },
];
