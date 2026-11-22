import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';

/** Center-crops an image to a square and shrinks it, so uploads stay tiny. */
async function squareJpeg(file: File, size: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.fillStyle = '#fff'; // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))),
      'image/jpeg',
      0.85,
    ),
  );
}

@Component({
  selector: 'app-settings',
  imports: [DatePipe, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  auth = inject(AuthService);

  /** Password change needs a real Supabase session, so it is hidden in mock mode. */
  readonly canChangePassword = !environment.useMockAuth;

  initial = computed(() => {
    const p = this.auth.profile();
    return (p?.full_name || p?.email || 'U').charAt(0).toUpperCase();
  });

  // Profile picture
  avatarBusy = signal(false);
  avatarMsg = signal<{ ok: boolean; text: string } | null>(null);

  // Name form
  fullName = signal(this.auth.profile()?.full_name ?? '');
  nameBusy = signal(false);
  nameMsg = signal<{ ok: boolean; text: string } | null>(null);

  // Password form
  newPassword = signal('');
  confirmPassword = signal('');
  pwBusy = signal(false);
  pwMsg = signal<{ ok: boolean; text: string } | null>(null);

  async onAvatarPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // lets the same file be picked again
    if (!file) return;
    this.avatarMsg.set(null);
    if (!file.type.startsWith('image/')) {
      this.avatarMsg.set({ ok: false, text: 'Please choose an image file.' });
      return;
    }
    this.avatarBusy.set(true);
    try {
      await this.auth.setAvatar(await squareJpeg(file, 256));
      this.avatarMsg.set({ ok: true, text: 'Photo updated.' });
    } catch (e) {
      this.avatarMsg.set({ ok: false, text: e instanceof Error ? e.message : 'Could not upload.' });
    } finally {
      this.avatarBusy.set(false);
    }
  }

  async removeAvatar() {
    this.avatarBusy.set(true);
    this.avatarMsg.set(null);
    try {
      await this.auth.removeAvatar();
      this.avatarMsg.set({ ok: true, text: 'Photo removed.' });
    } catch (e) {
      this.avatarMsg.set({ ok: false, text: e instanceof Error ? e.message : 'Could not remove.' });
    } finally {
      this.avatarBusy.set(false);
    }
  }

  async saveName() {
    this.nameBusy.set(true);
    this.nameMsg.set(null);
    try {
      await this.auth.updateProfile(this.fullName());
      this.nameMsg.set({ ok: true, text: 'Name saved.' });
    } catch (e) {
      this.nameMsg.set({ ok: false, text: e instanceof Error ? e.message : 'Could not save.' });
    } finally {
      this.nameBusy.set(false);
    }
  }

  async savePassword() {
    this.pwMsg.set(null);
    if (this.newPassword().length < 8) {
      this.pwMsg.set({ ok: false, text: 'Use at least 8 characters.' });
      return;
    }
    if (this.newPassword() !== this.confirmPassword()) {
      this.pwMsg.set({ ok: false, text: 'Passwords do not match.' });
      return;
    }
    this.pwBusy.set(true);
    try {
      await this.auth.updatePassword(this.newPassword());
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.pwMsg.set({ ok: true, text: 'Password changed.' });
    } catch (e) {
      this.pwMsg.set({
        ok: false,
        text: e instanceof Error ? e.message : 'Could not change password.',
      });
    } finally {
      this.pwBusy.set(false);
    }
  }
}
