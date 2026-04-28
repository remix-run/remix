import { createMixin, on } from '@remix-run/ui'

type PointerClickEvent = PointerEvent | MouseEvent
type PointerClickHandler = (event: PointerClickEvent) => void

function createPointerClickMixin(pointerEventType: 'pointerdown' | 'pointerup') {
  return createMixin<HTMLElement, [handler: PointerClickHandler]>((handle) => {
    let suppressNextClickToken: object | null = null

    function clearSuppressedClick() {
      suppressNextClickToken = null
    }

    function armSuppressedClick() {
      let token = {}
      suppressNextClickToken = token
      queueMicrotask(() => {
        if (suppressNextClickToken === token) {
          suppressNextClickToken = null
        }
      })
    }

    handle.addEventListener('remove', clearSuppressedClick)

    return (handler) => [
      on(pointerEventType, (pointerEvent) => {
        if (pointerEvent.button !== 0 || pointerEvent.isPrimary === false) return
        armSuppressedClick()
        handler(pointerEvent)
      }),
      on(
        'click',
        (clickEvent) => {
          if (clickEvent.button !== 0) return

          if (suppressNextClickToken) {
            clearSuppressedClick()
            clickEvent.stopImmediatePropagation()
            clickEvent.preventDefault()
            return
          }

          handler(clickEvent)
        },
        true,
      ),
    ]
  })
}

export const onPointerDownClick = createPointerClickMixin('pointerdown')

export const onPointerUpClick = createPointerClickMixin('pointerup')
