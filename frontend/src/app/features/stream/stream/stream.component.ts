import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { Announcements, StreamComment, StreamPost } from '../../../core/services/announcements';

@Component({
  selector: 'app-stream',
  standalone: true,
  imports: [DatePipe, MatIconModule],
  templateUrl: './stream.component.html',
  styleUrl: './stream.component.scss',
})
export class StreamComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly announcements = inject(Announcements);

  // The section id lives on the parent route (section/:id), this page is its child.
  private readonly sectionId = this.route.parent?.snapshot.paramMap.get('id') ?? '';

  protected readonly posts = signal<StreamPost[]>([]);
  protected readonly teacherName = signal('Teacher');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly posting = signal(false);
  protected readonly newPost = signal('');
  // Comment drafts by post id
  protected readonly drafts = signal<Record<string, string>>({});

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [posts, name] = await Promise.all([
        this.announcements.list(this.sectionId),
        this.announcements.teacherName(this.sectionId),
      ]);
      this.posts.set(posts);
      this.teacherName.set(name);
    } catch (err) {
      console.error('Could not load the stream', err);
      this.error.set('Could not load posts. Check your connection and reload.');
    } finally {
      this.loading.set(false);
    }
  }

  protected draft(postId: string): string {
    return this.drafts()[postId] ?? '';
  }

  protected setDraft(postId: string, value: string): void {
    this.drafts.update((d) => ({ ...d, [postId]: value }));
  }

  protected async submitPost(): Promise<void> {
    const body = this.newPost().trim();
    if (!body || this.posting()) return;
    this.posting.set(true);
    this.error.set('');
    try {
      const post = await this.announcements.post(this.sectionId, body);
      this.posts.update((list) => [post, ...list]);
      this.newPost.set('');
    } catch (err) {
      console.error('Could not post', err);
      this.error.set('Could not post. Try again.');
    } finally {
      this.posting.set(false);
    }
  }

  protected async deletePost(post: StreamPost): Promise<void> {
    if (!confirm('Delete this post and its comments?')) return;
    try {
      await this.announcements.removePost(post.id);
      this.posts.update((list) => list.filter((p) => p.id !== post.id));
    } catch (err) {
      console.error('Could not delete the post', err);
      this.error.set('Could not delete the post.');
    }
  }

  protected async addComment(post: StreamPost): Promise<void> {
    const body = this.draft(post.id).trim();
    if (!body) return;
    try {
      const comment = await this.announcements.addComment(post.id, body);
      this.posts.update((list) =>
        list.map((p) => (p.id === post.id ? { ...p, comments: [...p.comments, comment] } : p)),
      );
      this.setDraft(post.id, '');
    } catch (err) {
      console.error('Could not comment', err);
      this.error.set('Could not post the comment. Try again.');
    }
  }

  protected async deleteComment(post: StreamPost, comment: StreamComment): Promise<void> {
    try {
      await this.announcements.removeComment(comment.id);
      this.posts.update((list) =>
        list.map((p) =>
          p.id === post.id ? { ...p, comments: p.comments.filter((c) => c.id !== comment.id) } : p,
        ),
      );
    } catch (err) {
      console.error('Could not delete the comment', err);
      this.error.set('Could not delete the comment.');
    }
  }
}
