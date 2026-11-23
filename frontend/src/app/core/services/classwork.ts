import { Injectable, inject } from '@angular/core';
import { ClassworkKind } from '../../shared/models/lms.models';
import { SUPABASE_CLIENT, StorageService } from '../../shared/storage/storage.service';

export interface ClassworkFile {
  id: string;
  fileName: string;
  storagePath: string;
}

/** A material or an activity, in one shape for the teacher and student screens. */
export interface ClassworkItem {
  id: string;
  sectionId: string;
  kind: ClassworkKind;
  title: string;
  details: string;
  dueAt: string | null;
  points: number;
  topic: string | null;
  /** Materials: link_url. Activities: form_url (e.g. a Google Form quiz). */
  linkUrl: string | null;
  createdAt: string;
  files: ClassworkFile[];
}

export interface ClassworkInput {
  title: string;
  details: string;
  dueAt: string | null;
  points: number;
  linkUrl: string | null;
}

export interface AddFilesResult {
  added: ClassworkFile[];
  failed: string[];
}

interface FileRow {
  id: string;
  file_name: string;
  storage_path: string;
}

interface MaterialRow {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  link_url: string | null;
  topic: string | null;
  created_at: string;
  attachments: FileRow[] | null;
}

interface ActivityRow {
  id: string;
  section_id: string;
  title: string;
  instructions: string | null;
  due_at: string | null;
  points: number;
  form_url: string | null;
  topic: string | null;
  created_at: string;
  attachments: FileRow[] | null;
}

const FILE_COLUMNS = 'id, file_name, storage_path';
const MATERIAL_COLUMNS = `id, section_id, title, description, link_url, topic, created_at, attachments(${FILE_COLUMNS})`;
const ACTIVITY_COLUMNS = `id, section_id, title, instructions, due_at, points, form_url, topic, created_at, attachments(${FILE_COLUMNS})`;

function toFile(row: FileRow): ClassworkFile {
  return { id: row.id, fileName: row.file_name, storagePath: row.storage_path };
}

function toMaterial(row: MaterialRow): ClassworkItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    kind: 'Material',
    title: row.title,
    details: row.description ?? '',
    dueAt: null,
    points: 0,
    topic: row.topic,
    linkUrl: row.link_url,
    createdAt: row.created_at,
    files: (row.attachments ?? []).map(toFile),
  };
}

function toActivity(row: ActivityRow): ClassworkItem {
  return {
    id: row.id,
    sectionId: row.section_id,
    kind: 'Activity',
    title: row.title,
    details: row.instructions ?? '',
    dueAt: row.due_at,
    points: row.points,
    topic: row.topic,
    linkUrl: row.form_url,
    createdAt: row.created_at,
    files: (row.attachments ?? []).map(toFile),
  };
}

const tableOf = (kind: ClassworkKind): 'materials' | 'activities' =>
  kind === 'Material' ? 'materials' : 'activities';

const columnsOf = (kind: ClassworkKind): string =>
  kind === 'Material' ? MATERIAL_COLUMNS : ACTIVITY_COLUMNS;

const parentColumn = (kind: ClassworkKind): 'material_id' | 'activity_id' =>
  kind === 'Material' ? 'material_id' : 'activity_id';

function fromRow(kind: ClassworkKind, row: unknown): ClassworkItem {
  return kind === 'Material' ? toMaterial(row as MaterialRow) : toActivity(row as ActivityRow);
}

function payload(kind: ClassworkKind, input: ClassworkInput): Record<string, unknown> {
  return kind === 'Material'
    ? {
        title: input.title,
        description: input.details || null,
        link_url: input.linkUrl,
      }
    : {
        title: input.title,
        instructions: input.details || null,
        due_at: input.dueAt,
        points: input.points,
        form_url: input.linkUrl,
      };
}

/** Materials, activities, their files and the section's topics. RLS decides who can do what. */
@Injectable({ providedIn: 'root' })
export class Classwork {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly storage = inject(StorageService);

