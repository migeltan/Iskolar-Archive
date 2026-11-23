import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SUPABASE_CLIENT } from '../../shared/storage/storage.service';
import {
  Attachment,
  GradebookRow,
  NewSubmission,
  SubmissionWithFiles,
} from '../models/classwork.models';

const WITH_FILES = '*, attachments(*)';
const WITH_FILES_AND_NAME = '*, attachments(*), student:profiles!student_id(full_name, email)';

interface NameRow {
  full_name: string | null;
  email: string | null;
}

type RowWithName = SubmissionWithFiles & { student: NameRow | NameRow[] | null };

/**
 * A row the teacher made so a student could be graded without ever submitting
 * (submitted_at is null). The student only sees it once the grade is released.
 */
function visibleToStudent(s: SubmissionWithFiles): boolean {
  return s.submitted_at !== null || s.grade_released;
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_');
}

/** Submissions and grades. RLS limits a student to their own rows and a teacher to their sections. */
@Injectable({ providedIn: 'root' })
export class Submissions {
  private readonly supabase = inject(SUPABASE_CLIENT);

  getMine(activityId: string, studentId: string): Observable<SubmissionWithFiles | undefined> {
    return defer(() => from(this.fetchMine(activityId, studentId)));
  }

  /** Teacher: every submission of one activity, with the student's name. */
  listByActivity(activityId: string): Observable<GradebookRow[]> {
    return defer(() => from(this.fetchByActivity(activityId)));
  }

  listByStudent(studentId: string): Observable<SubmissionWithFiles[]> {
    return defer(() => from(this.fetchByStudent(studentId)));
  }

  submit(input: NewSubmission): Observable<SubmissionWithFiles> {
    return defer(() => from(this.doSubmit(input)));
  }

  /** Teacher: save score + feedback on an existing submission. */
  updateGrade(
    id: string,
    score: number,
    feedback: string,
    release: boolean,
  ): Observable<SubmissionWithFiles> {
    return defer(() => from(this.doUpdateGrade(id, score, feedback, release)));
  }

  /** Teacher: grade a student, creating the row first when they never submitted. */
  grade(
    activityId: string,
    studentId: string,
    score: number,
    feedback: string,
    release: boolean,
  ): Observable<SubmissionWithFiles> {
    return defer(() => from(this.doGrade(activityId, studentId, score, feedback, release)));
  }

