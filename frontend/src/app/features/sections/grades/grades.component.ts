import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Activity, Submission } from '../../../core/models/classwork.models';
import { Activities } from '../../../core/services/activities';
import { CoursesService } from '../../../core/services/courses';
import { Submissions } from '../../../core/services/submissions';
import { Student } from '../../../shared/models/lms.models';

@Component({
  selector: 'app-grades',
  standalone: true,
  imports: [CommonModule, MatTableModule],
  templateUrl: './grades.component.html',
  styleUrl: './grades.component.scss',
})
export class GradesComponent implements OnInit {
  private readonly snackBar = inject(MatSnackBar);
  private readonly courses = inject(CoursesService);
  private readonly activitiesService = inject(Activities);
  private readonly submissions = inject(Submissions);

  private readonly sectionId = inject(ActivatedRoute).parent?.snapshot.paramMap.get('id') ?? '';

  protected readonly sectionCode = signal('');
  protected readonly students = signal<Student[]>([]);
  protected readonly activities = signal<Activity[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal('');
  protected readonly saveError = signal('');

  // one submission per student and activity, keyed "studentId:activityId"
  private readonly rows = signal<Record<string, Submission>>({});

  protected readonly displayedColumns = computed(() => [
    'student',
    ...this.activities().map((activity) => activity.id),
    'overall',
  ]);

  // true = score cells become inputs
  protected readonly editing = signal(false);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [students, section, activities, subs] = await Promise.all([
        this.courses.listStudents(this.sectionId),
        this.courses.getSection(this.sectionId),
        firstValueFrom(this.activitiesService.listBySection(this.sectionId)),
        firstValueFrom(this.submissions.listBySection(this.sectionId)),
      ]);
      this.sectionCode.set(section?.sectionCode ?? '');
      this.students.set(
        [...students].sort(
          (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName),
        ),
      );
      // oldest first, so columns read in the order they were given
      this.activities.set([...activities].reverse());
      this.rows.set(
        Object.fromEntries(subs.map((s) => [this.key(s.student_id, s.activity_id), s])),
      );
    } catch (err) {
      console.error('Could not load the grades', err);
      this.loadError.set('Could not load the grades. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected retry(): void {
    void this.load();
  }

  protected toggleEditing(): void {
    this.editing.update((v) => !v);
    this.saveError.set('');
  }

  private key(studentId: string, activityId: string): string {
    return `${studentId}:${activityId}`;
  }

  protected scoreFor(studentId: string, activityId: string): number | null {
    return this.rows()[this.key(studentId, activityId)]?.score ?? null;
  }

  protected statusFor(studentId: string, activityId: string): string {
    const row = this.rows()[this.key(studentId, activityId)];
    if (!row) return 'Pending';
    if (row.score !== null) return row.grade_released ? 'Graded' : 'Graded (hidden)';
    return row.submitted_at ? 'Turned In' : 'Pending';
  }

  protected overallFor(student: Student): number | null {
    let earned = 0;
    let possible = 0;
    for (const activity of this.activities()) {
      const score = this.scoreFor(student.id, activity.id);
      if (score === null || activity.points <= 0) continue;
      earned += score;
      possible += activity.points;
    }
    return possible === 0 ? null : Math.round((earned / possible) * 1000) / 10;
  }

  // Called when the teacher finishes typing a score
  protected async onScoreChange(student: Student, activity: Activity, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const current = this.rows()[this.key(student.id, activity.id)];
    const restore = () => {
      input.value = current?.score != null ? String(current.score) : '';
    };
    this.saveError.set('');

    const raw = input.value.trim();
    if (raw === '') {
      restore();
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      restore();
      this.saveError.set('Enter a number.');
      return;
    }
    // keep the score between 0 and the activity's points
    const score = Math.min(Math.max(parsed, 0), activity.points);
    input.value = String(score);
    if (current?.score === score) return;

    // First grading releases it to the student; later edits keep whatever was chosen before.
    const release = !current || current.score === null ? true : current.grade_released;
    try {
      const saved = await firstValueFrom(
        this.submissions.grade(activity.id, student.id, score, current?.feedback ?? '', release),
      );
      this.rows.update((r) => ({ ...r, [this.key(student.id, activity.id)]: saved }));
    } catch (err) {
      console.error('Could not save the grade', err);
      restore();
      this.saveError.set('Could not save the grade. Try again.');
    }
  }

  // --- EXPORT TO CSV ---
  protected exportCsv(): void {
    const activities = this.activities();
    const header = [
      'Last Name',
      'First Name',
      ...activities.map((a) => `${a.title} (${a.points} pts)`),
      'Overall %',
    ];

    const rows = this.students().map((student) => {
      const scores = activities.map((a) => {
        const score = this.scoreFor(student.id, a.id);
        return score === null ? '' : String(score);
      });
      const overall = this.overallFor(student);
      return [
        student.lastName,
        student.firstName,
        ...scores,
        overall === null ? '' : String(overall),
      ];
    });

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => this.csvCell(cell)).join(','))
      .join('\r\n');

    // the BOM makes Excel read accents correctly
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `grades-${this.sectionCode() || 'section'}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    this.snackBar.open('Grades exported.', 'Dismiss', { duration: 3000 });
  }

  private csvCell(value: string): string {
    // stops spreadsheet formula injection (cells starting with = + - @)
    const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  }
}
