import { Component, OnInit, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Classwork, ClassworkFile, ClassworkItem } from '../../../../core/services/classwork';

/** Read-only list of a section's materials for a student: notes, links and files. */
@Component({
  selector: 'app-class-materials',
  imports: [MatIconModule],
  template: `
    <section class="panel">
      <div class="panel-head">
        <mat-icon>folder_open</mat-icon>
        <h2>Materials</h2>
      </div>
      <div class="panel-body">
        @if (error()) {
          <p class="msg error" role="alert">{{ error() }}</p>
        }
        @if (loading()) {
          <p class="msg">Loading materials…</p>
        } @else if (!error() && materials().length === 0) {
          <p class="msg">No materials yet.</p>
        }

        @for (m of materials(); track m.id) {
          <article class="item">
            <h3>{{ m.title }}</h3>
            @if (m.topic) {
              <span class="topic">{{ m.topic }}</span>
            }
            @if (m.details) {
              <p class="body">{{ m.details }}</p>
            }
            <div class="actions">
              @for (file of m.files; track file.id) {
                <button type="button" class="pill" (click)="openFile(file)">
                  <mat-icon>attach_file</mat-icon>{{ file.fileName }}
                </button>
              }
              @if (m.linkUrl) {
                <a class="pill" [href]="m.linkUrl" target="_blank" rel="noopener noreferrer">
                  <mat-icon>link</mat-icon>Open link
                </a>
              }
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 20px;
    }
    .panel {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      background: #fff;
    }
    .panel-head {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .panel-head h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .panel-head mat-icon {
      color: var(--mat-sys-primary);
    }
    .panel-body {
      padding: 4px 20px 8px;
    }
    .msg {
      margin: 16px 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .msg.error {
      color: #8a1c1c;
    }
    .item {
      padding: 16px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .item:last-child {
      border-bottom: 0;
    }
    h3 {
      display: inline;
      margin: 0 10px 0 0;
      font: var(--mat-sys-title-small);
    }
    .topic {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.8rem;
    }
    .body {
      margin: 6px 0 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 10px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 100%;
      padding: 6px 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 999px;
      background: none;
      color: var(--mat-sys-primary);
      font: inherit;
      font-size: 0.85rem;
      text-decoration: none;
      cursor: pointer;
    }
    .pill mat-icon {
      width: 18px;
      height: 18px;
      font-size: 18px;
    }
  `,
})
export class ClassMaterials implements OnInit {
  private readonly classwork = inject(Classwork);

  readonly sectionId = input.required<string>();

  protected readonly materials = signal<ClassworkItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const items = await this.classwork.list(this.sectionId());
      this.materials.set(items.filter((i) => i.kind === 'Material'));
    } catch (err) {
      console.error('Could not load materials', err);
      this.error.set('Could not load materials.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async openFile(file: ClassworkFile): Promise<void> {
    try {
      window.open(await this.classwork.fileUrl(file), '_blank', 'noopener');
    } catch {
      this.error.set('Could not open the file. Try again.');
    }
  }
}
