import { Directive, ElementRef, HostListener, input } from '@angular/core';

@Directive({
  selector: 'img[appFallbackImage]',
  standalone: true
})
export class FallbackImageDirective {
  readonly appFallbackImage = input<string | null | undefined>('');

  private hasAppliedFallback = false;

  constructor(private readonly elementRef: ElementRef<HTMLImageElement>) {}

  @HostListener('load')
  protected onLoad(): void {
    const currentSrc = this.elementRef.nativeElement.currentSrc || this.elementRef.nativeElement.src;
    if (currentSrc && currentSrc !== this.appFallbackImage()) {
      this.hasAppliedFallback = false;
    }
  }

  @HostListener('error')
  protected onError(): void {
    const fallbackSrc = this.appFallbackImage()?.trim();
    if (!fallbackSrc || this.hasAppliedFallback) {
      return;
    }

    this.hasAppliedFallback = true;
    this.elementRef.nativeElement.src = fallbackSrc;
  }
}
