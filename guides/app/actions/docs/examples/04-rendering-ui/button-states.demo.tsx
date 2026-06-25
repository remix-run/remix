import * as button from 'remix/components/button'
import { css, type Handle, type Props } from 'remix/ui'

export function ButtonStates() {
  return () => (
    <div mix={buttonRowCss}>
      <button mix={[button.baseStyle, button.primaryStyle]}>
        <AddIcon mix={button.iconStyle} />
        <span mix={button.labelStyle}>New issue</span>
      </button>

      <button mix={[button.baseStyle, button.ghostStyle]}>
        <span mix={button.labelStyle}>Open</span>
        <ChevronRightIcon mix={button.iconStyle} />
      </button>

      <button disabled mix={[button.baseStyle, button.secondaryStyle]}>
        <span mix={button.labelStyle}>Disabled</span>
      </button>

      <button aria-busy="true" mix={[button.baseStyle, button.secondaryStyle]}>
        <SpinnerIcon mix={[button.iconStyle, spinnerIconCss, spinCss]} />
        <span mix={button.labelStyle}>Saving</span>
      </button>
    </div>
  )
}

function AddIcon(handle: Handle<Props<'svg'>>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 3.25v9.5M3.25 8h9.5"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
      />
    </svg>
  )
}

function ChevronRightIcon(handle: Handle<Props<'svg'>>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path d="m6 4 4 4-4 4" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" />
    </svg>
  )
}

function SpinnerIcon(handle: Handle<Props<'svg'>>) {
  return () => (
    <svg {...handle.props} aria-hidden="true" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-width="1.5"
      />
    </svg>
  )
}

const buttonRowCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
})

const spinnerIconCss = css({
  opacity: 0.72,
})

const spinCss = css({
  '@keyframes demo-button-spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
  animation: 'demo-button-spin 1s linear infinite',
})
