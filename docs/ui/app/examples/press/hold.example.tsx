import { press } from '@remix-run/ui/press'
import { css, on, type Handle } from 'remix/component'

export default function ExampleHoldToDelete(handle: Handle) {
  let holding = false
  let deleted = false

  return () => (
    <div
      mix={css({
        '--text': 'light-dark(#202027, #eeeef2)',
        '--accent': 'light-dark(#40404a, #d8d8df)',

        colorScheme: 'light dark',
        '&, & *, &::before, &::after, & *::before, & *::after': {
          boxSizing: 'border-box',
        },
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: 'var(--text)',
        font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
      })}
    >
      {deleted ? (
        <>
          <span>Deleted</span>
          <button
            type="button"
            mix={[
              press(),
              on('click', () => {
                deleted = false
                handle.update()
              }),
              css({
                padding: 0,
                border: 0,
                background: 'none',
                color: 'inherit',
                font: 'inherit',
                textDecoration: 'underline',
                '&:focus-visible': {
                  outline: '2px solid var(--accent)',
                  outlineOffset: '3px',
                },
              }),
            ]}
          >
            Undo
          </button>
        </>
      ) : (
        <button
          type="button"
          mix={[
            press({
              longPressDuration: 800,
              onPressStart() {
                holding = true
                handle.update()
              },
              // Called once for every start, whether released, cancelled or consumed.
              onPressEnd() {
                holding = false
                handle.update()
              },
              onLongPress() {
                deleted = true
                handle.update()
              },
            }),
            css({
              position: 'relative',
              overflow: 'hidden',
              minWidth: '160px',
              padding: '8px 14px',
              border: '1px solid light-dark(#d8d8df, #44444c)',
              borderRadius: '8px',
              background: 'light-dark(#fff, #25252b)',
              color: 'inherit',
              font: 'inherit',
              '&:focus-visible': {
                outline: '2px solid var(--accent)',
                outlineOffset: '3px',
              },
            }),
          ]}
        >
          <span
            aria-hidden="true"
            mix={css({
              position: 'absolute',
              inset: 0,
              background: 'light-dark(#ececf1, #34343c)',
              transformOrigin: 'left',
            })}
            style={{
              transform: holding ? 'scaleX(1)' : 'scaleX(0)',
              transition: holding ? 'transform 800ms linear' : 'transform 150ms ease-out',
            }}
          />
          <span mix={css({ position: 'relative' })}>Hold to delete</span>
        </button>
      )}
    </div>
  )
}
