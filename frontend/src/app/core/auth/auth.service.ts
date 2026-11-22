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
  created_at?: string;
  avatar_url?: string | null;
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

  // ---------- Profile picture ----------

  /** Uploads an already-resized picture to the public `avatars` bucket and saves its URL. */
  async setAvatar(image: Blob): Promise<void> {
    const current = this.profile();
    if (!current) throw new Error('You are not signed in.');

    if (!this.supabase) {
      // Mock mode: the picture only lives in memory.
      this.profile.set({ ...current, avatar_url: URL.createObjectURL(image) });
      return;
    }

    // A new file name each time, so browsers never show a cached old picture.
    const path = `${current.id}/avatar_${Date.now()}.jpg`;
    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(path, image, { contentType: 'image/jpeg' });
    if (uploadError) throw uploadError;

    const url = this.supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { data, error } = await this.supabase
      .from('profiles')
      .update({ avatar_url: url })
      .eq('id', current.id)
      .select('id');
    if (error || !data?.length) {
      await this.supabase.storage.from('avatars').remove([path]);
      throw error ?? new Error('Could not save your picture.');
    }

    await this.removeAvatarFile(current.avatar_url);
    this.profile.set({ ...current, avatar_url: url });
  }

  async removeAvatar(): Promise<void> {
    const current = this.profile();
    if (!current) return;
    if (this.supabase) {
      const { error } = await this.supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', current.id);
      if (error) throw error;
      await this.removeAvatarFile(current.avatar_url);
    }
    this.profile.set({ ...current, avatar_url: null });
  }

  /** Deletes the old picture file from storage (best effort). */
  private async removeAvatarFile(url: string | null | undefined): Promise<void> {
    const path = url?.split('/avatars/')[1];
    if (path && this.supabase) {
      await this.supabase.storage.from('avatars').remove([path]);
    }
  }

  // ---------- Profile settings ----------

  /** Saves the user's own full name (RLS allows updating your own profiles row). */
  async updateProfile(fullName: string): Promise<void> {
    const current = this.profile();
    if (!current) throw new Error('You are not signed in.');
    const name = fullName.trim() || null;

    if (this.supabase) {
      // .select() returns the changed rows, so a silently blocked update shows up as empty.
      const { data, error } = await this.supabase
        .from('profiles')
        .update({ full_name: name })
        .eq('id', current.id)
        .select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('Could not save your name.');
    }
    this.profile.set({ ...current, full_name: name });
  }

  /** Changes the signed-in user's password. Real Supabase mode only. */
  async updatePassword(newPassword: string): Promise<void> {
    if (!this.supabase) throw new Error('Password change needs real sign-in.');
    const { error } = await this.supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
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
      .select('id, email, full_name, role, status, created_at, avatar_url')
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
