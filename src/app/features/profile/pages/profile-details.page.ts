import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { UserProfile } from '../../settings/models/profile.model';
import { SettingsService } from '../../settings/services/settings.service';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';

@Component({
  selector: 'app-profile-details-page',
  standalone: true,
  imports: [IonContent, ReactiveFormsModule],
  template: `
    <ion-content [fullscreen]="true" class="profile-content">
      <div class="profile-page">
        <header class="profile-header">
          <button type="button" class="profile-header__action" aria-label="Go back" (click)="goBack()">
            <span aria-hidden="true" class="material-symbols-outlined">arrow_back</span>
          </button>

          <h1 class="profile-header__title">Personal Info</h1>

          <button type="button" class="profile-header__action" aria-label="Notifications">
            <span aria-hidden="true" class="material-symbols-outlined">notifications</span>
          </button>
        </header>

        <main class="profile-main">
          <form id="profile-form" class="profile-form" [formGroup]="form" (ngSubmit)="save()">
            <section class="profile-hero" aria-label="Profile summary">
              <div class="profile-hero__avatar-wrap">
                <div
                  class="profile-hero__avatar"
                  [class.profile-hero__avatar--image]="!!photoDataUrl()"
                  [style.background-image]="avatarBackgroundImage()"
                  aria-hidden="true"
                ></div>
                <button type="button" class="profile-hero__edit" aria-label="Edit profile photo" (click)="openGalleryPicker()">
                  <span aria-hidden="true" class="material-symbols-outlined">edit</span>
                </button>
                <input
                  #avatarPicker
                  class="profile-hero__file-input"
                  type="file"
                  accept="image/*"
                  (change)="onAvatarFileSelected($event)"
                />
              </div>
              <h2 class="profile-hero__name">{{ form.controls.fullName.value || 'Your Name' }}</h2>
            </section>

            <section class="profile-fields">
              <label class="profile-card" for="fullName">
                <span class="profile-card__label">Name</span>
                <span class="profile-card__input-wrap">
                  <input id="fullName" class="profile-card__input" formControlName="fullName" type="text" />
                  <span aria-hidden="true" class="material-symbols-outlined profile-card__icon">person</span>
                </span>
                @if (showError('fullName')) {
                  <p class="profile-card__error">{{ errorMessage('fullName') }}</p>
                }
              </label>

              <label class="profile-card" for="age">
                <span class="profile-card__label">Age</span>
                <span class="profile-card__input-wrap">
                  <input
                    id="age"
                    class="profile-card__input"
                    formControlName="age"
                    inputmode="numeric"
                    min="13"
                    max="120"
                    type="number"
                  />
                  <span aria-hidden="true" class="material-symbols-outlined profile-card__icon">calendar_month</span>
                </span>
                @if (showError('age')) {
                  <p class="profile-card__error">{{ errorMessage('age') }}</p>
                }
              </label>

              <label class="profile-card" for="email">
                <span class="profile-card__label">Email Address</span>
                <span class="profile-card__input-wrap">
                  <input id="email" class="profile-card__input" formControlName="email" inputmode="email" type="email" />
                  <span aria-hidden="true" class="material-symbols-outlined profile-card__icon">mail</span>
                </span>
                @if (showError('email')) {
                  <p class="profile-card__error">{{ errorMessage('email') }}</p>
                }
              </label>

              <label class="profile-card" for="householdSize">
                <span class="profile-card__label">Household Size</span>
                <span class="profile-card__input-wrap profile-card__input-wrap--select">
                  <select id="householdSize" class="profile-card__input profile-card__select" formControlName="householdSize">
                    @for (size of householdSizes; track size) {
                      <option [ngValue]="size">{{ size }} {{ size === 1 ? 'Person' : 'Persons' }}</option>
                    }
                  </select>
                  <span aria-hidden="true" class="material-symbols-outlined profile-card__icon profile-card__icon--arrow">expand_more</span>
                  <span aria-hidden="true" class="material-symbols-outlined profile-card__icon">groups_2</span>
                </span>
                @if (showError('householdSize')) {
                  <p class="profile-card__error">{{ errorMessage('householdSize') }}</p>
                }
              </label>

              <button type="submit" class="app-button--premium-primary profile-save-button" [disabled]="form.invalid || isSaving()">
                {{ isSaving() ? 'Saving...' : 'Save Changes' }}
              </button>
            </section>
          </form>
        </main>
      </div>

      @if (cropModalOpen()) {
        <div class="crop-overlay" role="dialog" aria-label="Crop profile photo">
          <div class="crop-modal">
            <h3>Crop Profile Photo</h3>
            <div class="crop-preview" aria-label="Crop preview area">
              @if (cropImageSource()) {
                <img
                  [src]="cropImageSource()!"
                  alt="Crop preview"
                  [style.transform]="cropImageTransform()"
                />
              }
            </div>

            <label class="crop-control">
              <span>Zoom</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                [value]="cropZoom()"
                (input)="onCropZoomChange($event)"
              />
            </label>

            <label class="crop-control">
              <span>Horizontal</span>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                [value]="cropOffsetX()"
                (input)="onCropOffsetXChange($event)"
              />
            </label>

            <label class="crop-control">
              <span>Vertical</span>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                [value]="cropOffsetY()"
                (input)="onCropOffsetYChange($event)"
              />
            </label>

            <div class="crop-actions">
              <button type="button" class="crop-btn crop-btn--ghost" (click)="cancelCrop()">Cancel</button>
              <button type="button" class="crop-btn crop-btn--primary" (click)="confirmCrop()">Use Photo</button>
            </div>
          </div>
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
      }

      .profile-content {
        --background: #ecedf4;
      }

      .profile-page {
        min-height: 100%;
        background: #ecedf4;
        padding-bottom: calc(env(safe-area-inset-bottom, 0) + 8.5rem);
      }

      .profile-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        grid-template-columns: 3rem minmax(0, 1fr) 3rem;
        align-items: center;
        gap: 0.75rem;
        padding: calc(env(safe-area-inset-top, 0) + 1rem) 1.5rem 1rem;
        background: #f8f9ff;
        border-bottom: 1px solid #c5d5cc;
      }

      .profile-header__action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: #1f513c;
      }

      .profile-header__title {
        margin: 0;
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        font-size: clamp(1.55rem, 5.4vw, 2rem);
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.01em;
        color: #0a8f5b;
      }

      .profile-main {
        display: grid;
        gap: 1.5rem;
        padding: 1.25rem 1rem 2rem;
      }

      .profile-form {
        display: grid;
        gap: 1.25rem;
      }

      .profile-hero {
        display: grid;
        justify-items: center;
        gap: 0.4rem;
        margin: 0.25rem 0 0.75rem;
      }

      .profile-hero__avatar-wrap {
        position: relative;
        padding: 0.42rem;
        border-radius: 50%;
        background: linear-gradient(145deg, #ffffff 10%, #edf3ff 54%, #f8efe9 100%);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
      }

      .profile-hero__avatar {
        width: clamp(8.75rem, 34vw, 11rem);
        aspect-ratio: 1;
        border-radius: 50%;
        border: 4px solid #fbfdff;
        background:
          radial-gradient(circle at 45% 31%, #f1dfd3 10%, #cea486 26%, #2b3630 62%, transparent 65%),
          linear-gradient(145deg, #345843, #1f382c);
        background-size: cover;
        background-position: center;
      }

      .profile-hero__avatar--image {
        border-color: #ffffff;
      }

      .profile-hero__edit {
        position: absolute;
        right: -0.2rem;
        bottom: 0.3rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 3.2rem;
        height: 3.2rem;
        border: none;
        border-radius: 999px;
        color: #fff;
        background: #006c49;
      }

      .profile-hero__name {
        margin: 0.95rem 0 0;
        color: #08152b;
        font-size: clamp(1.6rem, 6vw, 2rem);
        font-weight: 700;
      }

      .profile-hero__file-input {
        display: none;
      }

      .profile-fields {
        display: grid;
        gap: 1rem;
      }
      .crop-overlay {
        position: fixed;
        inset: 0;
        z-index: 200;
        display: grid;
        align-items: end;
        padding: 0.75rem;
        background: rgba(7, 22, 25, 0.52);
        backdrop-filter: blur(2px);
      }
      .crop-modal {
        width: min(100%, 32rem);
        margin-inline: auto;
        padding: calc(env(safe-area-inset-top, 0) + 1rem) 1rem calc(env(safe-area-inset-bottom, 0) + 1rem);
        display: grid;
        gap: 0.9rem;
        border-radius: 1.25rem;
        border: 1px solid #d9e4dd;
        background: #f9fcfa;
        box-shadow: 0 18px 38px rgba(8, 21, 43, 0.26);
      }

      .crop-modal h3 {
        margin: 0;
        color: #08152b;
      }

      .crop-preview {
        width: min(82vw, 320px);
        aspect-ratio: 1;
        border-radius: 1rem;
        overflow: hidden;
        margin-inline: auto;
        border: 1px solid #d8e1dd;
        background:
          linear-gradient(45deg, #f2f7f4 25%, transparent 25%) 0 0 / 18px 18px,
          linear-gradient(-45deg, #f2f7f4 25%, transparent 25%) 0 0 / 18px 18px,
          linear-gradient(45deg, transparent 75%, #f2f7f4 75%) 0 0 / 18px 18px,
          linear-gradient(-45deg, transparent 75%, #f2f7f4 75%) 0 0 / 18px 18px,
          #e8efeb;
        position: relative;
      }

      .crop-preview img {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .crop-control {
        display: grid;
        gap: 0.4rem;
        color: #1f513c;
        font-size: 0.9rem;
        font-weight: 600;
      }

      .crop-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.7rem;
      }

      .crop-btn {
        min-height: 2.8rem;
        border-radius: 999px;
        border: 1px solid #c7d5ce;
        font-weight: 700;
      }

      .crop-btn--ghost {
        background: #fff;
        color: #1b3f30;
      }

      .crop-btn--primary {
        background: #0b7a4f;
        border-color: #0b7a4f;
        color: #fff;
      }

      .profile-card {
        display: grid;
        gap: 0.7rem;
        padding: 0.95rem 1rem 0.8rem;
        border-radius: 1.25rem;
        border: 1px solid #a8beb1;
        background: #f7f9f8;
      }

      .profile-card__label {
        color: #0b7651;
        font-family: Inter, sans-serif;
        font-size: 0.82rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        text-transform: none;
      }

      .profile-card__input-wrap {
        position: relative;
        display: block;
      }

      .profile-card__input {
        width: 100%;
        border: none;
        background: transparent;
        color: #07162f;
        font-family: Inter, sans-serif;
        font-size: 1.35rem;
        font-weight: 500;
        line-height: 1.2;
        padding: 0 2.8rem 0.1rem 0;
      }

      .profile-card__input:focus,
      .profile-card__input:focus-visible,
      .profile-card__select:focus,
      .profile-card__select:focus-visible {
        outline: none !important;
        box-shadow: none !important;
      }

      .profile-card__input::-webkit-outer-spin-button,
      .profile-card__input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }

      .profile-card__input[type='number'] {
        -moz-appearance: textfield;
      }

      .profile-card__icon {
        position: absolute;
        right: 0.3rem;
        bottom: 0.1rem;
        color: #aec0b4;
        font-size: 1.65rem;
      }

      .profile-card__input-wrap--select .profile-card__icon--arrow {
        right: 2rem;
        color: #6a7281;
      }

      .profile-card__select {
        appearance: none;
        padding-right: 5rem;
      }

      .profile-card__error {
        margin: 0;
        color: #ba1a1a;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .profile-header__action:disabled,
      .profile-save-button:disabled {
        opacity: 0.56;
      }

      .profile-save-button {
        margin-top: 0.5rem;
        width: 100%;
        min-height: 3.5rem;
        border-radius: 999px;
        font-size: 1rem;
        font-weight: 700;
      }

      @media (max-width: 480px) {
        .profile-header {
          padding-inline: 1rem;
        }

        .profile-main {
          padding-inline: 0.75rem;
        }

        .profile-card {
          padding-inline: 0.9rem;
        }

        .profile-card__input {
          font-size: 1.2rem;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileDetailsPage {
  @ViewChild('avatarPicker')
  private readonly avatarPicker?: ElementRef<HTMLInputElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);
  private readonly settingsService = inject(SettingsService);
  private readonly profile = this.settingsService.settings().profile;

  protected readonly isSaving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly photoDataUrl = signal<string | null>(this.profile.photoDataUrl ?? null);
  protected readonly cropModalOpen = signal(false);
  protected readonly cropImageSource = signal<string | null>(null);
  protected readonly cropZoom = signal(1);
  protected readonly cropOffsetX = signal(0);
  protected readonly cropOffsetY = signal(0);
  protected readonly householdSizes = Array.from({ length: 20 }, (_, i) => i + 1);
  protected readonly avatarBackgroundImage = computed(() =>
    this.photoDataUrl() ? `url("${this.photoDataUrl()}")` : null
  );
  protected readonly cropImageTransform = computed(
    () =>
      `translate(calc(-50% + ${this.cropOffsetX()}px), calc(-50% + ${this.cropOffsetY()}px)) scale(${this.cropZoom()})`
  );
  protected readonly form = this.formBuilder.group({
    fullName: this.formBuilder.nonNullable.control(this.profile.fullName, [
      Validators.required,
      Validators.pattern(/\S(?:.*\S)?/)
    ]),
    age: this.formBuilder.control<number | null>(this.profile.age, [Validators.min(13), Validators.max(120)]),
    email: this.formBuilder.nonNullable.control(this.profile.email, [Validators.email]),
    householdSize: this.formBuilder.control<number | null>(this.profile.householdSize, [
      Validators.min(1),
      Validators.max(20)
    ]),
    preferredShoppingFrequency: this.formBuilder.nonNullable.control(this.profile.preferredShoppingFrequency),
    defaultUnitPreference: this.formBuilder.nonNullable.control(this.profile.defaultUnitPreference)
  });

  protected async save(): Promise<void> {
    this.submitted.set(true);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);

    try {
      const rawValue = this.form.getRawValue();
      const profile: UserProfile = {
        fullName: rawValue.fullName.trim(),
        age: rawValue.age,
        email: rawValue.email.trim(),
        householdSize: rawValue.householdSize,
        photoDataUrl: this.photoDataUrl(),
        preferredShoppingFrequency: rawValue.preferredShoppingFrequency,
        defaultUnitPreference: rawValue.defaultUnitPreference
      };

      await this.settingsService.update({ profile });
      await this.navigationHistory.back('/tabs/home');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected goBack(): void {
    void this.navigationHistory.back('/tabs/home');
  }

  protected openGalleryPicker(): void {
    this.avatarPicker?.nativeElement.click();
  }

  protected onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : null;
      this.cropImageSource.set(dataUrl);
      this.cropZoom.set(1);
      this.cropOffsetX.set(0);
      this.cropOffsetY.set(0);
      this.cropModalOpen.set(!!dataUrl);
      input.value = '';
    };
    reader.onerror = () => {
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  protected onCropZoomChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.cropZoom.set(Number.isFinite(value) ? value : 1);
  }

  protected onCropOffsetXChange(event: Event): void {
    this.cropOffsetX.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected onCropOffsetYChange(event: Event): void {
    this.cropOffsetY.set(Number((event.target as HTMLInputElement).value) || 0);
  }

  protected cancelCrop(): void {
    this.cropModalOpen.set(false);
    this.cropImageSource.set(null);
    this.cropZoom.set(1);
    this.cropOffsetX.set(0);
    this.cropOffsetY.set(0);
  }

  protected async confirmCrop(): Promise<void> {
    const source = this.cropImageSource();
    if (!source) {
      this.cancelCrop();
      return;
    }

    const croppedDataUrl = await this.generateCroppedImage(source);
    if (croppedDataUrl) {
      this.photoDataUrl.set(croppedDataUrl);
    }
    this.cancelCrop();
  }

  private async generateCroppedImage(source: string): Promise<string | null> {
    const image = await this.loadImage(source);
    if (!image) {
      return null;
    }

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    const zoom = Math.max(1, this.cropZoom());
    const scale = zoom * Math.max(size / image.width, size / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;

    let dx = (size - drawWidth) / 2;
    let dy = (size - drawHeight) / 2;

    const maxShiftX = Math.max(0, (drawWidth - size) / 2);
    const maxShiftY = Math.max(0, (drawHeight - size) / 2);

    dx += (this.cropOffsetX() / 100) * maxShiftX;
    dy += (this.cropOffsetY() / 100) * maxShiftY;

    context.drawImage(image, dx, dy, drawWidth, drawHeight);
    return canvas.toDataURL('image/jpeg', 0.92);
  }

  private loadImage(source: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = source;
    });
  }

  protected showError(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return !!control.errors && (control.touched || this.submitted());
  }

  protected errorMessage(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];

    if (control.errors?.['required']) {
      return 'Name is required.';
    }

    if (controlName === 'fullName' && control.errors?.['pattern']) {
      return 'Name is required.';
    }

    if (control.errors?.['email']) {
      return 'Enter a valid email address.';
    }

    if (controlName === 'age' && (control.errors?.['min'] || control.errors?.['max'])) {
      return 'Enter an age between 13 and 120.';
    }

    if (controlName === 'householdSize' && (control.errors?.['min'] || control.errors?.['max'])) {
      return 'Enter a household size between 1 and 20.';
    }

    return 'Check this field and try again.';
  }
}
