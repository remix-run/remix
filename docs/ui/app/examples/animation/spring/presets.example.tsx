import { spring } from '@remix-run/ui/animation'
import type { SpringPreset } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleSpring(handle: Handle) {
  let moved = false

  return () => (
    <div mix={styles.root}>
      {presets.map((preset) => (
        <div key={preset} mix={styles.preset}>
          <span mix={styles.name}>{preset}</span>
          <div mix={styles.track}>
            <div
              data-moved={moved}
              style={{
                '--spring-transition': spring.transition('transform', preset),
              }}
              mix={styles.thumb}
            />
          </div>
        </div>
      ))}
      <div mix={styles.actions}>
        <button
          type="button"
          mix={[
            on('click', () => {
              moved = !moved
              handle.update()
            }),
            styles.button,
          ]}
        >
          Animate
        </button>
      </div>
    </div>
  )
}

const styles = {
  root: css({
    '--text': 'light-dark(#202027, #eeeef2)',
    '--thumb-size': '40px',

    colorScheme: 'light dark',
    '&, & *, &::before, &::after, & *::before, & *::after': {
      boxSizing: 'border-box',
    },
    display: 'grid',
    gap: '24px',
    width: '320px',
    maxWidth: '100%',
    color: 'var(--text)',
    font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
  }),

  preset: css({
    display: 'grid',
    gap: '10px',
  }),

  name: css({
    fontWeight: 600,
    textTransform: 'capitalize',
  }),

  track: css({
    containerType: 'inline-size',
    padding: '8px',
    borderRadius: '999px',
    background: 'light-dark(#ececf0, #25252b)',
    boxShadow: 'inset 0 0 0 1px light-dark(#e0e0e6, #393940)',
  }),

  thumb: css({
    width: 'var(--thumb-size)',
    height: 'var(--thumb-size)',
    borderRadius: '50%',
    background: 'light-dark(#62626c, #b0b0bb)',
    boxShadow: '0 2px 6px light-dark(#20202730, #00000040)',
    transform: 'translateX(0)',
    '&[data-moved="true"]': {
      transform: 'translateX(calc(100cqw - var(--thumb-size)))',
    },
    transition: 'var(--spring-transition)',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),

  actions: css({
    display: 'flex',
    justifyContent: 'center',
  }),

  button: css({
    padding: '9px 18px',
    border: '1px solid light-dark(#d8d8df, #44444c)',
    borderRadius: '8px',
    background: 'light-dark(#fff, #1b1b20)',
    color: 'var(--text)',
    font: 'inherit',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 160ms ease, border-color 160ms ease',
    '&:hover': {
      background: 'light-dark(#f0f0f5, #303038)',
      borderColor: 'light-dark(#b0b0bb, #62626c)',
    },
    '&:focus-visible': {
      outline: '2px solid light-dark(#62626c, #b0b0bb)',
      outlineOffset: '3px',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),
}

const presets: SpringPreset[] = ['smooth', 'snappy', 'bouncy']
