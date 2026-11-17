import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Home's entry point to the Meal Planner. Styled like the Expiry Tracker shortcut. */
@Component({
  selector: 'app-meal-planner-shortcut',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="planner-shortcut" [routerLink]="['/tabs/meal-planner']">
      <span class="planner-shortcut__icon" aria-hidden="true">🍽️</span>
      <span class="planner-shortcut__text">
        <span class="planner-shortcut__title">Meal Planner</span>
        <span class="planner-shortcut__subtitle">Plan breakfast, lunch &amp; dinner for the week</span>
      </span>
      <span class="planner-shortcut__arrow material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </a>
  `,
  styles: [
    `
      /* Tokens (--h-*) are inherited from the parent's .theme-citrus host. */
      :host {
        display: block;
      }

      .planner-shortcut {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 72px;
        padding: 12px;
        border-radius: 26px;
        border: 1px solid var(--h-line);
        background: var(--h-surface);
        box-shadow: var(--h-shadow);
        color: var(--h-ink);
        transition: transform 160ms ease;
      }

      .planner-shortcut:active {
        transform: scale(0.98);
      }

      .planner-shortcut__icon {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
        border-radius: 16px;
        display: grid;
        place-items: center;
        background: var(--h-tile-2);
        font-size: 1.4rem;
        transform: rotate(-6deg);
      }

      .planner-shortcut__text {
        flex: 1;
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .planner-shortcut__title {
        font-family: var(--h-display);
        font-size: 1rem;
        font-weight: 800;
        letter-spacing: -0.02em;
      }

      .planner-shortcut__subtitle {
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--h-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .planner-shortcut__arrow {
        width: 38px;
        height: 38px;
        flex-shrink: 0;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--h-btn-bg);
        color: var(--h-btn-fg);
        font-size: 18px;
        line-height: 1;
        /* Until the icon font loads, the ligature name renders as text: keep it in the circle. */
        overflow: hidden;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MealPlannerShortcutComponent {}
