import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/auth/auth.service';
import { EnrolledNav } from '../../../features/dashboard/enrolled-nav/enrolled-nav';
import { TeacherNav } from '../../../features/dashboard/teacher-nav/teacher-nav';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatTooltipModule,
    EnrolledNav,
    TeacherNav,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  auth = inject(AuthService);
  private router = inject(Router);

  /** Sidebar starts as an icon rail; the menu button opens it. */
  open = signal(false);

  displayName = computed(
    () => this.auth.profile()?.full_name || this.auth.profile()?.email || 'User',
  );
  initial = computed(() => this.displayName().charAt(0).toUpperCase());
  avatarUrl = computed(() => this.auth.profile()?.avatar_url ?? null);

  toggle() {
    this.open.update((v) => !v);
  }

  /**
   * Clicking any empty part of the sidebar opens or closes it.
   * Links and buttons keep doing their own thing.
   */
  onRailClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Picking a page from the sidebar closes it (on every screen size).
    if (target.closest('a')) {
      this.open.set(false);
      return;
    }
    if (target.closest('button, .disabled')) return;
    this.toggle();
  }

  /** Clicking anywhere in the page closes an open sidebar (the phone menu button is excluded). */
  onMainClick(event: MouseEvent) {
    if (!this.open()) return;
    if ((event.target as HTMLElement).closest('.mobile-bar')) return;
    this.open.set(false);
  }

  /** On phones the sidebar is a drawer, so close it after picking a page. */
  closeOnMobile() {
    if (window.matchMedia('(max-width: 768px)').matches) {
      this.open.set(false);
    }
  }

  async logout() {
    await this.auth.signOut();
    this.router.navigateByUrl('/login');
  }
}
