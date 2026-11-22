import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, defer, from, of } from 'rxjs';
import { SUPABASE_CLIENT } from '../../shared/storage/storage.service';
import { MySection } from '../models/classwork.models';

interface CourseJoin {
  code: string;
  title: string;
}

interface SectionJoin {
  id: string;
  course_id: string;
  teacher_id: string;
  name: string;
  join_code: string;
  term: string | null;
  created_at: string;
  courses: CourseJoin | CourseJoin[] | null;
}

interface EnrollmentRow {
  joined_at: string;
  sections: SectionJoin | SectionJoin[] | null;
}

/** PostgREST returns a to-one relation as an object, but be safe if it is an array. */
function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

@Injectable({ providedIn: 'root' })
export class Enrollments {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** Goes up every time a student joins a class, so the sidebar knows to reload. */
  readonly version = signal(0);

  /** The student's sections in the order they joined. RLS limits rows to their own. */
  listMySections(studentId: string): Observable<MySection[]> {
    if (!studentId) {
      return of([]);
    }
    return defer(() => from(this.fetchMySections(studentId))).pipe(
      catchError((error) => {
        console.error('Could not load your sections', error);
        return of([] as MySection[]);
      }),
    );
  }

  /** Calls the join_section(p_code) RPC and returns the section id. Errors if the code is wrong. */
  joinSection(_studentId: string, code: string): Observable<string> {
    return defer(() => from(this.join(code)));
  }

  private async fetchMySections(studentId: string): Promise<MySection[]> {
    const { data, error } = await this.supabase
      .from('enrollments')
      .select(
        'joined_at, sections(id, course_id, teacher_id, name, join_code, term, created_at, courses(code, title))',
      )
      .eq('student_id', studentId)
      .order('joined_at', { ascending: true });
    if (error) {
      throw error;
    }
    return (data as unknown as EnrollmentRow[]).flatMap((row): MySection[] => {
      const section = first(row.sections);
      if (!section) {
        return [];
      }
      const course = first(section.courses);
      return [
        {
          id: section.id,
          course_id: section.course_id,
          teacher_id: section.teacher_id,
          name: section.name,
          join_code: section.join_code,
          term: section.term,
          created_at: section.created_at,
          course_code: course?.code ?? '',
          course_title: course?.title ?? '',
        },
      ];
    });
  }

  private async join(code: string): Promise<string> {
    const { data, error } = await this.supabase.rpc('join_section', { p_code: code.trim() });
    if (error) {
      throw error;
    }
    this.version.update((v) => v + 1);
    return data as string;
  }
}
