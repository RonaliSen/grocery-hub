import {
  Component,
  EventEmitter,
  forwardRef,
  Injectable,
  Input,
  Output
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ion-app',
  standalone: true,
  template: '<ng-content />'
})
export class IonApp {}

@Component({
  selector: 'ion-back-button',
  standalone: true,
  host: {
    '[attr.defaultHref]': 'defaultHref || null'
  },
  template: ''
})
export class IonBackButton {
  @Input() defaultHref: string | null = null;
}

@Component({
  selector: 'ion-button',
  standalone: true,
  template: '<ng-content />'
})
export class IonButton {
  @Input() color: string | null = null;
  @Input() expand: string | null = null;
  @Input() fill: string | null = null;
  @Input() type: string | null = null;
  @Input() disabled = false;
}

@Component({
  selector: 'ion-buttons',
  standalone: true,
  template: '<ng-content />'
})
export class IonButtons {}

@Component({
  selector: 'ion-card',
  standalone: true,
  template: '<ng-content />'
})
export class IonCard {}

@Component({
  selector: 'ion-card-content',
  standalone: true,
  template: '<ng-content />'
})
export class IonCardContent {}

@Component({
  selector: 'ion-card-header',
  standalone: true,
  template: '<ng-content />'
})
export class IonCardHeader {}

@Component({
  selector: 'ion-card-subtitle',
  standalone: true,
  template: '<ng-content />'
})
export class IonCardSubtitle {}

@Component({
  selector: 'ion-card-title',
  standalone: true,
  template: '<ng-content />'
})
export class IonCardTitle {}

@Component({
  selector: 'ion-checkbox',
  standalone: true,
  template: ''
})
export class IonCheckbox {
  @Input() checked = false;
  @Output() ionChange = new EventEmitter<void>();
}

@Component({
  selector: 'ion-chip',
  standalone: true,
  template: '<ng-content />'
})
export class IonChip {
  @Input() color: string | null = null;
}

@Component({
  selector: 'ion-content',
  standalone: true,
  template: '<ng-content />'
})
export class IonContent {
  @Input() fullscreen = false;
}

@Component({
  selector: 'ion-header',
  standalone: true,
  template: '<ng-content />'
})
export class IonHeader {}

@Component({
  selector: 'ion-icon',
  standalone: true,
  host: {
    '[attr.name]': 'name || null'
  },
  template: ''
})
export class IonIcon {
  @Input() icon: unknown;
  @Input() name: string | null = null;
}

@Component({
  selector: 'ion-input',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IonInput),
      multi: true
    }
  ],
  template: ''
})
export class IonInput implements ControlValueAccessor {
  @Input() inputmode: string | null = null;
  @Input() placeholder: string | null = null;
  @Input() type: string | null = null;
  @Input() disabled = false;
  @Output() ionBlur = new EventEmitter<void>();

  writeValue(_value: unknown): void {}
  registerOnChange(_fn: (_value: unknown) => void): void {}
  registerOnTouched(_fn: () => void): void {}
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

@Component({
  selector: 'ion-item',
  standalone: true,
  template: '<ng-content />'
})
export class IonItem {
  @Input() lines: string | null = null;
}

@Component({
  selector: 'ion-label',
  standalone: true,
  template: '<ng-content />'
})
export class IonLabel {
  @Input() position: string | null = null;
}

@Component({
  selector: 'ion-list',
  standalone: true,
  template: '<ng-content />'
})
export class IonList {
  @Input() lines: string | null = null;
}

@Component({
  selector: 'ion-modal',
  standalone: true,
  template: '<ng-content />'
})
export class IonModal {
  @Input() isOpen = false;
  @Input() initialBreakpoint: number | null = null;
  @Input() breakpoints: readonly number[] | null = null;
  @Output() didDismiss = new EventEmitter<void>();
}

@Component({
  selector: 'ion-note',
  standalone: true,
  template: '<ng-content />'
})
export class IonNote {}

@Component({
  selector: 'ion-router-outlet',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
export class IonRouterOutlet {}

@Component({
  selector: 'ion-select',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IonSelect),
      multi: true
    }
  ],
  template: '<ng-content />'
})
export class IonSelect implements ControlValueAccessor {
  @Input() disabled = false;
  @Input() interface: string | null = null;

  writeValue(_value: unknown): void {}
  registerOnChange(_fn: (_value: unknown) => void): void {}
  registerOnTouched(_fn: () => void): void {}
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

@Component({
  selector: 'ion-select-option',
  standalone: true,
  template: '<ng-content />'
})
export class IonSelectOption {
  @Input() value: unknown;
}

@Component({
  selector: 'ion-tab-bar',
  standalone: true,
  host: {
    '[attr.selected-tab]': 'selectedTab || null'
  },
  template: '<ng-content />'
})
export class IonTabBar {
  @Input() selectedTab: string | null = null;
}

@Component({
  selector: 'ion-tab-button',
  standalone: true,
  host: {
    '[attr.href]': 'href || null',
    '[attr.tab]': 'tab || null',
    '[attr.selected]': 'selected ? "" : null'
  },
  template: '<ng-content />'
})
export class IonTabButton {
  @Input() href: string | null = null;
  @Input() selected = false;
  @Input() tab: string | null = null;
}

@Injectable({ providedIn: 'root' })
export class ToastController {}

@Component({
  selector: 'ion-tabs',
  standalone: true,
  template: '<ng-content />'
})
export class IonTabs {}

@Component({
  selector: 'ion-toggle',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IonToggle),
      multi: true
    }
  ],
  template: ''
})
export class IonToggle implements ControlValueAccessor {
  @Input() disabled = false;

  writeValue(_value: unknown): void {}
  registerOnChange(_fn: (_value: unknown) => void): void {}
  registerOnTouched(_fn: () => void): void {}
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

@Component({
  selector: 'ion-text',
  standalone: true,
  template: '<ng-content />'
})
export class IonText {
  @Input() color: string | null = null;
}

@Component({
  selector: 'ion-textarea',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IonTextarea),
      multi: true
    }
  ],
  template: ''
})
export class IonTextarea implements ControlValueAccessor {
  @Input() autoGrow = false;
  @Input() disabled = false;

  writeValue(_value: unknown): void {}
  registerOnChange(_fn: (_value: unknown) => void): void {}
  registerOnTouched(_fn: () => void): void {}
  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

@Component({
  selector: 'ion-title',
  standalone: true,
  template: '<ng-content />'
})
export class IonTitle {}

@Component({
  selector: 'ion-toolbar',
  standalone: true,
  template: '<ng-content />'
})
export class IonToolbar {}

@Injectable({
  providedIn: 'root'
})
export class AlertController {
  async create(options: Record<string, unknown>): Promise<{ present: () => Promise<void> } & Record<string, unknown>> {
    return {
      ...options,
      present: async () => undefined
    };
  }
}

export class IonicRouteStrategy {}

export function provideIonicAngular(): [] {
  return [];
}