  /** Materials and activities of a section together, newest first. */
  async list(sectionId: string): Promise<ClassworkItem[]> {
    const [materials, activities] = await Promise.all([
      this.supabase.from('materials').select(MATERIAL_COLUMNS).eq('section_id', sectionId),
      this.supabase.from('activities').select(ACTIVITY_COLUMNS).eq('section_id', sectionId),
    ]);
    if (materials.error) throw materials.error;
    if (activities.error) throw activities.error;
    const items = [
      ...(materials.data as unknown as MaterialRow[]).map(toMaterial),
      ...(activities.data as unknown as ActivityRow[]).map(toActivity),
    ];
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(
    sectionId: string,
    kind: ClassworkKind,
    input: ClassworkInput,
    topic: string | null,
  ): Promise<ClassworkItem> {
    const { data, error } = await this.supabase
      .from(tableOf(kind))
      .insert({ section_id: sectionId, topic, ...payload(kind, input) })
      .select(columnsOf(kind))
      .single();
    if (error) throw error;
    return fromRow(kind, data);
  }

  async update(item: ClassworkItem, input: ClassworkInput): Promise<ClassworkItem> {
    const { data, error } = await this.supabase
      .from(tableOf(item.kind))
      .update(payload(item.kind, input))
      .eq('id', item.id)
      .select(columnsOf(item.kind))
      .single();
    if (error) throw error;
    return fromRow(item.kind, data);
  }

  /** Deletes the rows (their file rows go with them), then the stored files. */
  async removeAll(items: ClassworkItem[]): Promise<void> {
    for (const kind of ['Material', 'Activity'] as const) {
      const ids = items.filter((i) => i.kind === kind).map((i) => i.id);
      if (ids.length === 0) continue;
      const { data, error } = await this.supabase
        .from(tableOf(kind))
        .delete()
        .in('id', ids)
        .select('id');
      if (error) throw error;
      if ((data?.length ?? 0) !== ids.length) throw new Error('Could not delete everything.');
    }
    await this.storage.removeMaterials(items.flatMap((i) => i.files.map((f) => f.storagePath)));
  }

  async remove(item: ClassworkItem): Promise<void> {
    await this.removeAll([item]);
  }

  // ---------- Files ----------

  /** Uploads each file and links it to the item. One bad file does not stop the others. */
  async addFiles(item: ClassworkItem, files: File[]): Promise<AddFilesResult> {
    const added: ClassworkFile[] = [];
    const failed: string[] = [];
    for (const file of files) {
      let path: string | null = null;
      try {
        path = await this.storage.uploadMaterial(item.sectionId, file);
        const { data, error } = await this.supabase
          .from('attachments')
          .insert({
            [parentColumn(item.kind)]: item.id,
            storage_path: path,
            file_name: file.name,
          })
          .select(FILE_COLUMNS)
          .single();
        if (error) throw error;
        added.push(toFile(data as unknown as FileRow));
      } catch (err) {
        console.error('Could not add file', file.name, err);
        failed.push(file.name);
        if (path) await this.storage.removeMaterials([path]);
      }
    }
    return { added, failed };
  }

  async removeFile(file: ClassworkFile): Promise<void> {
    const { data, error } = await this.supabase
      .from('attachments')
      .delete()
      .eq('id', file.id)
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Could not remove the file.');
    await this.storage.removeMaterials([file.storagePath]);
  }

  /** A temporary link (1 hour) the browser can open. */
  fileUrl(file: ClassworkFile): Promise<string> {
    return this.storage.getMaterialUrl(file.storagePath);
  }

  /** Files the teacher attached to one activity (reference material for the students). */
  async activityFiles(activityId: string): Promise<ClassworkFile[]> {
    const { data, error } = await this.supabase
      .from('attachments')
      .select(FILE_COLUMNS)
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as unknown as FileRow[]).map(toFile);
  }
  // ---------- Topics ----------

  async listTopics(sectionId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('section_topics')
      .select('name')
      .eq('section_id', sectionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as unknown as { name: string }[]).map((t) => t.name);
  }

  async createTopic(sectionId: string, name: string): Promise<void> {
    const { error } = await this.supabase
      .from('section_topics')
      .insert({ section_id: sectionId, name });
    if (error) throw error;
  }

  /** Renames the topic and every material and activity filed under it. */
  async renameTopic(sectionId: string, oldName: string, newName: string): Promise<void> {
    const topic = await this.supabase
      .from('section_topics')
      .update({ name: newName })
      .eq('section_id', sectionId)
      .eq('name', oldName);
    if (topic.error) throw topic.error;
    for (const table of ['materials', 'activities'] as const) {
      const { error } = await this.supabase
        .from(table)
        .update({ topic: newName })
        .eq('section_id', sectionId)
        .eq('topic', oldName);
      if (error) throw error;
    }
  }

  /** Removes only the topic row. Delete its items first with removeAll. */
  async deleteTopic(sectionId: string, name: string): Promise<void> {
    const { error } = await this.supabase
      .from('section_topics')
      .delete()
      .eq('section_id', sectionId)
      .eq('name', name);
    if (error) throw error;
  }
}

/** True for the Postgres "unique violation" error (for example a duplicate topic name). */
export function isDuplicateError(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '23505';
}
