import type { NavigationEvent } from 'remix/component'

export interface PendingNavigation {
  readonly url: string
  readonly type: NavigationType
  readonly target: string | undefined
  readonly submission: { method: string; encType?: string; formData?: FormData } | undefined
  readonly signal: AbortSignal
}

class NavigationState extends EventTarget {
  #listeners = new AbortController()
  #active: { event: NavigationEvent; pending: PendingNavigation } | null = null

  get supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.navigation &&
      typeof NavigateEvent !== 'undefined' &&
      'sourceElement' in NavigateEvent.prototype
    )
  }

  get current(): PendingNavigation | null {
    return this.#active?.pending ?? null
  }

  start(): void {
    this.#listeners.abort()
    this.#listeners = new AbortController()
    this.#active = null
    if (!this.supported) return
    window.addEventListener(
      'rmx:navigation',
      (event) => {
        if (this.#active?.event.finished === event.finished) {
          if (this.#active.event.to === event.to) return
          this.#active.event = event
          this.dispatchEvent(new Event('change'))
          return
        }

        let active = {
          event,
          pending: {
            get url() {
              return active.event.to
            },
            type: event.navigationType,
            target: event.frameTarget,
            submission:
              event.element instanceof HTMLFormElement
                ? {
                    method: event.method.toUpperCase(),
                    encType: event.encType,
                    formData: event.formData,
                  }
                : undefined,
            signal: event.signal,
          },
        }
        this.#active = active
        let clear = () => {
          if (this.#active !== active) return
          this.#active = null
          this.dispatchEvent(new Event('change'))
        }
        void event.finished.then(clear, clear)
        this.dispatchEvent(new Event('change'))
      },
      { capture: true, signal: this.#listeners.signal },
    )
  }

  async settled(): Promise<void> {
    if (!this.supported) return

    while (true) {
      if (this.#active) {
        await this.#active.event.finished.catch(() => {})
        continue
      }
      // Other interceptors can still own a transition after Remix becomes idle.
      let transition = window.navigation.transition
      if (!transition) return
      await transition.finished.catch(() => {})
      if (!this.#active && window.navigation.transition === transition) return
    }
  }
}

export const navigation = new NavigationState()
