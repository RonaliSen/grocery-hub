import { Pipe, PipeTransform } from '@angular/core';

import { QuantityUnit } from '../../features/pantry/models/pantry-item.model';
import { formatQuantity } from '../../core/utils/quantity.utils';

@Pipe({
  name: 'quantityLabel',
  standalone: true
})
export class QuantityLabelPipe implements PipeTransform {
  transform(quantity: number | null | undefined, unit: QuantityUnit | null | undefined): string {
    return formatQuantity(quantity, unit);
  }
}
