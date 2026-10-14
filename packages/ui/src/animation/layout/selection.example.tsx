import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { animateLayout, spring } from '@remix-run/ui/animation'

export default function Example(handle: Handle) {
  let activity = false
  let reducedMotion = true
  handle.queueTask(() => {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    handle.update()
  })
  return () => (
    <div role="group" aria-label="Project view" mix={toolbarCss}>
      <div
        aria-hidden="true"
        inert
        mix={[
          css({
            position: 'absolute',
            top: '5px',
            bottom: '5px',
            left: activity ? '101px' : '5px',
            width: activity ? '144px' : '96px',
            borderRadius: '6px',
            background: 'light-dark(#fff, #393940)',
            boxShadow: '0 1px 3px #00000018',
          }),
          animateLayout(reducedMotion ? false : { ...spring('snappy') }),
        ]}
      />
      {['Overview', 'Activity log'].map((label, index) => (
        <button
          key={label}
          type="button"
          aria-pressed={activity === (index === 1)}
          mix={[
            buttonCss,
            on('click', () => {
              reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
              activity = index === 1
              handle.update()
            }),
          ]}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const toolbarCss = css({
  colorScheme: 'light dark',
  display: 'grid',
  gridTemplateColumns: '96px 144px',
  position: 'relative',
  padding: '5px',
  width: 'fit-content',
  borderRadius: '10px',
  background: 'light-dark(#ececf0, #25252b)',
  color: 'light-dark(#202027, #eeeef2)',
  font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
})
const buttonCss = css({
  position: 'relative',
  padding: '8px 12px',
  border: 0,
  borderRadius: '6px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  '&:focus-visible': { outline: '2px solid #5bb8ef', outlineOffset: '2px' },
})
