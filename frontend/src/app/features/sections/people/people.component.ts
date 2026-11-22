import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CoursesService, courseErrorMessage } from '../../../core/services/courses';
import { Student } from '../../../shared/models/lms.models';

const AVATAR_COLORS = ['#ffd9d5', '#f7d6e8', '#e3d9f5', '#ffe8c9', '#d8efe6'];

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [],
  templateUrl: './people.component.html',
  styleUrl: './people.component.scss',
})
export class PeopleComponent implements OnInit {
  private readonly coursesApi = inject(CoursesService);
  private readonly sectionId = inject(ActivatedRoute).parent?.snapshot.paramMap.get('id') ?? '';

  protected readonly sectionCode = signal('');
  protected readonly students = signal<Student[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly sortBy = signal<'lastName' | 'firstName'>('lastName');
  protected readonly ascending = signal(true);

  protected readonly sortedStudents = computed(() => {
    const direction = this.ascending() ? 1 : -1;
    const key = this.sortBy();

    return [...this.students()].sort((a, b) => {
      return direction * a[key].toLowerCase().localeCompare(b[key].toLowerCase());
    });
  });

  ngOnInit(): void {
    void this.load();
  }

  protected toggleSortOrder(): void {
    this.ascending.update((val) => !val);
  }

  protected toggleSortKey(): void {
    this.sortBy.update((key) => (key === 'lastName' ? 'firstName' : 'lastName'));
  }

  protected displayName(student: Student): string {
    if (this.sortBy() === 'lastName' && student.lastName) {
      return `${student.lastName}, ${student.firstName}`;
    }
    return `${student.firstName} ${student.lastName}`.trim();
  }

  protected initials(student: Student): string {
    return `${student.firstName.charAt(0)}${student.lastName.charAt(0)}`.toUpperCase();
  }

  protected avatarColor(index: number): string {
    return AVATAR_COLORS[index % AVATAR_COLORS.length];
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [section, students] = await Promise.all([
        this.coursesApi.getSection(this.sectionId),
        this.coursesApi.listStudents(this.sectionId),
      ]);
      this.sectionCode.set(section?.sectionCode ?? '');
      this.students.set(students);
    } catch (error) {
      this.loadError.set(courseErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
