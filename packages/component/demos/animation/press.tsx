import { css, on, pressEvents, spring, type Handle } from 'remix/component'

export function Press(handle: Handle) {
  let pressed = false
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
        pressEvents(),
        on(pressEvents.down, () => {
          pressed = true
          handle.update()
        }),
        on(pressEvents.up, () => {
          pressed = false
          handle.update()
        }),
      ]}
    />
  )
}
