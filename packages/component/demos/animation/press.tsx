import { spring, type Handle } from 'remix/component'
import { pressDown, pressUp } from 'remix/interaction/press'

export function Press(handle: Handle) {
  let pressed = false
  return () => (
    <div
      tabIndex={0}
      css={{
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
      }}
      on={{
        [pressDown]() {
          pressed = true
          handle.update()
        },
        [pressUp]() {
          pressed = false
          handle.update()
        },
      }}
    />
  )
}
