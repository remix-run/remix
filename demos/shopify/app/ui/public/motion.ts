/**
 * Page-wide playback state shared by every autoplay video and pause button. Videos play only while
 * motion isn't paused and the tab is visible. Motion starts paused for reduced-motion users and
 * follows changes to that preference.
 */
export class Motion extends EventTarget {
  #reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  #paused = this.#reducedMotion.matches

  constructor() {
    super()
    this.#reducedMotion.addEventListener('change', () => {
      this.#setPaused(this.#reducedMotion.matches)
    })
    document.addEventListener('visibilitychange', () => {
      this.dispatchEvent(new Event('change'))
    })
  }

  get paused(): boolean {
    return this.#paused
  }

  get playing(): boolean {
    return !this.#paused && !document.hidden
  }

  toggle(): void {
    this.#setPaused(!this.#paused)
  }

  #setPaused(paused: boolean) {
    this.#paused = paused
    this.dispatchEvent(new Event('change'))
  }
}

let motion: Motion | undefined

/**
 * Returns the page's motion state. Call it only in the browser, after the component commits.
 */
export function getMotion(): Motion {
  motion ??= new Motion()
  return motion
}

/**
 * Runs `callback` once the page has loaded, so video downloads don't compete with the posters and
 * images for bandwidth.
 */
export function afterPageLoad(callback: () => void, signal: AbortSignal): void {
  if (document.readyState === 'complete') {
    callback()
    return
  }
  addEventListener('load', callback, { once: true, signal })
}
