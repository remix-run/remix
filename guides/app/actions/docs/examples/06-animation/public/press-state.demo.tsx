import { createMixin, css, on } from 'remix/ui'
import type { Handle } from 'remix/ui'
import { spring } from 'remix/ui/animation'

export function PressStateDemo(handle: Handle) {
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
        pressableStyles,
        onPressDown(() => {
          setPressed(true)
        }),
        onPressUp(() => {
          setPressed(false)
        }),
      ]}
    >
      <span>{pressed ? 'Pressed' : 'Press me'}</span>
    </div>
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

const pressableStyles = css({
  display: 'grid',
  width: 120,
  height: 120,
  placeItems: 'center',
  borderRadius: 12,
  backgroundColor: '#9911ff',
  color: 'white',
  cursor: 'pointer',
  fontWeight: '800',
  transition: `transform ${spring()}`,
  '&:focus': {
    outline: '4px solid rgba(0,120,255,0.7)',
    outlineOffset: 2,
  },
  '&:hover, &:focus': {
    transform: 'scale(1.12)',
  },
})
