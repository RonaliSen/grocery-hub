import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { personCircleOutline } from 'ionicons/icons';

import { NotificationsService } from '../../../core/services/notifications.service';
import { ReminderSettings } from '../../reminders/models/reminder-settings.model';
import { AppSettings } from '../models/app-settings.model';
import { UserProfile } from '../models/profile.model';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [IonContent, IonIcon, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="account-content">
      <div class="account-page">
        <header class="account-header">
          <div class="account-header__brand" aria-label="Account">
            <ion-icon aria-hidden="true" [icon]="accountIcon" class="account-header__title-icon" />
            <h1 class="account-header__title">Account</h1>
          </div>

          <button
            type="button"
            class="account-header__icon-button"
            aria-label="Notifications"
            [routerLink]="['/tabs/settings/reminders']"
          >
            <span aria-hidden="true" class="material-symbols-outlined">notifications</span>
          </button>
        </header>

        <main class="account-main">
          <section class="profile-hero" aria-label="Account profile summary">
            <div class="profile-hero__avatar-wrap">
              <div
                class="profile-hero__avatar"
                [class.profile-hero__avatar--image]="!!profilePhotoDataUrl()"
                [style.background-image]="avatarBackgroundImage()"
                [attr.role]="profilePhotoDataUrl() ? 'button' : null"
                [attr.tabindex]="profilePhotoDataUrl() ? 0 : null"
                [attr.aria-label]="profilePhotoDataUrl() ? 'View profile photo' : null"
                (click)="openPhotoViewer()"
                (keydown.enter)="openPhotoViewer()"
                (keydown.space)="openPhotoViewer(); $event.preventDefault()"
              ></div>
              <button
                type="button"
                class="profile-hero__edit"
                aria-label="Edit profile photo"
                (click)="openGalleryPicker()"
              >
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

            <h2 class="profile-hero__name">{{ displayName() }}</h2>
          </section>

          <section
            class="account-card account-card--personal"
            aria-labelledby="personal-info-heading"
          >
            <div class="account-card__header" id="personal-info-heading">
              <span aria-hidden="true" class="material-symbols-outlined">person</span>
              <h3>Personal Info</h3>
            </div>

            <div class="account-info-rows" aria-label="Personal info details">
              <div class="account-info-row">
                <span class="account-info-row__label">Name</span>
                <span class="account-info-row__value">{{ settings().profile.fullName }}</span>
              </div>
              <div class="account-info-row">
                <span class="account-info-row__label">Age</span>
                <span class="account-info-row__value">{{ settings().profile.age ?? '' }}</span>
              </div>
              <div class="account-info-row">
                <span class="account-info-row__label">Email Address</span>
                <span class="account-info-row__value">{{ settings().profile.email }}</span>
              </div>
              <div class="account-info-row">
                <span class="account-info-row__label">Household Size</span>
                <span class="account-info-row__value">{{
                  settings().profile.householdSize ?? ''
                }}</span>
              </div>
            </div>
          </section>

          <section class="account-card" aria-labelledby="account-settings-heading">
            <div class="account-card__header" id="account-settings-heading">
              <span aria-hidden="true" class="material-symbols-outlined">settings</span>
              <h3>Settings</h3>
            </div>

            <div class="account-toggle-row">
              <span>Notifications</span>
              <button
                type="button"
                class="account-toggle"
                [class.account-toggle--active]="settings().notificationsEnabled"
                [attr.aria-checked]="settings().notificationsEnabled"
                [disabled]="isSaving()"
                aria-label="Toggle notifications"
                role="switch"
                (click)="toggleNotifications()"
              >
                <span class="account-toggle__thumb"></span>
              </button>
            </div>

            <div class="account-toggle-row">
              <span>Expiry Reminder</span>
              <button
                type="button"
                class="account-toggle"
                [class.account-toggle--active]="settings().reminderSettings.expiryRemindersEnabled"
                [attr.aria-checked]="settings().reminderSettings.expiryRemindersEnabled"
                [disabled]="isSaving()"
                aria-label="Toggle expiry reminders"
                role="switch"
                (click)="toggleExpiryReminder()"
              >
                <span class="account-toggle__thumb"></span>
              </button>
            </div>
          </section>

          <section class="account-card" aria-labelledby="budget-settings-heading">
            <div class="account-card__header" id="budget-settings-heading">
              <span aria-hidden="true" class="material-symbols-outlined"
                >account_balance_wallet</span
              >
              <h3>Budget</h3>
            </div>

            <a class="account-nav-row" [routerLink]="['/tabs/expenses/budget']">
              <div>
                <span class="account-nav-row__title">Budget Settings</span>
                <span class="account-nav-row__subtitle"
                  >Manage your weekly or monthly spending budget</span
                >
              </div>
              <span aria-hidden="true" class="material-symbols-outlined">chevron_right</span>
            </a>
          </section>

          <section class="account-card" aria-labelledby="reminders-heading">
            <div class="account-card__header" id="reminders-heading">
              <span aria-hidden="true" class="material-symbols-outlined">notifications_active</span>
              <h3>Reminders</h3>
            </div>

            <a class="account-nav-row" [routerLink]="['/tabs/settings/reminders']">
              <div>
                <span class="account-nav-row__title">Reminders</span>
                <span class="account-nav-row__subtitle">
                  Manage expiry, low stock, budget and shopping reminders
                </span>
              </div>
              <span aria-hidden="true" class="material-symbols-outlined">chevron_right</span>
            </a>
          </section>
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
              <button type="button" class="crop-btn crop-btn--ghost" (click)="cancelCrop()">
                Cancel
              </button>
              <button type="button" class="crop-btn crop-btn--primary" (click)="confirmCrop()">
                Use Photo
              </button>
            </div>
          </div>
        </div>
      }

      @if (photoViewerOpen()) {
        <div class="photo-viewer-overlay" role="dialog" aria-label="Profile photo" (click)="closePhotoViewer()">
          <button type="button" class="photo-viewer-close" aria-label="Close" (click)="closePhotoViewer()">
            <span aria-hidden="true" class="material-symbols-outlined">close</span>
          </button>
          @if (profilePhotoDataUrl()) {
            <img class="photo-viewer-img" [src]="profilePhotoDataUrl()!" alt="Profile photo" (click)="$event.stopPropagation()" />
          }
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

      .account-content,
      .account-page {
        --background: #ecedf4;
        background: #ecedf4;
      }

      .account-page {
        min-height: 100%;
        padding-bottom: calc(env(safe-area-inset-bottom, 0) + 7rem);
      }

      .account-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: grid;
        grid-template-columns: minmax(0, 1fr) 3rem;
        align-items: center;
        gap: 0.75rem;
        padding: calc(env(safe-area-inset-top, 0) + 1rem) 1.5rem 1rem;
        border-bottom: 1px solid #d4d9df;
        background: #f8f9ff;
      }

      .account-header__brand {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }

      .account-header__icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        border: 0;
        border-radius: 999px;
        background: transparent;
        color: #0b7a4f;
      }

      .account-header__title {
        margin: 0;
        font-family: 'Plus Jakarta Sans', 'Manrope', sans-serif;
        color: #0a8f5b;
        font-size: clamp(1.55rem, 5.2vw, 2rem);
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.01em;
      }

      .account-header__title-icon {
        color: var(--app-primary);
        font-size: 2rem;
      }

      .account-main {
        display: grid;
        gap: clamp(1rem, 3.2vw, 1.5rem);
        padding: clamp(1rem, 3.8vw, 1.5rem);
      }

      .profile-hero {
        display: grid;
        justify-items: center;
        gap: 1rem;
        padding-block: 1rem 0.75rem;
      }

      .profile-hero__avatar-wrap {
        position: relative;
        padding: 0.38rem;
        border-radius: 50%;
        background: linear-gradient(140deg, #ffffff 12%, #eef3ff 48%, #f7efe9 100%);
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.12);
      }

      .profile-hero__avatar {
        width: clamp(8.75rem, 34vw, 11.5rem);
        aspect-ratio: 1;
        border-radius: 50%;
        border: 4px solid #f8fbff;
        background:
          radial-gradient(
            circle at 35% 30%,
            #ffd8b1 16%,
            #cc9a70 34%,
            #2b201a 35%,
            #171412 52%,
            transparent 53%
          ),
          linear-gradient(135deg, #2d3c2f 5%, #83a86f 45%, #2f2520 80%);
        background-size: cover;
        background-position: center;
      }

      .profile-hero__avatar--image {
        border-color: #ffffff;
        cursor: pointer;
      }

      .profile-hero__edit {
        position: absolute;
        right: -0.25rem;
        bottom: 0.4rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: clamp(2.85rem, 11vw, 3.5rem);
        height: clamp(2.85rem, 11vw, 3.5rem);
        border: 0;
        border-radius: 50%;
        background: #0b7a4f;
        color: #fff;
      }

      .profile-hero__name {
        margin: 0;
        color: #0b1c30;
        font-size: clamp(1.6rem, 6vw, 2rem);
        font-weight: 700;
        line-height: 1.2;
        text-align: center;
      }

      .profile-hero__level {
        color: #31433e;
        font-size: clamp(0.95rem, 3.8vw, 1.1rem);
        font-weight: 500;
      }

      .profile-hero__file-input {
        display: none;
      }

      .crop-overlay {
        position: fixed;
        inset: 0;
        z-index: 200;
        display: grid;
        align-items: end;
        background: rgba(7, 22, 25, 0.35);
      }

      .crop-modal {
        padding: calc(env(safe-area-inset-top, 0) + 1rem) 1rem
          calc(env(safe-area-inset-bottom, 0) + 1rem);
        display: grid;
        gap: 0.9rem;
        background: #fff;
        border-top-left-radius: 1rem;
        border-top-right-radius: 1rem;
      }

      .crop-modal h3 {
        margin: 0;
        color: #08152b;
      }

      .photo-viewer-overlay {
        position: fixed;
        inset: 0;
        z-index: 250;
        display: grid;
        place-items: center;
        background: rgba(7, 22, 25, 0.86);
      }

      .photo-viewer-img {
        width: min(90vw, 26rem);
        aspect-ratio: 1;
        border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 18px 38px rgba(8, 21, 43, 0.4);
      }

      .photo-viewer-close {
        position: absolute;
        top: calc(env(safe-area-inset-top, 0) + 1rem);
        right: 1rem;
        width: 2.6rem;
        height: 2.6rem;
        border-radius: 50%;
        border: none;
        display: grid;
        place-items: center;
        background: rgba(255, 255, 255, 0.16);
        color: #ffffff;
      }

      .crop-preview {
        width: min(82vw, 320px);
        aspect-ratio: 1;
        border-radius: 1rem;
        overflow: hidden;
        margin-inline: auto;
        background: #e6ece8;
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

      .account-card {
        display: grid;
        gap: 0.4rem;
        padding: clamp(1rem, 3.8vw, 1.5rem);
        border: 1px solid #d9dce3;
        border-radius: 1.5rem;
        background: #fff;
      }

      .account-card--personal {
        min-height: 11.5rem;
        align-content: start;
      }

      .account-card__header {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .account-card__header .material-symbols-outlined {
        color: #0b7a4f;
      }

      .account-card__header h3 {
        margin: 0;
        color: #08152d;
        font-size: clamp(1.2rem, 4.8vw, 1.5rem);
        font-weight: 700;
      }

      .account-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: 3.6rem;
        color: #15243a;
        font-size: clamp(0.95rem, 3.8vw, 1.05rem);
      }

      .account-info-rows {
        display: grid;
        gap: 0.75rem;
        margin-top: 1rem;
      }

      .account-info-row,
      .account-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .account-info-row {
        min-height: 2.4rem;
        padding-bottom: 0.45rem;
        border-bottom: 1px solid #e7ebf0;
      }

      .account-info-row:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }

      .account-info-row__label {
        color: #5d697a;
        font-size: 0.9rem;
      }

      .account-info-row__value {
        color: #15243a;
        font-size: 1rem;
        font-weight: 600;
        text-align: right;
      }

      .account-toggle {
        position: relative;
        flex: 0 0 auto;
        width: 3.6rem;
        height: 2rem;
        padding: 0.16rem;
        border: 0;
        border-radius: 999px;
        background: #b8c7bd;
      }

      .account-toggle--active {
        background: #0b7a4f;
      }

      .account-toggle__thumb {
        display: block;
        width: 1.68rem;
        height: 1.68rem;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.18);
        transition: transform 0.2s ease;
      }

      .account-toggle--active .account-toggle__thumb {
        transform: translateX(1.6rem);
      }

      .account-header__icon-button:disabled,
      .account-toggle:disabled {
        opacity: 0.58;
      }

      .account-nav-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 0;
        color: inherit;
        text-decoration: none;
      }

      .account-nav-row__title {
        display: block;
        color: #15243a;
        font-size: 1rem;
        font-weight: 600;
      }

      .account-nav-row__subtitle {
        display: block;
        margin-top: 0.18rem;
        color: #5d697a;
        font-size: 0.84rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  @ViewChild('avatarPicker')
  private readonly avatarPicker?: ElementRef<HTMLInputElement>;

  private readonly settingsService = inject(SettingsService);
  private readonly notificationsService = inject(NotificationsService);
  protected readonly accountIcon = personCircleOutline;

  protected readonly isSaving = signal(false);
  protected readonly isSavingPhoto = signal(false);
  protected readonly settings = this.settingsService.settings;
  protected readonly photoViewerOpen = signal(false);
  protected readonly cropModalOpen = signal(false);
  protected readonly cropImageSource = signal<string | null>(null);
  protected readonly cropZoom = signal(1);
  protected readonly cropOffsetX = signal(0);
  protected readonly cropOffsetY = signal(0);
  protected readonly displayName = computed(
    () => this.settings().profile.fullName || 'Alex Johnson',
  );
  protected readonly profilePhotoDataUrl = computed(
    () => this.settings().profile.photoDataUrl ?? null,
  );
  protected readonly avatarBackgroundImage = computed(() =>
    this.profilePhotoDataUrl() ? `url("${this.profilePhotoDataUrl()}")` : null,
  );
  protected readonly cropImageTransform = computed(
    () =>
      `translate(calc(-50% + ${this.cropOffsetX()}px), calc(-50% + ${this.cropOffsetY()}px)) scale(${this.cropZoom()})`,
  );

  protected async toggleNotifications(): Promise<void> {
    const current = this.settings();
    const nextValue = !current.notificationsEnabled;

    await this.persistChanges({
      appSettings: { notificationsEnabled: nextValue },
      requestPermissions: nextValue && !current.notificationsEnabled,
    });
  }

  protected async toggleExpiryReminder(): Promise<void> {
    const nextValue = !this.settings().reminderSettings.expiryRemindersEnabled;

    await this.persistChanges({
      appSettings:
        nextValue && !this.settings().notificationsEnabled
          ? { notificationsEnabled: true }
          : undefined,
      reminderSettings: {
        expiryRemindersEnabled: nextValue,
      },
      requestPermissions: nextValue && !this.settings().notificationsEnabled,
    });
  }

  protected openGalleryPicker(): void {
    this.avatarPicker?.nativeElement.click();
  }

  protected openPhotoViewer(): void {
    if (!this.profilePhotoDataUrl()) {
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
    if (this.isSavingPhoto()) {
      return;
    }

    const source = this.cropImageSource();
    if (!source) {
      this.cancelCrop();
      return;
    }

    this.isSavingPhoto.set(true);
    try {
      const croppedDataUrl = await this.generateCroppedImage(source);
      if (!croppedDataUrl) {
        this.cancelCrop();
        return;
      }

      const currentProfile = this.settings().profile;
      const profile: UserProfile = {
        ...currentProfile,
        photoDataUrl: croppedDataUrl,
      };
      await this.settingsService.update({ profile });
      this.cancelCrop();
    } finally {
      this.isSavingPhoto.set(false);
    }
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

  private async persistChanges(options: {
    readonly appSettings?: Partial<AppSettings>;
    readonly reminderSettings?: Partial<ReminderSettings>;
    readonly requestPermissions?: boolean;
  }): Promise<boolean> {
    if (this.isSaving()) {
      return false;
    }

    this.isSaving.set(true);

    try {
      const current = this.settings();

      if (options.requestPermissions) {
        const granted = await this.notificationsService.ensurePermissions();
        if (!granted) {
          return false;
        }
      }

      const nextSettings: AppSettings = {
        ...current,
        ...options.appSettings,
        reminderSettings: options.reminderSettings
          ? {
              ...current.reminderSettings,
              ...options.reminderSettings,
            }
          : current.reminderSettings,
      };

      await this.settingsService.save(nextSettings);
      return true;
    } finally {
      this.isSaving.set(false);
    }
  }
}
