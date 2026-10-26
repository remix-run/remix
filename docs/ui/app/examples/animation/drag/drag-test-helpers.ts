/** Synthetic pointers cannot acquire native capture. Real capture is covered by the docs e2e tests. */
export function pointer(target: HTMLElement, type: string, x: number, y: number): void {
  if (type === 'pointerdown') {
    Object.defineProperty(target, 'setPointerCapture', { configurable: true, value() {} })
  }
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    }),
  )
}

export function position(target: HTMLElement): { x: number; y: number } {
  let [x, y] = getComputedStyle(target).translate.split(' ')
  return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 }
}
