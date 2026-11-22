import { Injectable, InjectionToken, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');

/** "section-1/1731000000000_syllabus.pdf" -> "syllabus.pdf" */
export function displayNameFromPath(path: string): string {
  const fileName = path.split('/').pop() ?? path;
  return fileName.replace(/^\d+_/, '');
}

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  async uploadMaterial(sectionId: string, file: File): Promise<string> {
    // Spaces and symbols in a storage key can be rejected, so keep the key plain.
    const safeName = file.name.replace(/[^\w.-]+/g, '_');
    const path = `${sectionId}/${Date.now()}_${safeName}`;
    const { error } = await this.supabase.storage.from('materials').upload(path, file);
    if (error) {
      throw error;
    }
    return path;
  }

  async getMaterialUrl(path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('materials')
      .createSignedUrl(path, 3600);
    if (error) {
      throw error;
    }
    return data.signedUrl;
  }

  /** Best effort: a file that cannot be removed only wastes space, so errors are ignored. */
  async removeMaterials(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    await this.supabase.storage.from('materials').remove(paths);
  }

  async uploadCourseCover(courseId: string, file: File): Promise<string> {
    const safeName = file.name.replace(/[^\w.-]+/g, '_');
    const path = `${courseId}/${Date.now()}_${safeName}`;
    const { error } = await this.supabase.storage.from('course-covers').upload(path, file);
    if (error) {
      throw error;
    }
    return this.supabase.storage.from('course-covers').getPublicUrl(path).data.publicUrl;
  }
}
