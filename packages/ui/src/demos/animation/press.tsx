import { css, type Handle } from '@remix-run/component'
import { spring } from '@remix-run/ui/animation'
import { press } from '@remix-run/ui/press'

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
        press({
          activate: false,
          onPressStart() {
            setPressed(true)
          },
          onPressEnd() {
            setPressed(false)
          },
        }),
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
      ]}
    />
  )
}
