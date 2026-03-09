import { animateEntrance, css, spring } from 'remix/component'

export function EnterAnimation() {
  return () => (
    <div
      mix={[
        css({
          width: 100,
          height: 100,
          backgroundColor: '#dd00ee',
          borderRadius: '50%',
        }),
        animateEntrance({
          opacity: 0,
          transform: 'scale(0)',
          ...spring({ duration: 400, bounce: 0.5 }),
        }),
      ]}
    />
  )
}
