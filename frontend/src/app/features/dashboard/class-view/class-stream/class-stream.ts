import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../../core/auth/auth.service';
import { Announcements, StreamComment, StreamPost } from '../../../../core/services/announcements';

/** Announcements of one section for a student: read posts, comment, delete own comments. */
@Component({
  selector: 'app-class-stream',
  imports: [DatePipe, MatIconModule],
  template: `
    <section class="panel">
      <div class="panel-head">
        <mat-icon>campaign</mat-icon>
        <h2>Announcements</h2>
      </div>
      <div class="panel-body">
        @if (error()) {
          <p class="msg error" role="alert">{{ error() }}</p>
        }
        @if (loading()) {
          <p class="msg">Loading announcements…</p>
        } @else if (posts().length === 0) {
          <p class="msg">No announcements yet.</p>
        }

        @for (post of posts(); track post.id) {
          <article class="post">
            <header>
              <strong>{{ teacherName() }}</strong>
              <span class="when">{{ post.createdAt | date: 'MMM d, y, h:mm a' }}</span>
            </header>
            <p class="body">{{ post.body }}</p>

            @for (comment of post.comments; track comment.id) {
              <div class="comment">
                <div class="meta">
                  <strong>{{ comment.authorName }}</strong>
                  <span class="when">{{ comment.createdAt | date: 'MMM d, y, h:mm a' }}</span>
                  @if (isMine(comment)) {
                    <button type="button" class="link" (click)="deleteComment(post, comment)">
                      Delete
                    </button>
                  }
                </div>
                <p class="body">{{ comment.body }}</p>
              </div>
            }

            <div class="add">
              <input
                type="text"
                placeholder="Add a comment..."
                maxlength="2000"
                [value]="draft(post.id)"
                (input)="setDraft(post.id, $any($event.target).value)"
                (keyup.enter)="addComment(post)"
              />
              <button
                type="button"
                class="send"
                (click)="addComment(post)"
                [disabled]="!draft(post.id).trim()"
              >
                Post
              </button>
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
    .post {
      padding: 16px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .post:last-child {
      border-bottom: 0;
    }
    header,
    .meta {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }
    .when {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.8rem;
    }
    .body {
      margin: 6px 0 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .comment {
      margin: 12px 0 0 16px;
      padding-left: 12px;
      border-left: 2px solid var(--mat-sys-outline-variant);
    }
    .add {
      display: flex;
      gap: 8px;
      margin: 14px 0 0 16px;
    }
    .add input {
      flex: 1;
      min-width: 0;
      padding: 8px 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
      font: inherit;
    }
    .send,
    .link {
      border: 0;
      background: none;
      font: inherit;
      font-weight: 600;
      color: var(--mat-sys-primary);
      cursor: pointer;
    }
    .send:disabled {
      opacity: 0.4;
      cursor: default;
    }
    .link {
      padding: 0;
      font-size: 0.8rem;
      text-decoration: underline;
    }
  `,
})
export class ClassStream implements OnInit {
  private readonly announcements = inject(Announcements);
  private readonly auth = inject(AuthService);

  readonly sectionId = input.required<string>();

  protected readonly posts = signal<StreamPost[]>([]);
  protected readonly teacherName = signal('Teacher');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly drafts = signal<Record<string, string>>({});

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [posts, name] = await Promise.all([
        this.announcements.list(this.sectionId()),
        this.announcements.teacherName(this.sectionId()),
      ]);
      this.posts.set(posts);
      this.teacherName.set(name);
    } catch (err) {
      console.error('Could not load announcements', err);
      this.error.set('Could not load announcements.');
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

  protected isMine(comment: StreamComment): boolean {
    return comment.authorId === this.auth.userId();
  }

  protected async addComment(post: StreamPost): Promise<void> {
    const body = this.draft(post.id).trim();
    if (!body) return;
    this.error.set('');
    try {
      const comment = await this.announcements.addComment(post.id, body);
      this.posts.update((list) =>
        list.map((p) => (p.id === post.id ? { ...p, comments: [...p.comments, comment] } : p)),
      );
      this.setDraft(post.id, '');
    } catch (err) {
      console.error('Could not comment', err);
      this.error.set('Could not post your comment. Try again.');
    }
  }

  protected async deleteComment(post: StreamPost, comment: StreamComment): Promise<void> {
    this.error.set('');
    try {
      await this.announcements.removeComment(comment.id);
      this.posts.update((list) =>
        list.map((p) =>
          p.id === post.id ? { ...p, comments: p.comments.filter((c) => c.id !== comment.id) } : p,
        ),
      );
    } catch (err) {
      console.error('Could not delete the comment', err);
      this.error.set('Could not delete your comment.');
    }
  }
}
