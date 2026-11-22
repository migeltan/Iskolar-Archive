import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import {
  Classwork,
  ClassworkFile,
  ClassworkItem,
  isDuplicateError,
} from '../../../core/services/classwork';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/confirm-dialog/confirm-dialog.component';
import {
  ClassworkDialogData,
  ClassworkDialogKind,
  ClassworkDialogResult,
  ClassworkItemDialogComponent,
} from './classwork-item-dialog/classwork-item-dialog.component';

interface ClassworkGroup {
  name: string | null; // null = the default group
  items: ClassworkItem[];
}

@Component({
  selector: 'app-classwork',
  standalone: true,
  imports: [DatePipe, RouterLink, MatButtonModule, MatMenuModule, MatIconModule],
  templateUrl: './classwork.component.html',
  styleUrl: './classwork.component.scss',
})
export class ClassworkComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly classwork = inject(Classwork);

  protected readonly sectionId = inject(ActivatedRoute).parent?.snapshot.paramMap.get('id') ?? '';

  protected readonly createKinds: readonly ClassworkDialogKind[] = [
    'Topic',
    'Material',
    'Activity',
  ];

  // Display name of the default group. Renaming it only changes this label.
  protected readonly defaultTopicName = signal('No topic');

  protected readonly loading = signal(true);
  private readonly items = signal<ClassworkItem[]>([]);
  private readonly topicNames = signal<string[]>([]);

  // The default group is always first and always shown
  protected readonly groups = computed<ClassworkGroup[]>(() => {
    const items = this.items();
    // Saved topics, plus any topic an item uses that has no saved row.
    const names = [...this.topicNames()];
    for (const item of items) {
      if (item.topic && !names.includes(item.topic)) names.push(item.topic);
    }
    const named = names.map((name) => ({
      name,
      items: items.filter((item) => item.topic === name),
    }));
    const unassigned = items.filter((item) => !item.topic);
    return [{ name: null, items: unassigned }, ...named];
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [items, topics] = await Promise.all([
        this.classwork.list(this.sectionId),
        this.classwork.listTopics(this.sectionId),
      ]);
      this.items.set(items);
      this.topicNames.set(topics);
    } catch (err) {
      console.error('Could not load classwork', err);
      this.fail('Could not load classwork. Check your connection and reload.');
    } finally {
      this.loading.set(false);
    }
  }

  private fail(message: string): void {
    this.snackBar.open(message, 'Dismiss', { duration: 5000 });
  }

  private replaceItem(updated: ClassworkItem): void {
    this.items.update((list) => list.map((i) => (i.id === updated.id ? updated : i)));
  }

  protected async openCreate(
    kind: ClassworkDialogKind,
    topicName: string | null = null,
  ): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<ClassworkItemDialogComponent, ClassworkDialogData, ClassworkDialogResult>(
          ClassworkItemDialogComponent,
          { width: '560px', data: { kind } },
        )
        .afterClosed(),
    );
    if (!result) return;

    if (kind === 'Topic') {
      const name = result.title.trim();
      if (this.nameTaken(name, null)) {
        this.fail('A topic with that name already exists.');
        return;
      }
      try {
        await this.classwork.createTopic(this.sectionId, name);
        this.topicNames.update((t) => [...t, name]);
      } catch (err) {
        console.error('Could not create the topic', err);
        this.fail(
          isDuplicateError(err)
            ? 'A topic with that name already exists.'
            : 'Could not save the topic.',
        );
      }
      return;
    }

    const isActivity = kind === 'Activity';
    let item: ClassworkItem;
    try {
      item = await this.classwork.create(
        this.sectionId,
        kind,
        {
          title: result.title,
          details: result.details,
          dueAt: isActivity ? result.dueAt : null,
          points: isActivity ? result.points : 0,
          linkUrl: result.linkUrl,
        },
        topicName,
      );
    } catch (err) {
      console.error('Could not save the item', err);
      this.fail('Could not save. Try again.');
      return;
    }
    this.items.update((list) => [item, ...list]);

    if (result.files.length) {
      const { added, failed } = await this.classwork.addFiles(item, result.files);
      this.replaceItem({ ...item, files: added });
      if (failed.length) this.fail(`Could not upload: ${failed.join(', ')}`);
    }
  }

  protected async openEdit(item: ClassworkItem): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<ClassworkItemDialogComponent, ClassworkDialogData, ClassworkDialogResult>(
          ClassworkItemDialogComponent,
          { width: '560px', data: { kind: item.kind, item } },
        )
        .afterClosed(),
    );
    if (!result) return;

    let updated: ClassworkItem;
    try {
      updated = await this.classwork.update(item, {
        title: result.title,
        details: result.details,
        dueAt: item.kind === 'Activity' ? result.dueAt : null,
        points: item.kind === 'Activity' ? result.points : 0,
        linkUrl: result.linkUrl,
      });
    } catch (err) {
      console.error('Could not save the item', err);
      this.fail('Could not save. Try again.');
      return;
    }

    // Files: remove the ones the teacher dropped, then upload the new ones.
    const removed = new Set(result.removedFileIds);
    const kept: ClassworkFile[] = [];
    let problem = '';
    for (const file of item.files) {
      if (!removed.has(file.id)) {
        kept.push(file);
        continue;
      }
      try {
        await this.classwork.removeFile(file);
      } catch (err) {
        console.error('Could not remove a file', err);
        kept.push(file);
        problem = `Could not remove ${file.fileName}. `;
      }
    }
    let added: ClassworkFile[] = [];
    if (result.files.length) {
      const outcome = await this.classwork.addFiles(item, result.files);
      added = outcome.added;
      if (outcome.failed.length) problem += `Could not upload: ${outcome.failed.join(', ')}`;
    }
    this.replaceItem({ ...updated, files: [...kept, ...added] });
    if (problem) this.fail(problem.trim());
  }

  protected confirmDelete(item: ClassworkItem): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        width: '560px',
        data: { message: `Delete "${item.title}"? This action is permanent and cannot be undone.` },
      })
      .afterClosed()
      .subscribe(async (confirmed) => {
        if (!confirmed) return;
        try {
          await this.classwork.remove(item);
          this.items.update((list) => list.filter((i) => i.id !== item.id));
        } catch (err) {
          console.error('Could not delete the item', err);
          this.fail('Could not delete. Try again.');
        }
      });
  }

  // true if another topic (or the default group) already uses this name
  private nameTaken(name: string, except: string | null): boolean {
    const lower = name.toLowerCase();
    const all = [
      this.defaultTopicName(),
      ...this.groups().flatMap((g) => (g.name ? [g.name] : [])),
    ];
    return all.some((n) => n.toLowerCase() === lower && n !== except);
  }

  protected async editTopic(oldName: string | null): Promise<void> {
    const current = oldName ?? this.defaultTopicName();

    const result = await firstValueFrom(
      this.dialog
        .open<ClassworkItemDialogComponent, ClassworkDialogData, ClassworkDialogResult>(
          ClassworkItemDialogComponent,
          { width: '560px', data: { kind: 'Topic', initialTitle: current } },
        )
        .afterClosed(),
    );
    const newName = result?.title.trim();
    if (!newName || newName === current) return;

    if (this.nameTaken(newName, current)) {
      this.fail('A topic with that name already exists.');
      return;
    }

    // Default group: only the label changes
    if (oldName === null) {
      this.defaultTopicName.set(newName);
      return;
    }

    try {
      await this.classwork.renameTopic(this.sectionId, oldName, newName);
    } catch (err) {
      console.error('Could not rename the topic', err);
      this.fail(
        isDuplicateError(err)
          ? 'A topic with that name already exists.'
          : 'Could not rename the topic.',
      );
      return;
    }
    this.topicNames.update((t) => t.map((n) => (n === oldName ? newName : n)));
    this.items.update((list) =>
      list.map((i) => (i.topic === oldName ? { ...i, topic: newName } : i)),
    );
  }

  protected deleteTopic(topicName: string | null): void {
    const displayName = topicName ?? this.defaultTopicName();
    const message =
      topicName === null
        ? `Remove everything in "${displayName}"? All its materials and activities will be permanently deleted.`
        : `Delete "${displayName}"? All materials and activities inside it will be permanently removed.`;

    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        width: '560px',
        data: { message },
      })
      .afterClosed()
      .subscribe(async (confirmed) => {
        if (!confirmed) return;
        const inGroup = this.items().filter((i) =>
          topicName === null ? !i.topic : i.topic === topicName,
        );
        try {
          await this.classwork.removeAll(inGroup);
          // The default group stays; named topics are removed
          if (topicName !== null) await this.classwork.deleteTopic(this.sectionId, topicName);
        } catch (err) {
          console.error('Could not delete the topic', err);
          this.fail('Could not delete everything. Reload and try again.');
          return;
        }
        const gone = new Set(inGroup.map((i) => i.id));
        this.items.update((list) => list.filter((i) => !gone.has(i.id)));
        if (topicName !== null) this.topicNames.update((t) => t.filter((n) => n !== topicName));
      });
  }

  protected async openFile(file: ClassworkFile): Promise<void> {
    try {
      const url = await this.classwork.fileUrl(file);
      window.open(url, '_blank', 'noopener');
    } catch {
      this.fail('Could not open the file. Try again.');
    }
  }
}
