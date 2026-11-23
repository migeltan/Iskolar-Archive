import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AdminService, PendingTeacher } from '../../../core/services/admin';

@Component({
  imports: [DatePipe, MatButtonModule],
  selector: 'app-admin-users',
  styleUrl: './admin-users.scss',
  templateUrl: './admin-users.html',
})
export class AdminUsers implements OnInit {
  private readonly admin = inject(AdminService);

  pending = signal<PendingTeacher[]>([]);
  loading = signal(true);
  loadError = signal('');
  /** Id of the row being approved/rejected, so only its buttons lock. */
  busyId = signal<string | null>(null);
  message = signal<{ ok: boolean; text: string } | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      this.pending.set(await this.admin.listPendingTeachers());
    } catch {
      this.loadError.set('Could not load teacher requests. Check your connection and try again.');
    } finally {
      this.loading.set(false);
    }
  }

  approve(t: PendingTeacher): Promise<void> {
    return this.act(t, 'approve');
  }

  reject(t: PendingTeacher): Promise<void> {
    return this.act(t, 'reject');
  }

  private async act(t: PendingTeacher, action: 'approve' | 'reject'): Promise<void> {
    if (this.busyId()) return;
    this.busyId.set(t.id);
    this.message.set(null);
    try {
      if (action === 'approve') await this.admin.approve(t.id);
      else await this.admin.reject(t.id);
      this.pending.update((list) => list.filter((x) => x.id !== t.id));
      const name = t.fullName || t.email;
      this.message.set({
        ok: true,
        text: action === 'approve' ? `${name} is now a teacher.` : `${name} was declined.`,
      });
    } catch {
      this.message.set({ ok: false, text: 'That did not go through. Try again.' });
    } finally {
      this.busyId.set(null);
    }
  }
}
