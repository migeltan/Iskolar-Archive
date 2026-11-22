import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../../shared/storage/storage.service';

export interface StreamComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface StreamPost {
  id: string;
  body: string;
  createdAt: string;
  comments: StreamComment[];
}

interface CommentRow {
  id: string;
  author_id: string;
  author_name: string | null;
  body: string;
  created_at: string;
}

interface PostRow {
  id: string;
  body: string;
  created_at: string;
  announcement_comments: CommentRow[] | null;
}

interface TeacherRow {
  full_name: string | null;
  email: string | null;
}

const COMMENT_COLUMNS = 'id, author_id, author_name, body, created_at';
const POST_COLUMNS = `id, body, created_at, announcement_comments(${COMMENT_COLUMNS})`;

function toComment(row: CommentRow): StreamComment {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name?.trim() || 'Unknown',
    body: row.body,
    createdAt: row.created_at,
  };
}

function toPost(row: PostRow): StreamPost {
  const comments = [...(row.announcement_comments ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    comments: comments.map(toComment),
  };
}

/** Section announcements (the stream) and their comments. RLS decides who can read and write. */
@Injectable({ providedIn: 'root' })
export class Announcements {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** Newest post first; each post's comments oldest first. */
  async list(sectionId: string): Promise<StreamPost[]> {
    const { data, error } = await this.supabase
      .from('announcements')
      .select(POST_COLUMNS)
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as unknown as PostRow[]).map(toPost);
  }

  /** Only the section's teacher passes RLS. */
  async post(sectionId: string, body: string): Promise<StreamPost> {
    const { data, error } = await this.supabase
      .from('announcements')
      .insert({ section_id: sectionId, body: body.trim() })
      .select(POST_COLUMNS)
      .single();
    if (error) throw error;
    return toPost(data as unknown as PostRow);
  }

  async removePost(id: string): Promise<void> {
    // .select() shows a delete that RLS silently blocked as an empty result.
    const { data, error } = await this.supabase
      .from('announcements')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Could not delete the post.');
  }

  /** The signed-in user is the author (the column defaults to auth.uid()). */
  async addComment(announcementId: string, body: string): Promise<StreamComment> {
    const { data, error } = await this.supabase
      .from('announcement_comments')
      .insert({ announcement_id: announcementId, body: body.trim() })
      .select(COMMENT_COLUMNS)
      .single();
    if (error) throw error;
    return toComment(data as unknown as CommentRow);
  }

  async removeComment(id: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('announcement_comments')
      .delete()
      .eq('id', id)
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Could not delete the comment.');
  }

  /** Name shown as the author of every post: the section's teacher. */
  async teacherName(sectionId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('sections')
      .select('teacher:profiles!teacher_id(full_name, email)')
      .eq('id', sectionId)
      .maybeSingle();
    if (error || !data) return 'Teacher';
    const raw = (data as unknown as { teacher: TeacherRow | TeacherRow[] | null }).teacher;
    const teacher = Array.isArray(raw) ? raw[0] : raw;
    return teacher?.full_name?.trim() || teacher?.email || 'Teacher';
  }
}
