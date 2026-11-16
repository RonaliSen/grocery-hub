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
import {
  arrowForwardOutline,
  cameraOutline,
  chevronForwardOutline,
  closeOutline,
  notificationsOutline,
  personCircleOutline,
} from 'ionicons/icons';

import { NotificationsService } from '../../../core/services/notifications.service';
import { ReminderSettings } from '../../reminders/models/reminder-settings.model';
import { AppSettings } from '../models/app-settings.model';
import { UserProfile } from '../models/profile.model';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  host: { class: 'theme-citrus' },
  imports: [IonContent, IonIcon, RouterLink],
  template: `
    <ion-content [fullscreen]="true" class="account-content">
      <div class="account-page">
        <header class="account-header">
          <span class="account-header__icon" aria-hidden="true">
            <ion-icon [icon]="accountIcon" />
          </span>
          <div class="account-header__brand" aria-label="Account">
            <h1 class="account-header__title">Account</h1>
            <p class="account-header__subtitle">Profile &amp; preferences</p>
          </div>

          <button
            type="button"
            class="account-header__icon-button"
            aria-label="Notifications"
            [routerLink]="['/tabs/settings/reminders']"
          >
            <ion-icon aria-hidden="true" [icon]="bellIcon" />
            @if (settings().notificationsEnabled) {
              <span class="account-header__dot" aria-hidden="true"></span>
            }
          </button>
        </header>

        <main class="account-main">
          <!-- Profile hero -->
          <section class="profile-hero" aria-label="Account profile summary">
            <div class="hero-dots" aria-hidden="true"></div>
            <div class="profile-hero__top">
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
                >
                  @if (!profilePhotoDataUrl()) {
                    <span class="profile-hero__initials" aria-hidden="true">{{ initials() }}</span>
                  }
                </div>
                <button
                  type="button"
                  class="profile-hero__edit"
                  aria-label="Edit profile photo"
                  (click)="openGalleryPicker()"
                >
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
                <h2 class="profile-hero__name">{{ displayName() }}</h2>
                <p class="profile-hero__email">{{ settings().profile.email || 'No email added yet' }}</p>
              </div>
            </div>

            <div class="profile-hero__progress">
              <div class="profile-hero__progress-head">
                <span>Profile {{ profileCompletion() }}% complete</span>
                <a class="profile-hero__edit-link" [routerLink]="['/tabs/profile']">
                  Edit profile
                  <ion-icon aria-hidden="true" [icon]="arrowIcon" />
                </a>
              </div>
              <div
                class="profile-hero__track"
                role="progressbar"
                aria-label="Profile completion"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="profileCompletion()"
              >
                <span [style.width.%]="profileCompletion()"></span>
              </div>
            </div>
          </section>

          <!-- Summary tiles -->
          <section class="summary-grid" aria-label="Account summary">
            <article class="summary-tile summary-tile--household">
              <span class="summary-tile__emoji" aria-hidden="true">👥</span>
              <p>Household</p>
              <strong>
                @if (settings().profile.householdSize; as size) {
                  {{ size }} {{ size === 1 ? 'person' : 'people' }}
                } @else {
                  Not set
                }
              </strong>
            </article>
            <article class="summary-tile summary-tile--alerts" [class.is-off]="!settings().notificationsEnabled">
              <span class="summary-tile__emoji" aria-hidden="true">🔔</span>
              <p>Alerts</p>
              <strong>{{ settings().notificationsEnabled ? 'On' : 'Off' }}</strong>
            </article>
            <article
              class="summary-tile summary-tile--expiry"
              [class.is-off]="!settings().reminderSettings.expiryRemindersEnabled"
            >
              <span class="summary-tile__emoji" aria-hidden="true">⏰</span>
              <p>Expiry alerts</p>
              <strong>{{ settings().reminderSettings.expiryRemindersEnabled ? 'On' : 'Off' }}</strong>
            </article>
          </section>

          <!-- Personal info -->
          <section class="account-card" aria-labelledby="personal-info-heading">
            <div class="account-card__header">
              <span class="account-card__icon" aria-hidden="true">🪪</span>
              <h3 id="personal-info-heading">Personal Info</h3>
              <a class="account-card__action" [routerLink]="['/tabs/profile']">Edit</a>
            </div>

            <div class="account-info-rows" aria-label="Personal info details">
              <div class="account-info-row">
                <span class="account-info-row__icon" aria-hidden="true">🙂</span>
                <span class="account-info-row__label">Name</span>
                <span class="account-info-row__value" [class.is-empty]="!settings().profile.fullName">
                  {{ settings().profile.fullName || 'Not set' }}
                </span>
              </div>
              <div class="account-info-row">
                <span class="account-info-row__icon" aria-hidden="true">🎂</span>
                <span class="account-info-row__label">Age</span>
                <span class="account-info-row__value" [class.is-empty]="settings().profile.age === null">
                  {{ settings().profile.age ?? 'Not set' }}
                </span>
              </div>
              <div class="account-info-row">
                <span class="account-info-row__icon" aria-hidden="true">✉️</span>
                <span class="account-info-row__label">Email Address</span>
                <span class="account-info-row__value" [class.is-empty]="!settings().profile.email">
                  {{ settings().profile.email || 'Not set' }}
                </span>
              </div>
              <div class="account-info-row">
                <span class="account-info-row__icon" aria-hidden="true">🏠</span>
                <span class="account-info-row__label">Household Size</span>
                <span class="account-info-row__value" [class.is-empty]="settings().profile.householdSize === null">
                  {{ settings().profile.householdSize ?? 'Not set' }}
                </span>
              </div>
            </div>
          </section>

          <!-- Settings -->
          <section class="account-card" aria-labelledby="account-settings-heading">
            <div class="account-card__header">
              <span class="account-card__icon" aria-hidden="true">⚙️</span>
              <h3 id="account-settings-heading">Settings</h3>
            </div>

            <div class="account-toggle-row">
              <span class="account-toggle-row__icon" aria-hidden="true">🔔</span>
              <span class="account-toggle-row__text">
                <span class="account-toggle-row__title">Notifications</span>
                <span class="account-toggle-row__hint">Reminders and alerts on this device</span>
              </span>
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
              <span class="account-toggle-row__icon" aria-hidden="true">⏰</span>
              <span class="account-toggle-row__text">
                <span class="account-toggle-row__title">Expiry Reminder</span>
                <span class="account-toggle-row__hint">Get a heads-up before food expires</span>
              </span>
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

          <!-- Shortcuts -->
          <section class="account-card" aria-label="Budget and reminders">
            <a class="account-nav-row" [routerLink]="['/tabs/expenses/budget']">
              <span class="account-nav-row__icon account-nav-row__icon--budget" aria-hidden="true">💰</span>
              <span class="account-nav-row__text">
                <span class="account-nav-row__kicker">Budget</span>
                <span class="account-nav-row__title">Budget Settings</span>
                <span class="account-nav-row__subtitle">Manage your weekly or monthly spending budget</span>
              </span>
              <span class="account-nav-row__chevron" aria-hidden="true"><ion-icon [icon]="chevronIcon" /></span>
            </a>

            <a class="account-nav-row" [routerLink]="['/tabs/settings/reminders']">
              <span class="account-nav-row__icon account-nav-row__icon--reminders" aria-hidden="true">📣</span>
              <span class="account-nav-row__text">
                <span class="account-nav-row__kicker">Reminders</span>
                <span class="account-nav-row__title">Reminders</span>
                <span class="account-nav-row__subtitle">Manage expiry, low stock, budget and shopping reminders</span>
              </span>
              <span class="account-nav-row__chevron" aria-hidden="true"><ion-icon [icon]="chevronIcon" /></span>
            </a>
          </section>

          <p class="account-footer">Grocery Hub · Your data stays on this device</p>
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
          @if (profilePhotoDataUrl()) {
            <img class="photo-viewer-img" [src]="profilePhotoDataUrl()!" alt="Profile photo" (click)="$event.stopPropagation()" />
          }
        </div>
      }
    </ion-content>
  `,
  styles: [
    `
      /* Account — "Citrus & Ink" (tokens from src/theme/citrus.scss). */
      :host {
        display: block;
        min-height: 100%;
      }

      ion-icon {
        flex-shrink: 0;
      }

      .account-content::part(background) {
        background: var(--h-canvas);
      }

      .account-page {
        min-height: 100%;
        padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 7rem);
      }

      /* Header */
      .account-header {
        position: sticky;
        top: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: calc(env(safe-area-inset-top, 0px) + 14px) var(--h-gutter) 12px;
        padding-inline: max(var(--h-gutter), calc((100% - 720px) / 2 + var(--h-gutter)));
        background: color-mix(in srgb, var(--h-canvas) 88%, transparent);
        backdrop-filter: blur(18px);
        border-bottom: 1px solid var(--h-line);
      }

      .account-header__icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-lilac);
        color: #16141d;
        font-size: 24px;
        transform: rotate(-6deg);
      }

      .account-header__brand {
        flex: 1;
        min-width: 0;
      }

      .account-header__title {
        margin: 0;
        font-size: clamp(1.6rem, 5.6vw, 2.1rem);
        font-weight: 800;
        line-height: 1.05;
        letter-spacing: -0.035em;
        color: var(--h-ink);
      }

      .account-header__subtitle {
        margin: 2px 0 0;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--h-muted);
      }

      .account-header__icon-button {
        position: relative;
        width: 44px;
        height: 44px;
        border: 1px solid var(--h-line);
        border-radius: 50%;
        background: var(--h-surface);
        color: var(--h-ink);
        display: grid;
        place-items: center;
        font-size: 20px;
      }

      .account-header__dot {
        position: absolute;
        top: 9px;
        right: 10px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--h-accent);
        border: 2px solid var(--h-surface);
      }

      .account-main {
        width: min(100%, 720px);
        margin: 0 auto;
        display: grid;
        gap: 16px;
        padding: 16px var(--h-gutter) 0;
      }

      /* Profile hero */
      .profile-hero {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        display: grid;
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
        height: 70%;
        background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1.2px, transparent 1.4px);
        background-size: 14px 14px;
        mask-image: linear-gradient(225deg, #000 10%, transparent 70%);
      }

      .profile-hero__top {
        display: flex;
        align-items: center;
        gap: 18px;
      }

      .profile-hero__avatar-wrap {
        position: relative;
        flex-shrink: 0;
        padding: 4px;
        border-radius: 50%;
        background: conic-gradient(from 200deg, var(--h-sun), var(--h-accent), var(--h-lilac), var(--h-sun));
      }

      .profile-hero__avatar {
        width: clamp(88px, 26vw, 112px);
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

      .profile-hero__initials {
        font-family: var(--h-display);
        font-size: 2rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: #16141d;
      }

      .profile-hero__edit {
        position: absolute;
        right: -2px;
        bottom: 2px;
        width: 38px;
        height: 38px;
        padding: 0;
        border: 3px solid var(--h-hero-bg);
        border-radius: 50%;
        background: var(--h-accent);
        color: #ffffff;
        display: grid;
        place-items: center;
        font-size: 17px;
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

      .profile-hero__email {
        margin: 4px 0 0;
        font-size: 0.82rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.7);
        overflow-wrap: anywhere;
      }

      .profile-hero__progress {
        display: grid;
        gap: 8px;
      }

      .profile-hero__progress-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        font-size: 0.78rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.75);
      }

      .profile-hero__edit-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        padding: 0 6px 0 14px;
        border-radius: 999px;
        background: var(--h-accent);
        color: #ffffff;
        font-size: 0.78rem;
        font-weight: 800;
        text-decoration: none;
      }

      .profile-hero__edit-link ion-icon {
        width: 24px;
        height: 24px;
        padding: 4px;
        border-radius: 50%;
        background: #ffffff;
        color: var(--h-accent);
      }

      .profile-hero__track {
        height: 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.14);
        overflow: hidden;
      }

      .profile-hero__track span {
        display: block;
        height: 100%;
        min-width: 10px;
        border-radius: inherit;
        background: linear-gradient(90deg, var(--h-sun), var(--h-accent));
      }

      /* Summary tiles */
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .summary-tile {
        min-width: 0;
        display: grid;
        gap: 2px;
        padding: 12px;
        border-radius: 22px;
        background: var(--tile);
      }

      .summary-tile--household { --tile: var(--h-tile-4); }
      .summary-tile--alerts { --tile: var(--h-tile-3); }
      .summary-tile--expiry { --tile: var(--h-tile-1); }

      .summary-tile.is-off {
        --tile: var(--h-surface);
        border: 1px dashed var(--h-line);
      }

      .summary-tile__emoji {
        width: 34px;
        height: 34px;
        margin-bottom: 6px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        font-size: 1.05rem;
      }

      .summary-tile p {
        margin: 0;
        font-size: 0.7rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .summary-tile strong {
        font-family: var(--h-display);
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .summary-tile.is-off strong {
        color: var(--h-muted);
      }

      /* Cards */
      .account-card {
        display: grid;
        gap: 6px;
        padding: 16px;
        border-radius: 26px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
      }

      .account-card__header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 6px;
      }

      .account-card__icon {
        width: 40px;
        height: 40px;
        flex-shrink: 0;
        border-radius: 14px;
        display: grid;
        place-items: center;
        background: var(--h-tile-3);
        font-size: 1.15rem;
        transform: rotate(-6deg);
      }

      .account-card__header h3 {
        flex: 1;
        margin: 0;
        font-size: 1.08rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--h-ink);
      }

      .account-card__action {
        min-height: 32px;
        padding: 0 14px;
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 0.76rem;
        font-weight: 800;
        text-decoration: none;
      }

      .account-info-rows {
        display: grid;
        gap: 4px;
      }

      .account-info-row {
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-radius: 16px;
        background: var(--h-canvas);
      }

      .account-info-row__icon,
      .account-toggle-row__icon {
        width: 36px;
        height: 36px;
        border-radius: 12px;
        display: grid;
        place-items: center;
        background: var(--h-surface);
        font-size: 1rem;
      }

      .account-info-row__label {
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--h-ink-soft);
      }

      .account-info-row__value {
        max-width: 55vw;
        font-size: 0.9rem;
        font-weight: 800;
        color: var(--h-ink);
        text-align: right;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .account-info-row__value.is-empty {
        font-weight: 600;
        color: var(--h-muted);
      }

      /* Toggles */
      .account-toggle-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px;
        border-radius: 18px;
        background: var(--h-canvas);
      }

      .account-toggle-row__text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .account-toggle-row__title {
        font-size: 0.92rem;
        font-weight: 800;
        color: var(--h-ink);
      }

      .account-toggle-row__hint {
        font-size: 0.74rem;
        color: var(--h-muted);
      }

      .account-toggle {
        position: relative;
        flex-shrink: 0;
        width: 54px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 999px;
        background: color-mix(in srgb, var(--h-muted) 35%, transparent);
        transition: background-color 200ms ease;
      }

      .account-toggle__thumb {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #ffffff;
        box-shadow: 0 2px 6px rgba(22, 20, 29, 0.25);
        transition: transform 200ms ease;
      }

      .account-toggle--active {
        background: var(--h-accent);
      }

      .account-toggle--active .account-toggle__thumb {
        transform: translateX(22px);
      }

      .account-toggle:disabled {
        opacity: 0.6;
      }

      /* Navigation rows */
      .account-nav-row {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 12px;
        border-radius: 20px;
        color: inherit;
        text-decoration: none;
        transition: background-color 160ms ease;
      }

      .account-nav-row:active {
        background: var(--h-canvas);
      }

      .account-nav-row__icon {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        border-radius: 16px;
        display: grid;
        place-items: center;
        font-size: 1.35rem;
        transform: rotate(-5deg);
      }

      .account-nav-row__icon--budget { background: var(--h-tile-4); }
      .account-nav-row__icon--reminders { background: var(--h-tile-6); }

      .account-nav-row__text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 1px;
      }

      .account-nav-row__kicker {
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--h-muted);
      }

      .account-nav-row__title {
        font-size: 0.98rem;
        font-weight: 800;
        color: var(--h-ink);
      }

      .account-nav-row__subtitle {
        font-size: 0.76rem;
        line-height: 1.35;
        color: var(--h-muted);
      }

      .account-nav-row__chevron {
        width: 34px;
        height: 34px;
        flex-shrink: 0;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 16px;
      }

      .account-footer {
        margin: 4px 0 0;
        text-align: center;
        font-size: 0.74rem;
        font-weight: 600;
        color: var(--h-muted);
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

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          transition: none !important;
        }
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
  protected readonly bellIcon = notificationsOutline;
  protected readonly cameraIcon = cameraOutline;
  protected readonly arrowIcon = arrowForwardOutline;
  protected readonly chevronIcon = chevronForwardOutline;
  protected readonly closeIcon = closeOutline;

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
  /** Initials for the avatar placeholder when no photo is set. */
  protected readonly initials = computed(() => {
    // Only use a name the user actually entered (not the display fallback).
    const parts = this.settings().profile.fullName.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '🙂';
  });
  /** Share of profile fields filled in (name, age, email, household size, photo). */
  protected readonly profileCompletion = computed(() => {
    const profile = this.settings().profile;
    const filled = [
      !!profile.fullName.trim(),
      profile.age !== null,
      !!profile.email.trim(),
      profile.householdSize !== null,
      !!profile.photoDataUrl,
    ].filter(Boolean).length;
    return Math.round((filled / 5) * 100);
  });
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
