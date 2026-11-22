import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Course } from '../models/lms.models';

export interface CourseFormData {
  code: string;
  title: string;
  coverGradient: string;
  coverFile: File | null;
  removePhoto: boolean;
}

// Must match the course-covers bucket: 2 MB, PNG/JPEG/WebP.
const MAX_COVER_BYTES = 2 * 1024 * 1024;
const COVER_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const COVER_GRADIENTS: readonly string[] = [
  'linear-gradient(180deg, #d4727a, #a94f87)',
  'linear-gradient(180deg, #e4a1a1, #8e5a72)',
  'linear-gradient(180deg, #c58fc4, #6f5a9c)',
  'linear-gradient(180deg, #e8b933, #8a5a10)',
  'linear-gradient(180deg, #dde04a, #4f9b1a)',
  'linear-gradient(180deg, #6f93c4, #3a4468)',
];

@Component({
  selector: 'app-course-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './course-dialog.component.html',
  styleUrl: './course-dialog.component.scss',
})
export class CourseDialogComponent implements OnDestroy {
  private readonly dialogRef =
    inject<MatDialogRef<CourseDialogComponent, CourseFormData>>(MatDialogRef);
  private readonly fb = inject(FormBuilder);

  /** null when adding a course, the course itself when editing. */
  private readonly existing = inject<Course | null>(MAT_DIALOG_DATA, { optional: true });

  private coverFile: File | null = null;
  private keepExistingPhoto = !!this.existing?.coverImageUrl;
  private removePhoto = false;

  protected readonly gradients = COVER_GRADIENTS;
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    code: [this.existing?.code ?? '', Validators.required],
    title: [this.existing?.title ?? '', Validators.required],
    coverGradient: [this.existing?.coverGradient ?? COVER_GRADIENTS[0]],
  });

  protected get heading(): string {
    return this.existing ? 'Edit course' : 'Add course';
  }

  protected get saveLabel(): string {
    return this.existing ? 'Save changes' : 'Save';
  }

  /** True while a photo (new or the saved one) is what the preview shows. */
  protected get showingPhoto(): boolean {
    return !!this.previewUrl() || this.keepExistingPhoto;
  }

  protected get previewBackground(): string {
    const url = this.previewUrl() ?? (this.keepExistingPhoto ? this.existing?.coverImageUrl : null);
    return url ? `center / cover no-repeat url("${url}")` : this.form.controls.coverGradient.value;
  }

  ngOnDestroy(): void {
    this.clearPhoto();
  }

  protected selectGradient(gradient: string): void {
    this.clearPhoto();
    this.keepExistingPhoto = false;
    this.removePhoto = true;
    this.uploadError.set(null);
    this.form.controls.coverGradient.setValue(gradient);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0) ?? null;
    input.value = '';
    if (!file) {
      return;
    }
    if (!COVER_TYPES.includes(file.type)) {
      this.uploadError.set('Choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > MAX_COVER_BYTES) {
      this.uploadError.set('Choose an image smaller than 2 MB.');
      return;
    }
    this.uploadError.set(null);
    this.clearPhoto();
    this.coverFile = file;
    this.previewUrl.set(URL.createObjectURL(file));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      code: value.code.trim(),
      title: value.title.trim(),
      coverGradient: value.coverGradient,
      coverFile: this.coverFile,
      removePhoto: this.removePhoto,
    });
  }

  private clearPhoto(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.previewUrl.set(null);
    this.coverFile = null;
  }
}
