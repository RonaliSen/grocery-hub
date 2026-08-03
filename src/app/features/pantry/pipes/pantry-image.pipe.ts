import { Pipe, PipeTransform } from '@angular/core';

import { PantryItem } from '../models/pantry-item.model';
import { createPantryFallbackImage, resolvePantryImageUrl } from '../utils/pantry-image.util';

type PantryImageLike = Pick<PantryItem, 'name' | 'imageUrl'> & { category?: PantryItem['category'] | null };

@Pipe({
  name: 'pantryImage',
  standalone: true
})
export class PantryImagePipe implements PipeTransform {
  transform(item: PantryImageLike | null | undefined, variant: 'preferred' | 'fallback' = 'preferred'): string {
    return variant === 'fallback' ? createPantryFallbackImage(item) : resolvePantryImageUrl(item);
  }
}
