import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/auth/auth.service';

type AccountType = 'student' | 'staff';

interface AccountOption {
  value: AccountType;
  label: string;
  domain: string;
}

interface Slide {
  caption: string;
  bg: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatButtonModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  // Account type = which email domain is accepted. The real role still comes
  // from the account in Supabase (auth.role()), not from this dropdown.
  protected readonly accountOptions: AccountOption[] = [
    { value: 'student', label: 'Student', domain: 'iskolarngbayan.pup.edu.ph' },
    { value: 'staff', label: 'Teacher / Admin', domain: 'pup.edu.ph' },
  ];
  protected readonly accountType = signal<AccountType>('student');
  protected readonly domain = computed(
    () => this.accountOptions.find((o) => o.value === this.accountType())!.domain,
  );
  protected readonly hidePassword = signal(true);

  // Sign-in feedback: spinner while waiting, error text, fade-out before navigating
  protected readonly loading = signal(false);
  protected readonly leaving = signal(false);
  protected readonly errorMessage = signal('');

  // Username only is expected, but a pasted full address is accepted
  // as long as its domain matches the selected account type.
  private readonly usernameRule: ValidatorFn = (
    control: AbstractControl,
  ): ValidationErrors | null => {
    const value = String(control.value ?? '')
      .trim()
      .toLowerCase();
    if (!value.includes('@')) return null; // 'required' covers empty
    const at = value.lastIndexOf('@');
    const local = value.slice(0, at);
    const host = value.slice(at + 1);
    return local && host === this.domain() ? null : { domainMismatch: true };
  };

  protected readonly form = this.fb.group({
    username: ['', [Validators.required, this.usernameRule]],
    password: ['', Validators.required],
  });

  // Landing slideshow. Photos live in frontend/public/assets/images/.
  // To add a slide, add one more object to this array.
  protected readonly slides: Slide[] = [
    {
      caption: 'Your classes, all in one place.',
      bg: "url('/assets/images/1.jpg')",
    },
    {
      caption: 'Materials, activities and grades, together.',
      bg: "url('/assets/images/2.jpg')",
    },
    {
      caption: 'Submit your work and track your progress.',
      bg: "url('/assets/images/3.jpg')",
    },
    {
      caption: 'Built for PUP CCIS.',
      bg: "url('/assets/images/4.jpg')",
    },
  ];

  protected readonly current = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  protected goTo(index: number): void {
    this.current.set(index);
    this.startTimer(); // restart so the slide you picked stays for a full interval
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = setInterval(() => this.current.update((i) => (i + 1) % this.slides.length), 5000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
  }

  protected onAccountTypeChange(value: AccountType): void {
    this.accountType.set(value);
    // re-check the username against the newly selected domain
    this.form.controls.username.updateValueAndValidity();
  }

  // Browser autofill (or a paste) can fill the whole address. If its domain
  // matches an account type, switch the dropdown to it and keep only the username.
  protected onUsernameInput(): void {
    const control = this.form.controls.username;
    const value = String(control.value ?? '')
      .trim()
      .toLowerCase();
    const at = value.lastIndexOf('@');
    if (at < 1) return;
    const match = this.accountOptions.find((o) => o.domain === value.slice(at + 1));
    if (!match) return; // unknown domain: leave it, the field shows an error
    this.accountType.set(match.value);
    control.setValue(value.slice(0, at));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private showError(): void {
    this.errorMessage.set('Could not sign in. Check your details and try again.');
    this.loading.set(false);
    this.form.enable();
  }

  // Fade the page out, then go to the next route
  private async goNext(path: string): Promise<void> {
    this.leaving.set(true);
    await this.wait(350);
    await this.router.navigate([path]);
  }

  // Make this async because signInWithEmail is a Promise
  protected async submit(): Promise<void> {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const username = (this.form.value.username || '').trim().toLowerCase();
    const email = username.includes('@') ? username : `${username}@${this.domain()}`;
    const password = this.form.value.password || '';

    this.errorMessage.set('');
    this.loading.set(true);
    this.form.disable();

    try {
      // 1. Call the service to log in (this sets the profile signal)
      await this.auth.signInWithEmail(email, password);

      // 2. Check the role
      const role = this.auth.role();

      // 3. Route based on the role
      if (role === 'teacher') {
        await this.goNext('/courses');
      } else if (role === 'admin') {
        await this.goNext('/admin');
      } else {
        await this.goNext('/dashboard');
      }
    } catch {
      this.showError();
    }
  }

  protected async google(): Promise<void> {
    if (this.loading()) return;
    this.errorMessage.set('');
    this.loading.set(true);
    this.form.disable();

    try {
      await this.auth.signInWithGoogle();
      await this.goNext('/dashboard'); // Google mock defaults to student
    } catch {
      this.showError();
    }
  }
}
