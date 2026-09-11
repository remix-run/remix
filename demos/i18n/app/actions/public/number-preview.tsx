import { clientEntry, css, on, type Handle } from 'remix/ui'

import type { SupportedLanguage } from '../../i18n/config.ts'

type NumberPreviewProps = {
  locale: SupportedLanguage
  buttonLabel: string
  valueLabel: string
}

export const NumberPreview = clientEntry(
  import.meta.url,
  function NumberPreview(handle: Handle<NumberPreviewProps>) {
    let value = 1_250_000
    let interactive = false

    handle.queueTask(() => {
      interactive = true
      handle.update()
    })

    return () => (
      <div mix={previewStyle}>
        <button
          type="button"
          disabled={!interactive}
          mix={[
            buttonStyle,
            on('click', () => {
              value += 1_000
              handle.update()
            }),
          ]}
        >
          {handle.props.buttonLabel}
        </button>
        <output aria-label={handle.props.valueLabel} aria-live="polite">
          <bdi>{new Intl.NumberFormat(handle.props.locale).format(value)}</bdi>
        </output>
      </div>
    )
  },
)

const previewStyle = css({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '12px',
})

const buttonStyle = css({
  minHeight: '36px',
  padding: '4px 12px',
  border: '1px solid currentColor',
  borderRadius: '8px',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: '2px solid light-dark(#0578be, #2dacf9)',
    outlineOffset: '2px',
  },
  '&:disabled': { opacity: 0.5, cursor: 'default' },
})
