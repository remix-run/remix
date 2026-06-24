import { clientEntry, css, on, type Handle } from 'remix/ui'

export const Counter = clientEntry(import.meta.url, function Counter(handle: Handle) {
  let count = 0

  return () => (
    <div mix={containerStyle}>
      <span mix={labelStyle}>Count</span>
      <div mix={controlsStyle}>
        <button
          type="button"
          aria-label="Decrement"
          mix={[
            buttonStyle,
            on('click', () => {
              count -= 1
              handle.update()
            }),
          ]}
        >
          −
        </button>
        <span mix={countStyle} aria-live="polite" aria-atomic="true">
          {count}
        </span>
        <button
          type="button"
          aria-label="Increment"
          mix={[
            buttonStyle,
            on('click', () => {
              count += 1
              handle.update()
            }),
          ]}
        >
          +
        </button>
      </div>
      <button
        type="button"
        mix={[
          resetStyle,
          on('click', () => {
            count = handle.props.initialCount ?? 0
            handle.update()
          }),
        ]}
      >
        Reset
      </button>
    </div>
  )
})

const containerStyle = css({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  padding: '24px',
  borderRadius: '12px',
  background: 'var(--surface-2, #f8fafc)',
  border: '1px solid var(--border-subtle, #e5e7eb)',
})

const labelStyle = css({
  fontSize: '14px',
  fontWeight: '600',
  color: 'var(--text-secondary, #374151)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const controlsStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
})

const countStyle = css({
  fontSize: '32px',
  fontWeight: '700',
  color: 'var(--text-primary, #111827)',
  minWidth: '48px',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
})

const buttonStyle = css({
  appearance: 'none',
  font: 'inherit',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '40px',
  height: '40px',
  fontSize: '20px',
  fontWeight: '500',
  border: '1px solid var(--border-default, #d1d5db)',
  borderRadius: '8px',
  background: 'var(--surface-1, #ffffff)',
  color: 'var(--text-primary, #111827)',
  transition: 'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
  '&:hover, &:focus-visible': {
    background: 'var(--brand-blue, #2563eb)',
    borderColor: 'var(--brand-blue, #2563eb)',
    color: '#ffffff',
    outline: 'none',
  },
  '&:active': {
    background: 'var(--brand-blue-dark, #1d4ed8)',
    borderColor: 'var(--brand-blue-dark, #1d4ed8)',
  },
})

const resetStyle = css({
  appearance: 'none',
  font: 'inherit',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500',
  padding: '4px 12px',
  border: 0,
  borderRadius: '6px',
  background: 'transparent',
  color: 'var(--text-muted, #6b7280)',
  transition: 'color 120ms ease, background-color 120ms ease',
  '&:hover, &:focus-visible': {
    background: 'var(--surface-3, #e5edf7)',
    color: 'var(--text-secondary, #374151)',
    outline: 'none',
  },
})
