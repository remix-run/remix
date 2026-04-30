import { createMixin, css, on, type Handle } from 'remix/ui'
import { spring } from 'remix/ui/animation'

export function Press(handle: Handle) {
  let pressed = false

  function setPressed(nextPressed: boolean) {
    if (pressed === nextPressed) return
    pressed = nextPressed
    handle.update()
  }

  return () => (
    <div
      tabIndex={0}
      mix={[
        css({
          width: 100,
          height: 100,
          backgroundColor: '#9911ff',
          borderRadius: 5,
          transition: `transform ${spring()}`,
          '&:focus': {
            outline: '4px solid rgba(0,120,255,0.7)',
            outlineOffset: 1,
          },
          '&:hover, &:focus': {
            transform: pressed ? 'scale(0.8)' : 'scale(1.2)',
          },
          // or use default browser :active but lose keyboard "down" press states
          // '&:active': {
          //   transform: 'scale(0.8)',
          // },
        }),
        onPressDown(() => {
          setPressed(true)
        }),
        onPressUp(() => {
          setPressed(false)
        }),
      ]}
    />
  )
}

const onPressDown = createMixin<HTMLElement, [handler: () => void]>(() => (handler) => [
  on('pointerdown', (event) => {
    if (event.isPrimary === false) return
    handler()
  }),
  on('keydown', (event) => {
    if (!(event.key === 'Enter' || event.key === ' ') || event.repeat) return
    event.preventDefault()
    handler()
  }),
])

const onPressUp = createMixin<HTMLElement, [handler: () => void]>(() => (handler) => [
  on('pointerup', handler),
  on('pointerleave', handler),
  on('keyup', (event) => {
    if (!(event.key === 'Enter' || event.key === ' ')) return
    event.preventDefault()
    handler()
  }),
  on('blur', handler),
])
