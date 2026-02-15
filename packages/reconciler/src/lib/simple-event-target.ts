type Listener = (event: Event) => void

export class SimpleEventTarget {
  #listeners = new Map<string, Set<Listener>>()

  addEventListener(type: string, listener: null | Listener) {
    if (!listener) return
    let listeners = this.#listeners.get(type)
    if (!listeners) {
      listeners = new Set()
      this.#listeners.set(type, listeners)
    }
    listeners.add(listener)
  }

  removeEventListener(type: string, listener: null | Listener) {
    if (!listener) return
    let listeners = this.#listeners.get(type)
    if (!listeners) return
    listeners.delete(listener)
    if (listeners.size === 0) {
      this.#listeners.delete(type)
    }
  }

  dispatchEvent(event: Event) {
    let listeners = this.#listeners.get(event.type)
    if (!listeners || listeners.size === 0) return true
    for (let listener of [...listeners]) {
      listener(event)
    }
    return true
  }
}
