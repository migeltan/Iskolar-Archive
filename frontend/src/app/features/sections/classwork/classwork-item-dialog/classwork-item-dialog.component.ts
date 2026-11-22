import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ClassworkFile, ClassworkItem } from '../../../../core/services/classwork';
import { ClassworkKind } from '../../../../shared/models/lms.models';

export type ClassworkDialogKind = 'Topic' | ClassworkKind;

export interface ClassworkDialogData {
  kind: ClassworkDialogKind;
  item?: ClassworkItem;
  initialTitle?: string; // set when renaming a topic
}

export interface ClassworkDialogResult {
  title: string;
  details: string;
  dueAt: string | null; // ISO timestamp
  points: number;
  files: File[]; // new files to upload
  removedFileIds: string[]; // existing files to delete
  linkUrl: string | null;
}

// Must match the `materials` storage bucket: PDF, DOCX, PPTX and images, 10 MB each.
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'pptx', 'png', 'jpg', 'jpeg'];

/** An ISO timestamp as the "YYYY-MM-DDTHH:mm" text a datetime-local input expects (local time). */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

@Component({
  selector: 'app-classwork-item-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './classwork-item-dialog.component.html',
  styleUrl: './classwork-item-dialog.component.scss',
})
export class ClassworkItemDialogComponent {
  protected readonly data = inject<ClassworkDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef =
    inject<MatDialogRef<ClassworkItemDialogComponent, ClassworkDialogResult>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  protected readonly acceptAttr = ALLOWED_EXTENSIONS.map((e) => '.' + e).join(',');

  // Files already on the item (shown with a Remove button) and files picked in this dialog.
  protected readonly existingFiles = signal<ClassworkFile[]>(this.data.item?.files ?? []);
  protected readonly newFiles = signal<File[]>([]);
  private removedFileIds: string[] = [];

  protected readonly fileError = signal<string | null>(null);
  protected readonly linkError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: [this.data.item?.title ?? this.data.initialTitle ?? '', Validators.required],
    details: [this.data.item?.details ?? ''],
    dueAt: [toLocalInput(this.data.item?.dueAt)],
    points: [this.data.item?.points ?? 100, Validators.min(0)],
    linkUrl: [this.data.item?.linkUrl ?? ''],
  });

  protected get heading(): string {
    const editing = !!this.data.item || this.data.initialTitle !== undefined;
    return `${editing ? 'Edit' : 'Add'} ${this.data.kind.toLowerCase()}`;
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';

    let error: string | null = null;
    const accepted: File[] = [];
    for (const file of picked) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        error = 'Allowed files: PDF, Word (.docx), PowerPoint (.pptx), PNG, JPG.';
      } else if (file.size > MAX_FILE_BYTES) {
        error = `"${file.name}" is over 10 MB.`;
      } else if (!this.newFiles().some((f) => f.name === file.name && f.size === file.size)) {
        accepted.push(file);
      }
    }
    this.fileError.set(error);
    if (accepted.length) this.newFiles.update((list) => [...list, ...accepted]);
  }

  protected removeNew(index: number): void {
    this.newFiles.update((list) => list.filter((_, i) => i !== index));
  }

  protected removeExisting(file: ClassworkFile): void {
    this.removedFileIds.push(file.id);
    this.existingFiles.update((list) => list.filter((f) => f.id !== file.id));
  }

  // Returns a clean https URL, '' if empty, or null if invalid
  private normalizeLink(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed === '') return '';
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(withProtocol);
      return url.hostname.includes('.') ? url.toString() : null;
    } catch {
      return null;
    }
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();

    let linkUrl: string | null = null;
    if (this.data.kind !== 'Topic') {
      const link = this.normalizeLink(value.linkUrl);
      if (link === null) {
        this.linkError.set('Enter a valid link, e.g. https://example.com');
        return;
      }
      this.linkError.set(null);
      linkUrl = link === '' ? null : link;
    }

    this.dialogRef.close({
      title: value.title.trim(),
      details: value.details.trim(),
      dueAt: value.dueAt === '' ? null : new Date(value.dueAt).toISOString(),
      points: value.points,
      files: this.newFiles(),
      removedFileIds: this.removedFileIds,
      linkUrl,
    });
  }
}
