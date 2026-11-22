import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SUPABASE_CLIENT } from '../../shared/storage/storage.service';

export type Role = 'student' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Real Supabase auth by default. Set `useMockAuth: true` in an environment file
  // (locally, do not commit) to sign in offline with fake accounts.
  private readonly supabase = environment.useMockAuth
    ? null
    : inject(SUPABASE_CLIENT, { optional: true });

  profile = signal<Profile | null>(null);
  role = computed(() => this.profile()?.role ?? null);
  userId = computed(() => this.profile()?.id ?? null);
  isLoggedIn = computed(() => !!this.profile());

  /** The route guards wait for this: it restores the saved session before the first check. */
  ready: Promise<void>;

  constructor() {
    this.ready = this.supabase ? this.restoreSession() : Promise.resolve();
  }

  async signInWithEmail(email: string, password: string): Promise<void> {
    if (!this.supabase) {
      this.mockLogin(email);
      return;
    }
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    await this.loadProfile(data.user.id);
    if (!this.profile()) {
      await this.supabase.auth.signOut();
      throw new Error('This account has no active profile.');
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.supabase?.auth.signOut();
    } finally {
      this.profile.set(null);
    }
  }

  // ---------- Supabase session ----------

  private async restoreSession(): Promise<void> {
    const supabase = this.supabase!;
    try {
      const { data } = await supabase.auth.getSession();
      await this.loadProfile(data.session?.user.id ?? null);
    } catch {
      this.profile.set(null);
    }

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        this.profile.set(null);
      } else if (event === 'SIGNED_IN' && session && session.user.id !== this.profile()?.id) {
        // Never call Supabase inside this callback directly (it can deadlock): defer it.
        setTimeout(() => void this.loadProfile(session.user.id), 0);
      }
    });
  }

  private async loadProfile(userId: string | null): Promise<void> {
    if (!userId || !this.supabase) {
      this.profile.set(null);
      return;
    }
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, email, full_name, role, status')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      this.profile.set(null);
      return;
    }
    if (data.status === 'suspended') {
      await this.supabase.auth.signOut();
      this.profile.set(null);
      return;
    }
    this.profile.set(data as Profile);
  }

  // ---------- Mock mode ----------

  // Testing trick: an email containing "admin" or "teacher" gets that role
  private mockLogin(email: string) {
    const role: Role = email.includes('admin')
      ? 'admin'
      : email.includes('teacher')
        ? 'teacher'
        : 'student';
    this.profile.set({
      id: '1',
      email,
      full_name: email.split('@')[0],
      role,
      status: 'active',
    });
  }
}
