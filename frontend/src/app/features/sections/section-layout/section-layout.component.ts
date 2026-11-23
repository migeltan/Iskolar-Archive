import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CoursesService } from '../../../core/services/courses';
import { Section } from '../../../shared/models/lms.models';
import { sectionDesign } from '../../dashboard/section-design';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

@Component({
  selector: 'app-section-layout',
  standalone: true,
  imports: [MatIconModule, MatMenuModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './section-layout.component.html',
  styleUrl: './section-layout.component.scss',
})
export class SectionLayoutComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly coursesApi = inject(CoursesService);

  protected readonly sectionId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly section = signal<Section | undefined>(undefined);
  protected readonly design = sectionDesign(this.sectionId);

  protected readonly navItems = [
    { label: 'Stream', path: 'stream', icon: 'forum' },
    { label: 'Classwork', path: 'classwork', icon: 'assignment' },
    { label: 'Grades', path: 'grades', icon: 'grade' },
    { label: 'People', path: 'people', icon: 'group' },
  ];

  ngOnInit(): void {
    void this.loadSection();
  }

  // ---------- COVER IMAGE (null = the section's colour and pattern) ----------
  // Still stored in this browser only; a real cover needs a database column.
  private readonly coverKey = `section-cover:${this.sectionId}`;
  protected readonly cover = signal<string | null>(this.read(this.coverKey));

  protected readonly bannerBackground = computed(() => {
    const url = this.cover();
    return url
      ? `linear-gradient(rgba(0, 0, 0, 0.35), rgba(0, 0, 0, 0.35)), center / cover no-repeat url("${url}")`
      : null;
  });

  protected onCoverSelected(event: Event): void {
    this.pickImage(event, this.coverKey, (url) => this.cover.set(url));
  }

  protected resetCover(): void {
    this.cover.set(null);
    this.remove(this.coverKey);
  }

  // ---------- helpers ----------
  private async loadSection(): Promise<void> {
    try {
      this.section.set(await this.coursesApi.getSection(this.sectionId));
    } catch {
      this.section.set(undefined);
    }
  }

  private pickImage(event: Event, storageKey: string, apply: (dataUrl: string) => void): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (!file) return;

    if (!IMAGE_TYPES.includes(file.type)) {
      this.snackBar.open('Please choose a PNG, JPG, or WebP image.', 'Dismiss', {
        duration: 4000,
      });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      this.snackBar.open('Choose an image smaller than 2 MB.', 'Dismiss', { duration: 4000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      apply(dataUrl);
      try {
        localStorage.setItem(storageKey, dataUrl);
      } catch {
        this.snackBar.open('Changed for this session only (storage is full).', 'Dismiss', {
          duration: 4000,
        });
      }
    };
    reader.readAsDataURL(file);
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
