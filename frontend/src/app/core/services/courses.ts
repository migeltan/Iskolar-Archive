import { Injectable, inject } from '@angular/core';
import { Course, Section, Student } from '../../shared/models/lms.models';
import { SUPABASE_CLIENT, StorageService } from '../../shared/storage/storage.service';
import { AuthService } from '../auth/auth.service';

export const DEFAULT_COVER_GRADIENT = 'linear-gradient(135deg, #8a82c0, #5d4f9e)';

export interface CourseInput {
  code: string;
  title: string;
  coverGradient: string;
  coverFile: File | null;
  /** True when the teacher picked a color, so any existing photo should go. */
  removePhoto: boolean;
}

export interface CourseSaveResult {
  course: Course;
  /** The course was saved but the cover photo could not be uploaded. */
  coverFailed: boolean;
}

interface SectionRow {
  id: string;
  course_id: string;
  name: string;
  join_code: string;
  created_at?: string;
}

interface CourseRow {
  id: string;
  code: string;
  title: string;
  cover_gradient: string | null;
  cover_url: string | null;
  sections: SectionRow[] | null;
}

const SECTION_COLUMNS = 'id, course_id, name, join_code, created_at';
const COURSE_COLUMNS = `id, code, title, cover_gradient, cover_url, sections(${SECTION_COLUMNS})`;

function toSection(row: SectionRow): Section {
  return { id: row.id, courseId: row.course_id, name: row.name, sectionCode: row.join_code };
}

function toCourse(row: CourseRow): Course {
  const sections = [...(row.sections ?? [])].sort((a, b) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  );
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    coverGradient: row.cover_gradient ?? DEFAULT_COVER_GRADIENT,
    coverImageUrl: row.cover_url ?? undefined,
    sections: sections.map(toSection),
  };
}

interface ProfileName {
  full_name: string | null;
  email: string | null;
}

interface EnrollmentStudentRow {
  student_id: string;
  profiles: ProfileName | ProfileName[] | null;
}

function toStudent(row: EnrollmentStudentRow, sectionId: string): Student {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const fullName = profile?.full_name?.trim() || profile?.email?.split('@')[0] || 'Student';
  const parts = fullName.split(/\s+/);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
  const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : fullName;
  return { id: row.student_id, sectionId, firstName, lastName };
}

/** Turns a Supabase/Postgres error into a sentence a teacher can read. */
export function courseErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === '23505') {
    return 'You already have a course with that code.';
  }
  if (e?.code === '42501') {
    return 'You do not have permission to do that.';
  }
  return e?.message || 'Something went wrong. Please try again.';
}

@Injectable({ providedIn: 'root' })
export class CoursesService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly storage = inject(StorageService);
  private readonly auth = inject(AuthService);

  /** The signed-in teacher's own courses, each with its sections. */
  async listMine(): Promise<Course[]> {
    const { data, error } = await this.supabase
      .from('courses')
      .select(COURSE_COLUMNS)
      .eq('owner_id', this.requireUserId())
      .order('created_at', { ascending: true });
    if (error) {
      throw error;
    }
    return (data as unknown as CourseRow[]).map(toCourse);
  }

  async create(input: CourseInput): Promise<CourseSaveResult> {
    const { data, error } = await this.supabase
      .from('courses')
      .insert({
        owner_id: this.requireUserId(),
        code: input.code,
        title: input.title,
        cover_gradient: input.coverGradient,
      })
      .select(COURSE_COLUMNS)
      .single();
    if (error) {
      throw error;
    }
    let course = toCourse(data as unknown as CourseRow);
    let coverFailed = false;
    if (input.coverFile) {
      try {
        course = { ...course, coverImageUrl: await this.saveCover(course.id, input.coverFile) };
      } catch {
        coverFailed = true;
      }
    }
    return { course, coverFailed };
  }

  async update(course: Course, input: CourseInput): Promise<CourseSaveResult> {
    const dropPhoto = input.removePhoto && !input.coverFile;
    const patch: Record<string, unknown> = {
      code: input.code,
      title: input.title,
      cover_gradient: input.coverGradient,
    };
    if (dropPhoto) {
      patch['cover_url'] = null;
    }
    const { data, error } = await this.supabase
      .from('courses')
      .update(patch)
      .eq('id', course.id)
      .select('id');
    if (error) {
      throw error;
    }
    if (!data || data.length === 0) {
      throw new Error('You can only edit your own courses.');
    }
    let saved: Course = {
      ...course,
      code: input.code,
      title: input.title,
      coverGradient: input.coverGradient,
      coverImageUrl: dropPhoto ? undefined : course.coverImageUrl,
    };
    let coverFailed = false;
    if (input.coverFile) {
      try {
        saved = { ...saved, coverImageUrl: await this.saveCover(course.id, input.coverFile) };
      } catch {
        coverFailed = true;
      }
    }
    return { course: saved, coverFailed };
  }

  /** Deletes the course and, through ON DELETE CASCADE, everything under it. */
  async remove(courseId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('courses')
      .delete()
      .eq('id', courseId)
      .select('id');
    if (error) {
      throw error;
    }
    if (!data || data.length === 0) {
      throw new Error('You can only delete your own courses.');
    }
  }

  /** The database issues the join code. */
  async createSection(courseId: string, name: string): Promise<Section> {
    const { data, error } = await this.supabase
      .from('sections')
      .insert({ course_id: courseId, teacher_id: this.requireUserId(), name })
      .select(SECTION_COLUMNS)
      .single();
    if (error) {
      throw error;
    }
    return toSection(data as unknown as SectionRow);
  }

  /** One section by id, or undefined when it does not exist or is not visible to you. */
  async getSection(sectionId: string): Promise<Section | undefined> {
    const { data, error } = await this.supabase
      .from('sections')
      .select(SECTION_COLUMNS)
      .eq('id', sectionId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data ? toSection(data as unknown as SectionRow) : undefined;
  }

  /** Students enrolled in a section. The teacher can read these rows and profiles through RLS. */
  async listStudents(sectionId: string): Promise<Student[]> {
    const { data, error } = await this.supabase
      .from('enrollments')
      .select('student_id, profiles(full_name, email)')
      .eq('section_id', sectionId);
    if (error) {
      throw error;
    }
    return (data as unknown as EnrollmentStudentRow[]).map((row) => toStudent(row, sectionId));
  }

  private async saveCover(courseId: string, file: File): Promise<string> {
    const url = await this.storage.uploadCourseCover(courseId, file);
    const { error } = await this.supabase
      .from('courses')
      .update({ cover_url: url })
      .eq('id', courseId);
    if (error) {
      throw error;
    }
    return url;
  }

  private requireUserId(): string {
    const id = this.auth.userId();
    if (!id) {
      throw new Error('You are not signed in.');
    }
    return id;
  }
}
