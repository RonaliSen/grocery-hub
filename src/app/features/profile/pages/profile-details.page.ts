import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import {
  arrowBackOutline,
  calendarOutline,
  cameraOutline,
  chevronDownOutline,
  closeOutline,
  mailOutline,
  notificationsOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons';

import { UserProfile } from '../../settings/models/profile.model';
import { SettingsService } from '../../settings/services/settings.service';
import { NavigationHistoryService } from '../../../core/services/navigation-history.service';

@Component({
  selector: 'app-profile-details-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonIcon, ReactiveFormsModule],
  template: `
    <ion-content [fullscreen]="true" class="profile-content">
      <div class="profile-page">
        <header class="profile-header">
          <button type="button" class="profile-header__action" aria-label="Go back" (click)="goBack()">
            <ion-icon aria-hidden="true" [icon]="backIcon" />
          </button>

          <div class="profile-header__text">
            <h1 class="profile-header__title">Personal Info</h1>
            <p>Edit your profile</p>
          </div>

          <button type="button" class="profile-header__action" aria-label="Notifications">
            <ion-icon aria-hidden="true" [icon]="bellIcon" />
          </button>
        </header>

        <main class="profile-main">
          <form id="profile-form" class="profile-form" [formGroup]="form" (ngSubmit)="save()">
            <section class="profile-hero" aria-label="Profile summary">
              <div class="hero-dots" aria-hidden="true"></div>
              <div class="profile-hero__avatar-wrap">
                <div
                  class="profile-hero__avatar"
                  [class.profile-hero__avatar--image]="!!photoDataUrl()"
                  [style.background-image]="avatarBackgroundImage()"
                  [attr.role]="photoDataUrl() ? 'button' : null"
                  [attr.tabindex]="photoDataUrl() ? 0 : null"
                  [attr.aria-label]="photoDataUrl() ? 'View profile photo' : null"
                  (click)="openPhotoViewer()"
                  (keydown.enter)="openPhotoViewer()"
                  (keydown.space)="openPhotoViewer(); $event.preventDefault()"
                >
                  @if (!photoDataUrl()) {
                    <span class="profile-hero__placeholder" aria-hidden="true">🙂</span>
                  }
                </div>
                <button type="button" class="profile-hero__edit" aria-label="Edit profile photo" (click)="openGalleryPicker()">
                  <ion-icon aria-hidden="true" [icon]="cameraIcon" />
                </button>
                <input
                  #avatarPicker
                  class="profile-hero__file-input"
                  type="file"
                  accept="image/*"
                  (change)="onAvatarFileSelected($event)"
                />
              </div>
              <div class="profile-hero__identity">
                <p class="profile-hero__eyebrow">Your profile</p>
                <h2 class="profile-hero__name">{{ form.controls.fullName.value || 'Your Name' }}</h2>
                <p class="profile-hero__hint">{{ form.controls.email.value || 'Tap the camera to change your photo' }}</p>
              </div>
            </section>

            <section class="profile-fields">
              <header class="profile-fields__head">
                <span class="profile-fields__icon" aria-hidden="true">🪪</span>
                <div>
                  <h3>About you</h3>
                  <p>Used to personalise your grocery planning.</p>
                </div>
              </header>

              <label class="profile-card" for="fullName">
                <span class="profile-card__label">Name</span>
                <span class="profile-card__input-wrap">
                  <span class="profile-card__icon" aria-hidden="true"><ion-icon [icon]="personIcon" /></span>
                  <input id="fullName" class="profile-card__input" formControlName="fullName" type="text" placeholder="Your full name" />
                </span>
                @if (showError('fullName')) {
                  <p class="profile-card__error">{{ errorMessage('fullName') }}</p>
                }
              </label>

              <div class="profile-fields__row">
                <label class="profile-card" for="age">
                  <span class="profile-card__label">Age</span>
                  <span class="profile-card__input-wrap">
                    <span class="profile-card__icon" aria-hidden="true"><ion-icon [icon]="calendarIcon" /></span>
                    <input
                      id="age"
                      class="profile-card__input"
                      formControlName="age"
                      inputmode="numeric"
                      min="13"
                      max="120"
                      type="number"
                      placeholder="—"
                    />
                  </span>
                  @if (showError('age')) {
                    <p class="profile-card__error">{{ errorMessage('age') }}</p>
                  }
                </label>

                <label class="profile-card" for="householdSize">
                  <span class="profile-card__label">Household Size</span>
                  <span class="profile-card__input-wrap">
                    <span class="profile-card__icon" aria-hidden="true"><ion-icon [icon]="peopleIcon" /></span>
                    <select id="householdSize" class="profile-card__input profile-card__select" formControlName="householdSize">
                      @for (size of householdSizes; track size) {
                        <option [ngValue]="size">{{ size }} {{ size === 1 ? 'Person' : 'Persons' }}</option>
                      }
                    </select>
                    <ion-icon aria-hidden="true" [icon]="chevronIcon" class="profile-card__chevron" />
                  </span>
                  @if (showError('householdSize')) {
                    <p class="profile-card__error">{{ errorMessage('householdSize') }}</p>
                  }
                </label>
              </div>

              <label class="profile-card" for="email">
                <span class="profile-card__label">Email Address</span>
                <span class="profile-card__input-wrap">
                  <span class="profile-card__icon" aria-hidden="true"><ion-icon [icon]="mailIcon" /></span>
                  <input id="email" class="profile-card__input" formControlName="email" inputmode="email" type="email" placeholder="you@example.com" />
                </span>
                @if (showError('email')) {
                  <p class="profile-card__error">{{ errorMessage('email') }}</p>
                }
              </label>
            </section>

            <div class="profile-save-bar">
              <button type="submit" class="profile-save-button" [disabled]="form.invalid || isSaving()">
                {{ isSaving() ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
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
              <input type="range" min="1" max="3" step="0.01" [value]="cropZoom()" (input)="onCropZoomChange($event)" />
            </label>
            <label class="crop-control">
              <span>Horizontal</span>
              <input type="range" min="-100" max="100" step="1" [value]="cropOffsetX()" (input)="onCropOffsetXChange($event)" />
            </label>
            <label class="crop-control">
              <span>Vertical</span>
              <input type="range" min="-100" max="100" step="1" [value]="cropOffsetY()" (input)="onCropOffsetYChange($event)" />
            </label>
            <div class="crop-actions">
              <button type="button" class="crop-btn crop-btn--ghost" (click)="cancelCrop()">Cancel</button>
              <button type="button" class="crop-btn crop-btn--primary" (click)="confirmCrop()">Use Photo</button>
            </div>
          </div>
        </div>
      }

      @if (photoViewerOpen()) {
        <div class="photo-viewer-overlay" role="dialog" aria-label="Profile photo" (click)="closePhotoViewer()">
          <button type="button" class="photo-viewer-close" aria-label="Close" (click)="closePhotoViewer()">
            <ion-icon aria-hidden="true" [icon]="closeIcon" />
          </button>
          @if (photoDataUrl()) {
            <img class="photo-viewer-img" [src]="photoDataUrl()!" alt="Profile photo" (click)="$event.stopPropagation()" />
          }
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      /* Personal Info — "Citrus & Ink" (tokens from src/theme/citrus.scss). */
      :host {
        display: block;
        min-height: 100%;
      }

      ion-icon {
        flex-shrink: 0;
      }

      .profile-content::part(background) {
        background: var(--h-canvas);
      }

      .profile-page {
        min-height: 100%;
      }

      /* Header */
      .profile-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        grid-template-columns: 44px minmax(0, 1fr) 44px;
        align-items: center;
        gap: 12px;
        padding: calc(env(safe-area-inset-top, 0px) + 12px) var(--h-gutter) 12px;
        padding-inline: max(var(--h-gutter), calc((100% - 40rem) / 2 + var(--h-gutter)));
        background: color-mix(in srgb, var(--h-canvas) 88%, transparent);
        backdrop-filter: blur(18px);
      }

      .profile-header__action {
        width: 44px;
        height: 44px;
        padding: 0;
        border: 1px solid var(--h-line);
        border-radius: 50%;
        background: var(--h-surface);
        color: var(--h-ink);
        display: grid;
        place-items: center;
        font-size: 20px;
      }

      .profile-header__text {
        text-align: center;
      }

      .profile-header__title {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--h-ink);
      }

      .profile-header__text p {
        margin: 2px 0 0;
        font-size: 0.76rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .profile-main {
        width: min(100%, 40rem);
        margin: 0 auto;
        padding: 4px var(--h-gutter) 0;
      }

      .profile-form {
        display: grid;
        gap: 16px;
      }

      /* Hero */
      .profile-hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: flex;
        align-items: center;
        gap: 18px;
        padding: 22px;
        border-radius: 30px;
        color: #ffffff;
        background:
          radial-gradient(70% 80% at 100% 100%, rgba(255, 106, 61, 0.5), transparent 70%),
          radial-gradient(45% 55% at 0% 0%, rgba(201, 184, 255, 0.22), transparent 70%),
          var(--h-hero-bg);
        outline: 1px solid var(--h-hero-border);
        outline-offset: -1px;
        box-shadow: 0 24px 40px -24px rgba(22, 20, 29, 0.6);
      }

      .hero-dots {
        position: absolute;
        z-index: -1;
        inset: 0 0 auto auto;
        width: 55%;
        height: 80%;
        background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.4px);
        background-size: 14px 14px;
        mask-image: linear-gradient(225deg, #000 10%, transparent 70%);
      }

      .profile-hero__avatar-wrap {
        position: relative;
        flex-shrink: 0;
        padding: 4px;
        border-radius: 50%;
        background: conic-gradient(from 200deg, var(--h-sun), var(--h-accent), var(--h-lilac), var(--h-sun));
      }

      .profile-hero__avatar {
        width: clamp(92px, 28vw, 120px);
        aspect-ratio: 1;
        border-radius: 50%;
        border: 4px solid var(--h-hero-bg);
        display: grid;
        place-items: center;
        background: var(--h-tile-1);
        background-size: cover;
        background-position: center;
      }

      .profile-hero__avatar--image {
        cursor: pointer;
      }

      .profile-hero__placeholder {
        font-size: 2.6rem;
      }

      .profile-hero__edit {
        position: absolute;
        right: -2px;
        bottom: 2px;
        width: 40px;
        height: 40px;
        padding: 0;
        border: 3px solid var(--h-hero-bg);
        border-radius: 50%;
        background: var(--h-accent);
        color: #ffffff;
        display: grid;
        place-items: center;
        font-size: 18px;
      }

      .profile-hero__file-input {
        display: none;
      }

      .profile-hero__identity {
        min-width: 0;
      }

      .profile-hero__eyebrow {
        display: inline-block;
        margin: 0 0 8px;
        padding: 4px 10px;
        border-radius: 9px;
        background: var(--h-lilac);
        color: #16141d;
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        transform: rotate(-3deg);
      }

      .profile-hero__name {
        margin: 0;
        font-size: clamp(1.4rem, 6vw, 1.9rem);
        font-weight: 800;
        line-height: 1.1;
        letter-spacing: -0.035em;
        color: #ffffff;
        overflow-wrap: anywhere;
      }

      .profile-hero__hint {
        margin: 4px 0 0;
        font-size: 0.8rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.7);
        overflow-wrap: anywhere;
      }

      /* Fields */
      .profile-fields {
        display: grid;
        gap: 16px;
        padding: 18px;
        border-radius: 26px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .profile-fields__head {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .profile-fields__icon {
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-tile-3);
        font-size: 1.2rem;
        transform: rotate(-6deg);
      }

      .profile-fields__head h3 {
        margin: 0;
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .profile-fields__head p {
        margin: 2px 0 0;
        font-size: 0.78rem;
        color: var(--h-muted);
      }

      .profile-fields__row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .profile-card {
        min-width: 0;
        display: grid;
        gap: 8px;
      }

      .profile-card__label {
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .profile-card__input-wrap {
        position: relative;
        display: flex;
        align-items: center;
        min-height: 54px;
        border: 1px solid var(--h-line);
        border-radius: 18px;
        background: var(--h-canvas);
      }

      .profile-card__input-wrap:focus-within {
        border-color: var(--h-accent);
        box-shadow: 0 0 0 4px var(--h-accent-glow);
      }

      .profile-card__icon {
        position: absolute;
        left: 8px;
        width: 36px;
        height: 36px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        color: var(--h-ink-soft);
        font-size: 17px;
        pointer-events: none;
      }

      .profile-card__input {
        width: 100%;
        min-width: 0;
        height: 52px;
        padding: 0 14px 0 54px;
        border: none;
        border-radius: inherit;
        background: transparent;
        color: var(--h-ink);
        font-size: 0.95rem;
        font-weight: 700;
        appearance: none;
      }

      .profile-card__input::placeholder {
        color: var(--h-muted);
        font-weight: 500;
      }

      .profile-card__select {
        padding-right: 36px;
      }

      .profile-card__chevron {
        position: absolute;
        right: 12px;
        color: var(--h-muted);
        font-size: 16px;
        pointer-events: none;
      }

      /* The wrapper draws the ring; beat the global input:not(…):focus rule (0,5,1). */
      :host .profile-card .profile-card__input-wrap .profile-card__input:focus {
        outline: none;
        box-shadow: none;
      }

      .profile-card__input::-webkit-outer-spin-button,
      .profile-card__input::-webkit-inner-spin-button {
        margin: 0;
        -webkit-appearance: none;
      }

      .profile-card__error {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-danger);
      }

      /* Sticky save */
      .profile-save-bar {
        position: sticky;
        bottom: 0;
        z-index: 10;
        margin: 0 calc(var(--h-gutter) * -1);
        padding: 12px var(--h-gutter) calc(12px + env(safe-area-inset-bottom, 0px));
        background: color-mix(in srgb, var(--h-canvas) 88%, transparent);
        backdrop-filter: blur(18px);
        border-top: 1px solid var(--h-line);
      }

      .profile-save-button {
        width: 100%;
        min-height: 54px;
        border: none;
        border-radius: 999px;
        background: var(--h-accent);
        color: #ffffff;
        font-size: 0.98rem;
        font-weight: 800;
        box-shadow: 0 12px 24px -12px var(--h-accent-glow);
        transition: transform 140ms ease, opacity 160ms ease;
      }

      .profile-save-button:active:not(:disabled) {
        transform: scale(0.98);
      }

      .profile-save-button:disabled {
        opacity: 0.45;
        box-shadow: none;
      }

      /* Crop modal */
      .crop-overlay {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(22, 20, 29, 0.6);
        backdrop-filter: blur(6px);
      }

      .crop-modal {
        width: min(100%, 380px);
        display: grid;
        gap: 14px;
        padding: 20px;
        border-radius: 28px;
        background: var(--h-surface);
        color: var(--h-ink);
        box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.5);
      }

      .crop-modal h3 {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .crop-preview {
        position: relative;
        width: 100%;
        aspect-ratio: 1;
        border-radius: 50%;
        overflow: hidden;
        background: var(--h-canvas);
        outline: 3px solid var(--h-accent);
        outline-offset: 3px;
      }

      .crop-preview img {
        position: absolute;
        top: 50%;
        left: 50%;
        min-width: 100%;
        min-height: 100%;
        object-fit: cover;
      }

      .crop-control {
        display: grid;
        gap: 6px;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .crop-control input {
        width: 100%;
        accent-color: var(--h-accent);
      }

      .crop-actions {
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: 10px;
      }

      .crop-btn {
        min-height: 50px;
        border-radius: 999px;
        font-size: 0.92rem;
        font-weight: 800;
      }

      .crop-btn--ghost {
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        color: var(--h-ink);
      }

      .crop-btn--primary {
        border: none;
        background: var(--h-accent);
        color: #ffffff;
      }

      /* Photo viewer */
      .photo-viewer-overlay {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(22, 20, 29, 0.88);
        backdrop-filter: blur(6px);
      }

      .photo-viewer-img {
        width: min(100%, 420px);
        aspect-ratio: 1;
        object-fit: cover;
        border-radius: 32px;
        box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.7);
      }

      .photo-viewer-close {
        position: absolute;
        top: calc(env(safe-area-inset-top, 0px) + 16px);
        right: 16px;
        width: 44px;
        height: 44px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
        display: grid;
        place-items: center;
        font-size: 22px;
      }

      @media (max-width: 374px) {
        .profile-fields__row {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDetailsPage {
  @ViewChild('avatarPicker')
  private readonly avatarPicker?: ElementRef<HTMLInputElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly router = inject(Router);
  private readonly settingsService = inject(SettingsService);
  private readonly profile = this.settingsService.settings().profile;

  protected readonly backIcon = arrowBackOutline;
  protected readonly bellIcon = notificationsOutline;
  protected readonly cameraIcon = cameraOutline;
  protected readonly personIcon = personOutline;
  protected readonly calendarIcon = calendarOutline;
  protected readonly mailIcon = mailOutline;
  protected readonly peopleIcon = peopleOutline;
  protected readonly chevronIcon = chevronDownOutline;
  protected readonly closeIcon = closeOutline;
  protected readonly isSaving = signal(false);
  protected readonly submitted = signal(false);
  protected readonly photoDataUrl = signal<string | null>(this.profile.photoDataUrl ?? null);
  protected readonly photoViewerOpen = signal(false);
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

  protected openPhotoViewer(): void {
    if (!this.photoDataUrl()) {
      return;
    }

    this.photoViewerOpen.set(true);
  }

  protected closePhotoViewer(): void {
    this.photoViewerOpen.set(false);
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
