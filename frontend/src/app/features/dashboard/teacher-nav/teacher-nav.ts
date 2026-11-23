import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { filter, map } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CoursesService } from '../../../core/services/courses';
import { Course } from '../../../shared/models/lms.models';
import { Skeleton } from '../../skeleton/skeleton';
import { sectionDesign } from '../section-design';

/** Sidebar block for teachers: every course with its sections, one click from anywhere. */
@Component({
  selector: 'app-teacher-nav',
  imports: [RouterLink, MatIconModule, MatTooltipModule, Skeleton],
  templateUrl: './teacher-nav.html',
  styleUrl: './teacher-nav.scss',
  host: { '[class.collapsed]': 'collapsed()' },
})
export class TeacherNav {
  /** True while the sidebar is the icon-only rail. */
  collapsed = input(false);
  auth = inject(AuthService);
  private coursesApi = inject(CoursesService);
  private router = inject(Router);

  /** The filter box only shows up once the list gets long. */
  protected readonly filterMin = 8;

  courses = signal<Course[]>([]);
  loading = signal(true);
  query = signal('');
  design = sectionDesign;

  private needle = computed(() => this.query().trim().toLowerCase());

  /** Groups the teacher opened or closed by hand; they override the default. */
  private manual = signal<ReadonlyMap<string, boolean>>(new Map());

  private url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** The section that is open right now, read from /section/:id/... */
  activeSectionId = computed(() => /^\/section\/([^/?#]+)/.exec(this.url())?.[1] ?? null);

  private activeCourseId = computed(() => {
    const id = this.activeSectionId();
    return this.courses().find((course) => course.sections.some((s) => s.id === id))?.id ?? null;
  });

  /** Courses after the filter box. */
  visible = computed(() => {
    if (!this.needle()) {
      return this.courses();
    }
    return this.courses().filter(
      (course) => this.courseMatches(course) || course.sections.some((s) => this.has(s.name)),
    );
  });

  constructor() {
    // Reloads when the user changes or a course or section is added, edited or deleted.
    effect(() => {
      this.coursesApi.version();
      const id = this.auth.userId();
      const role = this.auth.role();
      if (!id || (role !== 'teacher' && role !== 'admin')) {
        this.courses.set([]);
        this.loading.set(false);
        return;
      }
      void this.coursesApi.listMine().then(
        (list) => {
          this.courses.set(list);
          this.loading.set(false);
        },
        () => this.loading.set(false),
      );
    });
  }

  /** The course is open when the teacher said so, when a filter is active, or when it holds the current section. */
  isOpen(course: Course): boolean {
    if (this.needle()) {
      return true;
    }
    return this.manual().get(course.id) ?? course.id === this.activeCourseId();
  }

  toggle(course: Course): void {
    const open = this.isOpen(course);
    this.manual.update((current) => new Map(current).set(course.id, !open));
  }

  sectionsOf(course: Course): Course['sections'] {
    if (!this.needle() || this.courseMatches(course)) {
      return course.sections;
    }
    return course.sections.filter((s) => this.has(s.name));
  }

  onFilter(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  private courseMatches(course: Course): boolean {
    return this.has(course.code) || this.has(course.title);
  }

  private has(text: string): boolean {
    return text.toLowerCase().includes(this.needle());
  }
}
