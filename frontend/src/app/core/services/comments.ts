import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SUPABASE_CLIENT } from '../../shared/storage/storage.service';

/** A private message between one student and the section's teacher, about one activity. */
export interface ActivityComment {
  id: string;
  activity_id: string;
  student_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

export interface NewComment {
  activityId: string;
  /** Whose thread this is. A student writes to their own, a teacher to the student they pick. */
  studentId: string;
  body: string;
}

interface CommentRow {
  id: string;
  activity_id: string;
  student_id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

const COLUMNS = 'id, activity_id, student_id, author_id, author_name, body, created_at';

function toComment(row: CommentRow): ActivityComment {
  return { ...row, author_name: row.author_name?.trim() || 'Unknown' };
}

@Injectable({ providedIn: 'root' })
export class Comments {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** Oldest first. RLS only lets that student and the section's teacher read it. */
  listForStudent(activityId: string, studentId: string): Observable<ActivityComment[]> {
    return defer(() => from(this.fetch(activityId, studentId)));
  }

  /** The author (auth.uid()) and the author's name are filled in by the database. */
  add(input: NewComment): Observable<ActivityComment> {
    return defer(() => from(this.insert(input)));
  }

  private async fetch(activityId: string, studentId: string): Promise<ActivityComment[]> {
    if (!studentId) return [];
    const { data, error } = await this.supabase
      .from('activity_comments')
      .select(COLUMNS)
      .eq('activity_id', activityId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as unknown as CommentRow[]).map(toComment);
  }

  private async insert(input: NewComment): Promise<ActivityComment> {
    const { data, error } = await this.supabase
      .from('activity_comments')
      .insert({
        activity_id: input.activityId,
        student_id: input.studentId,
        body: input.body.trim(),
      })
      .select(COLUMNS)
      .single();
    if (error) throw error;
    return toComment(data as unknown as CommentRow);
  }
}
