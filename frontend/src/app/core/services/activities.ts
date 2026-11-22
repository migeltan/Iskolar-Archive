import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { SUPABASE_CLIENT } from '../../shared/storage/storage.service';
import { Activity, NewActivity } from '../models/classwork.models';

/** Activities straight from the database (the student screens and the gradebook use this). */
@Injectable({ providedIn: 'root' })
export class Activities {
  private readonly supabase = inject(SUPABASE_CLIENT);

  listBySection(sectionId: string): Observable<Activity[]> {
    return defer(() => from(this.fetchBySection(sectionId)));
  }

  getById(id: string): Observable<Activity | undefined> {
    return defer(() => from(this.fetchById(id)));
  }

  create(input: NewActivity): Observable<Activity> {
    return defer(() => from(this.insert(input)));
  }

  private async fetchBySection(sectionId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data as unknown as Activity[];
  }

  private async fetchById(id: string): Promise<Activity | undefined> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as unknown as Activity | null) ?? undefined;
  }

  private async insert(input: NewActivity): Promise<Activity> {
    const { data, error } = await this.supabase
      .from('activities')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;
    return data as unknown as Activity;
  }
}
