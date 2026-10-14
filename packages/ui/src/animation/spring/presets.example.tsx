import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { spring } from '@remix-run/ui/animation'
import type { SpringPreset } from '@remix-run/ui/animation'

const presets: SpringPreset[] = ['smooth', 'snappy', 'bouncy']

export default function SpringPresets(handle: Handle) {
  let moved = false

  return () => (
    <div
      mix={css({
        colorScheme: 'light dark',
        display: 'grid',
        gap: '24px',
        width: '320px',
        maxWidth: '100%',
        color: 'light-dark(#202027, #eeeef2)',
        font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
      })}
    >
      {presets.map((preset) => (
        <div key={preset} mix={css({ display: 'grid', gap: '10px' })}>
          <span mix={css({ fontWeight: 600, textTransform: 'capitalize' })}>{preset}</span>
          <div
            mix={css({
              containerType: 'inline-size',
              padding: '8px',
              borderRadius: '999px',
              background: 'light-dark(#ececf0, #25252b)',
              boxShadow: 'inset 0 0 0 1px light-dark(#e0e0e6, #393940)',
            })}
          >
            <div
              mix={css({
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'light-dark(#0578be, #5bb8ef)',
                boxShadow: '0 2px 6px light-dark(#0578be30, #00000040)',
                transform: moved ? 'translateX(calc(100cqw - 40px))' : 'translateX(0)',
                transition: spring.transition('transform', preset),
                '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
              })}
            />
          </div>
        </div>
      ))}
      <div mix={css({ display: 'flex', justifyContent: 'center' })}>
        <button
          type="button"
          mix={[
            buttonCss,
            on('click', () => {
              moved = !moved
              handle.update()
            }),
          ]}
        >
          Animate
        </button>
      </div>
    </div>
  )
}

const buttonCss = css({
  padding: '9px 18px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #1b1b20)',
  color: 'light-dark(#202027, #eeeef2)',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 160ms ease, border-color 160ms ease',
  '&:hover': {
    background: 'light-dark(#f0f0f5, #303038)',
    borderColor: 'light-dark(#b0b0bb, #62626c)',
  },
  '&:focus-visible': { outline: '2px solid #0578be', outlineOffset: '3px' },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
})
