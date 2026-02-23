import { animateEntrance, spring } from '@remix-run/dom'

type DemoHandle = {
  update(): Promise<AbortSignal>
}

export function EnterAnimation(_handle: DemoHandle, _setup: unknown) {
  let entrySpring = spring('smooth')
  return () => (
    <div
      mix={[
        animateEntrance({
          keyframes: { opacity: 0, transform: 'scale(0.85)' },
          options: {
            duration: entrySpring.duration,
            easing: entrySpring.easing,
          },
        }),
      ]}
      style={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        backgroundColor: '#dd00ee',
      }}
    />
  )
}
