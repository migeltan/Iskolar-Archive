import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../../shared/storage/storage.service';

export interface PendingTeacher {
  id: string;
  fullName: string;
  email: string;
  requestedAt: string;
}

interface PendingRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

/** Admin-only actions. RLS and the RPCs both enforce admin; the route guard is just UX. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** Staff-domain accounts waiting for approval, oldest first. */
  async listPendingTeachers(): Promise<PendingTeacher[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .eq('status', 'pending_teacher')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as PendingRow[]).map((r) => ({
      id: r.id,
      fullName: r.full_name ?? '',
      email: r.email ?? '',
      requestedAt: r.created_at,
    }));
  }

  async approve(userId: string): Promise<void> {
    if (!this.supabase) throw new Error('Approving teachers needs real sign-in.');
    const { error } = await this.supabase.rpc('approve_teacher', { p_user_id: userId });
    if (error) throw error;
  }

  async reject(userId: string): Promise<void> {
    if (!this.supabase) throw new Error('Rejecting teachers needs real sign-in.');
    const { error } = await this.supabase.rpc('reject_teacher', { p_user_id: userId });
    if (error) throw error;
  }
}
