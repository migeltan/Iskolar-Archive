import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../core/auth/auth.service';
import { MySection } from '../../../core/models/classwork.models';
import { Enrollments } from '../../../core/services/enrollments';
import { Skeleton } from '../../skeleton/skeleton';
import { sectionDesign } from '../section-design';

/** Sidebar block for students: To-do, My grades and the joined classes. */
@Component({
  selector: 'app-enrolled-nav',
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule, Skeleton],
  templateUrl: './enrolled-nav.html',
  styleUrl: './enrolled-nav.scss',
  host: { '[class.collapsed]': 'collapsed()' },
})
export class EnrolledNav {
  /** True while the sidebar is the icon-only rail. */
  collapsed = input(false);
  auth = inject(AuthService);
  private enrollments = inject(Enrollments);

  sections = signal<MySection[]>([]);
  loading = signal(true);
  design = sectionDesign;

  constructor() {
    // Reloads when the user changes or a new class is joined.
    effect(() => {
      this.enrollments.version();
      const id = this.auth.userId();
      if (!id) {
        this.sections.set([]);
        this.loading.set(false);
        return;
      }
      this.enrollments.listMySections(id).subscribe((list) => {
        this.sections.set(list);
        this.loading.set(false);
      });
    });
  }
}
