import { Portal } from '@remix-run/ui/portal'
import { css, on, ref, type Handle } from 'remix/component'

export default function ExamplePortal(handle: Handle) {
  let first: HTMLElement | undefined
  let second: HTMLElement | undefined
  let useSecond = false

  return () => (
    <div
      mix={css({
        display: 'grid',
        gap: '16px',
        width: '360px',
        maxWidth: '100%',
        colorScheme: 'light dark',
        color: 'light-dark(#202027, #eeeef2)',
        font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
      })}
    >
      <button
        type="button"
        disabled={!first || !second}
        mix={[
          buttonStyle,
          css({ justifySelf: 'center' }),
          on('click', () => {
            useSecond = !useSecond
            void handle.update()
          }),
        ]}
      >
        Move content
      </button>
      <div mix={css({ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' })}>
        <section
          aria-label="Container A"
          mix={[
            containerStyle,
            ref((node: HTMLElement) => {
              if (first === node) return
              first = node
              void handle.update()
            }),
          ]}
        >
          <span>Container A</span>
        </section>
        <section
          aria-label="Container B"
          mix={[
            containerStyle,
            ref((node: HTMLElement) => {
              if (second === node) return
              second = node
              void handle.update()
            }),
          ]}
        >
          <span>Container B</span>
        </section>
      </div>
      {first && second ? (
        <Portal container={useSecond ? second : first}>
          <Counter />
        </Portal>
      ) : null}
    </div>
  )
}

function Counter(handle: Handle) {
  let count = 0
  return () => (
    <button
      type="button"
      mix={[
        buttonStyle,
        on('click', () => {
          count++
          void handle.update()
        }),
      ]}
    >
      Count: {count}
    </button>
  )
}

const containerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  minHeight: '112px',
  padding: '16px 8px',
  border: '1px dashed light-dark(#c9c9d2, #494951)',
  borderRadius: '8px',
  background: 'light-dark(#fafafa, #202025)',
})

const buttonStyle = css({
  padding: '8px 12px',
  border: '1px solid light-dark(#c9c9d2, #494951)',
  borderRadius: '6px',
  background: 'light-dark(#fff, #29292f)',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  cursor: 'pointer',
  '&:hover': { background: 'light-dark(#f0f0f5, #303038)' },
  '&:focus': { outline: '2px solid light-dark(#70707c, #a0a0ac)', outlineOffset: '3px' },
})
