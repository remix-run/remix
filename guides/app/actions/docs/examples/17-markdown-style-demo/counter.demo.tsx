import { css, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

export function Counter(handle: Handle) {
  let count = 3

  return () => (
    <div mix={counterStyles}>
      <p mix={countStyles}>{count}</p>
      <div mix={actionsStyles}>
        <button
          mix={[
            buttonStyles,
            on('click', () => {
              count--
              handle.update()
            }),
          ]}
          type="button"
        >
          Decrement
        </button>
        <button
          mix={[
            buttonStyles,
            on('click', () => {
              count++
              handle.update()
            }),
          ]}
          type="button"
        >
          Increment
        </button>
      </div>
    </div>
  )
}

const counterStyles = css({
  display: 'grid',
  gap: '1rem',
  placeItems: 'center',
})

const countStyles = css({
  margin: '0',
  color: 'var(--red-brand)',
  fontSize: '4rem',
  fontWeight: '900',
  lineHeight: '0.9',
  letterSpacing: '-0.08em',
})

const actionsStyles = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
})

const buttonStyles = css({
  appearance: 'none',
  border: '1px solid var(--red-brand)',
  borderRadius: '999px',
  background: 'var(--red-brand)',
  color: 'white',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: '700',
  lineHeight: '1',
  padding: '0.7rem 1rem',
  '&:hover': {
    filter: 'brightness(0.95)',
  },
})
