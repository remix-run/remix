import { spring } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleSpring(handle: Handle) {
  let saved = false
  return () => (
    <button
      type="button"
      aria-pressed={saved}
      mix={[
        on('click', () => {
          saved = !saved
          handle.update()
        }),
        styles.button,
        css({
          '& svg': {
            color: saved ? 'light-dark(#62626c, #b0b0bb)' : 'inherit',
            transform: saved ? 'scale(1.25)' : 'scale(1)',
            transition: spring.transition('transform', {
              duration: 350,
              bounce: 0.45,
            }),
            '@media (prefers-reduced-motion: reduce)': {
              transition: 'none',
            },
          },
        }),
      ]}
    >
      <BookmarkIcon saved={saved} />
      Bookmark
    </button>
  )
}

const styles = {
  button: css({
    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    minWidth: '120px',
    padding: '12px 20px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'light-dark(#202027, #eeeef2)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
    fontWeight: 600,
    cursor: 'pointer',
    '&:hover': {
      background: 'light-dark(#f0f0f5, #303038)',
    },
    '&:focus-visible': {
      outline: `2px solid light-dark(#70707c, #a0a0ac)`,
      outlineOffset: '3px',
    },
  }),
}

function BookmarkIcon(handle: Handle<{ saved: boolean }>) {
  return () => (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24">
      <path
        d="M6 4h12v16l-6-4-6 4Z"
        fill={handle.props.saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  )
}
