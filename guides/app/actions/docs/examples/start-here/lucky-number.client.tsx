import { clientEntry, css, on } from 'remix/ui'
import type { Handle } from 'remix/ui'

export type LuckyNumberTone = 'brand' | 'purple' | 'green' | 'blue' | 'gold'

type LuckyNumberToyProps = {
  generatedLabel: string
  luckyNumber: number
  mood: string
  tone: LuckyNumberTone
}

export const LuckyNumberToy = clientEntry(
  import.meta.url,
  function LuckyNumberToy(handle: Handle<LuckyNumberToyProps>) {
    let taps = 0

    return () => (
      <div mix={toyStyles}>
        <div mix={[numberStyles, numberToneStyles[handle.props.tone]]}>
          {handle.props.luckyNumber}
        </div>
        <p>
          The server picked <strong>{handle.props.mood}</strong> at{' '}
          <time>{handle.props.generatedLabel}</time>.
        </p>
        <div mix={actionsStyles}>
          <button
            mix={[
              buttonStyles,
              on('click', () => {
                taps++
                handle.update()
              }),
            ]}
            type="button"
          >
            Local taps: {taps}
          </button>
          <button
            mix={[
              buttonStyles,
              secondaryButtonStyles,
              on('click', async () => {
                await handle.frame.reload()
              }),
            ]}
            type="button"
          >
            Reroll server values
          </button>
        </div>
      </div>
    )
  },
)

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

const secondaryButtonStyles = css({
  background: 'transparent',
  color: 'var(--red-brand)',
})

const toyStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
})

const numberStyles = css({
  fontSize: '4rem',
  fontWeight: '900',
  lineHeight: '0.9',
  letterSpacing: '-0.08em',
})

const numberToneStyles = {
  brand: css({ color: '#d83a5a' }),
  purple: css({ color: '#7c3aed' }),
  green: css({ color: '#059669' }),
  blue: css({ color: '#2563eb' }),
  gold: css({ color: '#d97706' }),
}