  /** A temporary link (1 hour) to a submitted file. */
  async fileUrl(file: Attachment): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('submissions')
      .createSignedUrl(file.storage_path, 3600);
    if (error) throw error;
    return data.signedUrl;
  }

  // ---------- Reads ----------

  private async fetchMine(
    activityId: string,
    studentId: string,
  ): Promise<SubmissionWithFiles | undefined> {
    const { data, error } = await this.supabase
      .from('submissions')
      .select(WITH_FILES)
      .eq('activity_id', activityId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (error) throw error;
    const row = data as unknown as SubmissionWithFiles | null;
    return row && visibleToStudent(row) ? row : undefined;
  }

  private async fetchByActivity(activityId: string): Promise<GradebookRow[]> {
    const { data, error } = await this.supabase
      .from('submissions')
      .select(WITH_FILES_AND_NAME)
      .eq('activity_id', activityId);
    if (error) throw error;
    return (data as unknown as RowWithName[]).map(({ student, ...row }) => {
      const profile = Array.isArray(student) ? student[0] : student;
      return {
        ...row,
        student_name: profile?.full_name?.trim() || profile?.email || null,
      };
    });
  }

  private async fetchByStudent(studentId: string): Promise<SubmissionWithFiles[]> {
    if (!studentId) return [];
    const { data, error } = await this.supabase
      .from('submissions')
      .select(WITH_FILES)
      .eq('student_id', studentId);
    if (error) throw error;
    return (data as unknown as SubmissionWithFiles[]).filter(visibleToStudent);
  }

  private async fetchById(id: string): Promise<SubmissionWithFiles> {
    const { data, error } = await this.supabase
      .from('submissions')
      .select(WITH_FILES)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as unknown as SubmissionWithFiles;
  }

  // ---------- Student: submit ----------

  private async doSubmit(input: NewSubmission): Promise<SubmissionWithFiles> {
    // Look for any row, even a hidden teacher-made one: there is one row per student and activity.
    const found = await this.supabase
      .from('submissions')
      .select('id, attachments(*)')
      .eq('activity_id', input.activityId)
      .eq('student_id', input.studentId)
      .maybeSingle();
    if (found.error) throw found.error;
    const existing = found.data as unknown as { id: string; attachments: Attachment[] } | null;

    // submitted_at and the status rules are enforced by a database trigger, not sent from here.
    const fields = { answer_text: input.answerText, status: 'submitted' };
    let id: string;
    if (existing) {
      const { error } = await this.supabase
        .from('submissions')
        .update(fields)
        .eq('id', existing.id);
      if (error) throw error;
      id = existing.id;
    } else {
      const { data, error } = await this.supabase
        .from('submissions')
        .insert({ activity_id: input.activityId, student_id: input.studentId, ...fields })
        .select('id')
        .single();
      if (error) throw error;
      id = (data as unknown as { id: string }).id;
    }

    if (input.file) {
      try {
        await this.replaceFile(id, existing?.attachments ?? [], input);
      } catch (err) {
        // Do not leave an empty submission behind when this was the first attempt.
        if (!existing) await this.supabase.from('submissions').delete().eq('id', id);
        throw err;
      }
    }
    return this.fetchById(id);
  }

  /** Uploads the new file, then removes the old ones (so a failed upload loses nothing). */
  private async replaceFile(
    submissionId: string,
    old: Attachment[],
    input: NewSubmission,
  ): Promise<void> {
    const file = input.file!;
    const path = `${input.sectionId}/${input.studentId}/${Date.now()}_${safeName(file.name)}`;
    const upload = await this.supabase.storage.from('submissions').upload(path, file);
    if (upload.error) throw upload.error;

    const inserted = await this.supabase
      .from('attachments')
      .insert({ submission_id: submissionId, storage_path: path, file_name: file.name });
    if (inserted.error) {
      await this.supabase.storage.from('submissions').remove([path]);
      throw inserted.error;
    }

    if (old.length) {
      const removed = await this.supabase
        .from('attachments')
        .delete()
        .in(
          'id',
          old.map((a) => a.id),
        );
      if (!removed.error) {
        await this.supabase.storage.from('submissions').remove(old.map((a) => a.storage_path));
      }
    }
  }

  // ---------- Teacher: grade ----------

  private async doUpdateGrade(
    id: string,
    score: number,
    feedback: string,
    release: boolean,
  ): Promise<SubmissionWithFiles> {
    const { data, error } = await this.supabase
      .from('submissions')
      .update({
        score,
        feedback: feedback.trim() || null,
        grade_released: release,
        status: 'graded',
      })
      .eq('id', id)
      .select(WITH_FILES)
      .single();
    if (error) throw error;
    return data as unknown as SubmissionWithFiles;
  }

  private async doGrade(
    activityId: string,
    studentId: string,
    score: number,
    feedback: string,
    release: boolean,
  ): Promise<SubmissionWithFiles> {
    const found = await this.supabase
      .from('submissions')
      .select('id')
      .eq('activity_id', activityId)
      .eq('student_id', studentId)
      .maybeSingle();
    if (found.error) throw found.error;
    const existing = found.data as unknown as { id: string } | null;
    if (existing) {
      return this.doUpdateGrade(existing.id, score, feedback, release);
    }

    const { data, error } = await this.supabase
      .from('submissions')
      .insert({
        activity_id: activityId,
        student_id: studentId,
        score,
        feedback: feedback.trim() || null,
        grade_released: release,
        status: 'graded',
      })
      .select(WITH_FILES)
      .single();
    if (error) throw error;
    return data as unknown as SubmissionWithFiles;
  }
}
