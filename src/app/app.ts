import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  cartOutline,
  checkmarkCircleOutline,
  cubeOutline,
  homeOutline,
  removeOutline,
  settingsOutline,
  warningOutline
} from 'ionicons/icons';

import { SettingsService } from './features/settings/services/settings.service';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly settingsService = inject(SettingsService);

  constructor() {
    addIcons({
      addOutline,
      cartOutline,
      checkmarkCircleOutline,
      cubeOutline,
      homeOutline,
      removeOutline,
      settingsOutline,
      warningOutline
    });

    effect(() => {
      this.document.documentElement.setAttribute('data-theme', this.settingsService.settings().themePreference);
    });
  }
}
