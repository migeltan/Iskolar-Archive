import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CoursesService, courseErrorMessage } from '../../../core/services/courses';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/confirm-dialog/confirm-dialog.component';
import {
  CourseDialogComponent,
  CourseFormData,
} from '../../../shared/course-dialog/course-dialog.component';
import { Course } from '../../../shared/models/lms.models';
import {
  SectionDialogComponent,
  SectionFormData,
} from '../../../shared/section-dialog/section-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, MatButtonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly coursesApi = inject(CoursesService);
  protected readonly auth = inject(AuthService);

  protected readonly courses = signal<Course[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly fullName = computed(() => {
    const profile = this.auth.profile();
    return profile?.full_name?.trim() || profile?.email || '';
  });

  protected readonly greeting = computed(() => {
    const name = this.auth.profile()?.full_name?.trim();
    if (!name) {
      return 'Welcome!';
    }
    const lastName = name.split(/\s+/).pop();
    return `Welcome, Prof. ${lastName}!`;
  });

  protected readonly avatarUrl = computed(
    () => this.auth.profile()?.avatar_url || '/assets/images/default-avatar.svg',
  );

  ngOnInit(): void {
    void this.load();
  }

  protected async logout(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigate(['/login']);
  }

  protected coverFor(course: Course): string {
    return course.coverImageUrl
      ? `center / cover no-repeat url("${course.coverImageUrl}")`
      : course.coverGradient;
  }

  protected async openAddCourse(): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<CourseDialogComponent, undefined, CourseFormData>(CourseDialogComponent, {
          width: '560px',
        })
        .afterClosed(),
    );
    if (!result) {
      return;
    }
    try {
      const { course, coverFailed } = await this.coursesApi.create(result);
      this.courses.update((list) => [...list, course]);
      if (coverFailed) {
        this.notify('Cover photo upload failed. The course was saved with a color instead.');
      }
    } catch (error) {
      this.notify(courseErrorMessage(error));
    }
  }

  protected async openEditCourse(course: Course): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<CourseDialogComponent, Course, CourseFormData>(CourseDialogComponent, {
          width: '560px',
          data: course,
        })
        .afterClosed(),
    );
    if (!result) {
      return;
    }
    try {
      const { course: saved, coverFailed } = await this.coursesApi.update(course, result);
      this.courses.update((list) => list.map((c) => (c.id === saved.id ? saved : c)));
      if (coverFailed) {
        this.notify('Cover photo upload failed. Your other changes were saved.');
      }
    } catch (error) {
      this.notify(courseErrorMessage(error));
    }
  }

  protected async createSection(course: Course): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<SectionDialogComponent, undefined, SectionFormData>(SectionDialogComponent, {
          width: '480px',
        })
        .afterClosed(),
    );
    if (!result) {
      return;
    }
    try {
      const section = await this.coursesApi.createSection(course.id, result.name);
      this.courses.update((list) =>
        list.map((c) => (c.id === course.id ? { ...c, sections: [...c.sections, section] } : c)),
      );
    } catch (error) {
      this.notify(courseErrorMessage(error));
    }
  }

  protected async confirmDelete(course: Course): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
          width: '560px',
          data: {
            message:
              'This action is permanent and cannot be undone. All data including materials, activities, and student grades will be permanently lost.',
          },
        })
        .afterClosed(),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.coursesApi.remove(course.id);
      this.courses.update((list) => list.filter((c) => c.id !== course.id));
    } catch (error) {
      this.notify(courseErrorMessage(error));
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      this.courses.set(await this.coursesApi.listMine());
    } catch (error) {
      this.loadError.set(courseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private notify(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
  }
}
