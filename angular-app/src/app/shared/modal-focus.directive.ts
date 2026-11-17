import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, inject } from '@angular/core';

/** Keep keyboard navigation inside an open dialog and restore the trigger on close. */
@Directive({ selector: '[appModalFocus]', standalone: true })
export class ModalFocusDirective implements AfterViewInit, OnDestroy {
  private readonly host: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
  private previous?: HTMLElement;
  private timer?: ReturnType<typeof setTimeout>;

  ngAfterViewInit(): void {
    this.previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.timer = setTimeout(() => {
      const preferred = this.host.querySelector<HTMLElement>('[data-modal-focus]');
      (preferred ?? this.focusable()[0] ?? this.host).focus();
    });
  }
  ngOnDestroy(): void {
    clearTimeout(this.timer);
    if (this.previous?.isConnected) this.previous.focus();
  }
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const items = this.focusable();
    if (!items.length) { event.preventDefault(); this.host.focus(); return; }
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !this.host.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  private focusable(): HTMLElement[] {
    return Array.from(this.host.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length));
  }
}
