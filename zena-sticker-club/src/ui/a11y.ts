/** Polite live-region announcer. Clears then sets so repeats re-announce. */
export class Announcer {
  constructor(private readonly el: HTMLElement) {}

  say(message: string): void {
    this.el.textContent = '';
    window.requestAnimationFrame(() => {
      this.el.textContent = message;
    });
  }
}
