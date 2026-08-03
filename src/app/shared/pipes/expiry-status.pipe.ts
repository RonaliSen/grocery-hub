import { Pipe, PipeTransform } from '@angular/core';

import { differenceInCalendarDays } from '../../core/utils/date.utils';

@Pipe({
  name: 'expiryStatus',
  standalone: true
})
export class ExpiryStatusPipe implements PipeTransform {
  transform(expiryDate: string | null): string {
    if (!expiryDate) {
      return 'No expiry date';
    }

    const daysUntil = differenceInCalendarDays(expiryDate);
    if (daysUntil < 0) {
      return 'Expired';
    }

    if (daysUntil === 0) {
      return 'Expires today';
    }

    if (daysUntil === 1) {
      return 'Expires tomorrow';
    }

    return `Expires in ${daysUntil} days`;
  }
}
