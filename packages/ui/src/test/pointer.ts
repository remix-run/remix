export function pointer(
  target: Element,
  type: 'pointerdown' | 'pointerup' | 'pointercancel',
  init: PointerEventInit = {},
) {
  let event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === 'pointerdown' ? 1 : 0,
    isPrimary: true,
    pointerType: 'mouse',
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

// A press and release as the browser dispatches them: the click lands on the shared target.
export function mouseClick(target: Element, init: PointerEventInit = {}) {
  pointer(target, 'pointerdown', init)
  pointer(target, 'pointerup', init)
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
}
