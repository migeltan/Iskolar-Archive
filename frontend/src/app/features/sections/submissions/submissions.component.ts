import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Activity, Attachment, SubmissionWithFiles } from '../../../core/models/classwork.models';
import { Activities } from '../../../core/services/activities';
import { ActivityComment, Comments } from '../../../core/services/comments';
import { CoursesService } from '../../../core/services/courses';
import { Submissions } from '../../../core/services/submissions';
import { Student } from '../../../shared/models/lms.models';

type RosterStatus = 'Graded' | 'Turned In' | 'Pending';

@Component({
  selector: 'app-submissions',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatButtonModule],
  templateUrl: './submissions.component.html',
  styleUrl: './submissions.component.scss',
})
export class SubmissionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly activities = inject(Activities);
  private readonly courses = inject(CoursesService);
  private readonly submissions = inject(Submissions);
  private readonly commentsService = inject(Comments);

  protected readonly sectionId = this.route.parent?.snapshot.paramMap.get('id') ?? '';
  private readonly activityId = this.route.snapshot.paramMap.get('activityId') ?? '';

  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly activity = signal<Activity | undefined>(undefined);
  protected readonly sectionCode = signal('------');
  private readonly students = signal<Student[]>([]);
  // Submissions by student id
  private readonly rows = signal<Record<string, SubmissionWithFiles>>({});

  protected readonly ascending = signal(true);
  private readonly selectedId = signal<string | null>(null);
  protected readonly comments = signal<ActivityComment[]>([]);
  protected readonly commentDraft = new FormControl('', { nonNullable: true });
  protected readonly saveError = signal('');

  protected readonly sortedStudents = computed(() => {
    const direction = this.ascending() ? 1 : -1;
    return [...this.students()].sort(
      (a, b) =>
        direction *
        (a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)),
    );
  });

  protected readonly selected = computed<Student | undefined>(() => {
    const sorted = this.sortedStudents();
    return sorted.find((s) => s.id === this.selectedId()) ?? sorted[0];
  });

  protected readonly selectedRow = computed<SubmissionWithFiles | undefined>(() => {
    const student = this.selected();
    return student ? this.rows()[student.id] : undefined;
  });

  /** Students who actually handed something in (teacher-made grade rows do not count). */
  protected readonly submittedCount = computed(
    () => this.students().filter((s) => !!this.rows()[s.id]?.submitted_at).length,
  );
  protected readonly pendingCount = computed(() => this.students().length - this.submittedCount());

  protected initials(student: Student): string {
    return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
  }

  ngOnInit(): void {
    void this.load();
  }
  private async load(): Promise<void> {
    try {
      const [activity, students, section, subs] = await Promise.all([
        firstValueFrom(this.activities.getById(this.activityId)),
        this.courses.listStudents(this.sectionId),
        this.courses.getSection(this.sectionId),
        firstValueFrom(this.submissions.listByActivity(this.activityId)),
      ]);
      // An activity from another section does not belong on this page.
      this.activity.set(activity?.section_id === this.sectionId ? activity : undefined);
      this.students.set(students);
      this.sectionCode.set(section?.sectionCode ?? '------');
      this.rows.set(Object.fromEntries(subs.map((s) => [s.student_id, s])));
      await this.loadComments();
    } catch (err) {
      console.error('Could not load submissions', err);
      this.loadError.set('Could not load submissions. Check your connection and reload.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadComments(): Promise<void> {
    const student = this.selected();
    if (!student) {
      this.comments.set([]);
      return;
    }
    try {
      const list = await firstValueFrom(
        this.commentsService.listForStudent(this.activityId, student.id),
      );
      // Ignore the answer if the teacher already picked someone else.
      if (this.selected()?.id === student.id) this.comments.set(list);
    } catch (err) {
      console.error('Could not load comments', err);
      this.comments.set([]);
    }
  }

  protected statusOf(student: Student): RosterStatus {
    const row = this.rows()[student.id];
    if (!row) return 'Pending';
    if (row.status === 'graded') return 'Graded';
    return row.submitted_at ? 'Turned In' : 'Pending';
  }

  protected scoreOf(student: Student): number | null {
    return this.rows()[student.id]?.score ?? null;
  }

  /** Late is only a label: the work came in after the due date. */
  protected isLate(row: SubmissionWithFiles): boolean {
    const due = this.activity()?.due_at;
    return !!due && !!row.submitted_at && new Date(row.submitted_at) > new Date(due);
  }

  protected toggleSort(): void {
    this.ascending.update((value) => !value);
  }

  protected select(student: Student): void {
    this.selectedId.set(student.id);
    this.commentDraft.reset();
    this.saveError.set('');
    this.comments.set([]);
    void this.loadComments();
  }

  /** Saves the score when the teacher leaves the box. A student with no row gets one made. */
  protected async setScore(student: Student, event: Event): Promise<void> {
    const activity = this.activity();
    if (!activity) return;
    const input = event.target as HTMLInputElement;
    const row = this.rows()[student.id];
    this.saveError.set('');

    if (input.value.trim() === '') {
      input.value = row?.score !== null && row?.score !== undefined ? String(row.score) : '';
      return;
    }
    const parsed = Number(input.value);
    if (Number.isNaN(parsed)) {
      input.value = row?.score !== null && row?.score !== undefined ? String(row.score) : '';
      this.saveError.set('Enter a number.');
      return;
    }
    const score = Math.min(Math.max(parsed, 0), activity.points);
    input.value = String(score);
    if (row?.score === score) return;

    // First grading releases it to the student; later edits keep whatever was chosen before.
    const release = !row || row.score === null ? true : row.grade_released;
    try {
      const saved = await firstValueFrom(
        this.submissions.grade(activity.id, student.id, score, row?.feedback ?? '', release),
      );
      this.rows.update((r) => ({ ...r, [student.id]: saved }));
    } catch (err) {
      console.error('Could not save the grade', err);
      this.saveError.set('Could not save the grade. Try again.');
      input.value = row?.score !== null && row?.score !== undefined ? String(row.score) : '';
    }
  }

  protected async openFile(file: Attachment): Promise<void> {
    try {
      window.open(await this.submissions.fileUrl(file), '_blank', 'noopener');
    } catch {
      this.snackBar.open('Could not open the file. Try again.', 'Dismiss', { duration: 5000 });
    }
  }

  protected async addComment(): Promise<void> {
    const student = this.selected();
    const body = this.commentDraft.value.trim();
    if (!student || !body) return;
    try {
      const comment = await firstValueFrom(
        this.commentsService.add({ activityId: this.activityId, studentId: student.id, body }),
      );
      if (this.selected()?.id === student.id) this.comments.update((list) => [...list, comment]);
      this.commentDraft.reset();
    } catch (err) {
      console.error('Could not post the comment', err);
      this.snackBar.open('Could not post the comment. Try again.', 'Dismiss', { duration: 5000 });
    }
  }
}
