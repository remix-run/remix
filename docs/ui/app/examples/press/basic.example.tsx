import { press } from '@remix-run/ui/press'
import { css } from 'remix/component'

export default function ExamplePress() {
  return () => (
    <form
      mix={css({
        '--text': 'light-dark(#202027, #eeeef2)',
        '--accent': 'light-dark(#40404a, #d8d8df)',

        colorScheme: 'light dark',
        '&, & *, &::before, &::after, & *::before, & *::after': {
          boxSizing: 'border-box',
        },
        display: 'grid',
        gap: '10px',
        width: '320px',
        maxWidth: '100%',
        color: 'var(--text)',
        font: '14px/1.6 "Inter Variable", Inter, ui-sans-serif, system-ui, sans-serif',
      })}
    >
      <label mix={[press(), rowStyle]}>
        <input type="checkbox" name="digest" defaultChecked />
        Weekly digest
      </label>
      <fieldset mix={css({ margin: 0, padding: 0, border: 0, display: 'grid', gap: '10px' })}>
        <label mix={[press(), rowStyle]}>
          <input type="radio" name="frequency" value="daily" defaultChecked />
          Daily
        </label>
        <label mix={[press(), rowStyle]}>
          <input type="radio" name="frequency" value="weekly" />
          Weekly
        </label>
      </fieldset>
      <div mix={css({ display: 'flex', gap: '8px' })}>
        <button type="submit" mix={[press(), buttonStyle]}>
          Save
        </button>
        <button type="reset" mix={[press(), buttonStyle]}>
          Reset
        </button>
      </div>
    </form>
  )
}

const rowStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
  '& input': {
    margin: 0,
    width: '16px',
    height: '16px',
    accentColor: 'var(--accent)',
  },
  '& input:focus-visible': {
    outline: '2px solid var(--accent)',
    outlineOffset: '3px',
  },
})

const buttonStyle = css({
  padding: '8px 14px',
  border: '1px solid light-dark(#d8d8df, #44444c)',
  borderRadius: '8px',
  background: 'light-dark(#fff, #25252b)',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  '&:active': {
    background: 'light-dark(#f0f0f5, #303038)',
  },
  '&:focus-visible': {
    outline: '2px solid var(--accent)',
    outlineOffset: '3px',
  },
})
