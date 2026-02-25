import { css } from '@remix-run/dom/css'
import type { DomElementProps } from '@remix-run/dom/spa'
import type { MixProp } from '@remix-run/dom/spa'

type ChildrenProps = { children?: any }
type DivProps = DomElementProps<HTMLDivElement>
type ButtonProps = DomElementProps<HTMLButtonElement>
type TempoButtonProps = ButtonProps & { orientation: 'up' | 'down' }

let layoutStyle = css({
  boxSizing: 'border-box',
  '& *': { boxSizing: 'border-box' },
  display: 'flex',
  flexDirection: 'column',
  gap: 44,
  width: 735,
  margin: '4.5rem auto',
  background: '#2D2D2D',
  color: 'white',
  borderRadius: 54,
  padding: '44px 48px 54px',
  '@media (prefers-color-scheme: light)': {
    background: '#F5F5F5',
    color: 'black',
  },
})

let headerStyle = css({
  display: 'flex',
  justifyContent: 'space-between',
})

let titleStyle = css({
  display: 'flex',
  alignItems: 'end',
  lineHeight: 0.88,
  textAlign: 'right',
  fontSize: 30,
  fontWeight: 700,
  position: 'relative',
  top: 1,
})

let equalizerLayoutStyle = css({
  display: 'flex',
  background: 'black',
  borderRadius: 18,
  padding: 18,
  height: 339,
  gap: 3,
  '@media (prefers-color-scheme: light)': {
    background: '#FFFFFF',
  },
})

let tempoLayoutStyle = css({
  display: 'flex',
  flexDirection: 'row',
  gap: 8,
  alignItems: 'flex-end',
  height: 120,
})

let tempoButtonsStyle = css({
  width: 56,
  display: 'flex',
  flexDirection: 'column',
  gap: 9,
  height: '100%',
  justifyContent: 'space-between',
})

let bpmDisplayStyle = css({
  height: '100%',
  display: 'flex',
  flex: 1,
  background: '#0B1B05',
  color: '#64C146',
  padding: 32,
  borderTopLeftRadius: 18,
  borderBottomLeftRadius: 18,
  alignItems: 'end',
  '@media (prefers-color-scheme: light)': {
    background: '#EAF7E6',
  },
})

let bpmLabelStyle = css({
  fontSize: 18,
  fontWeight: 700,
  width: '33%',
})

let bpmValueStyle = css({
  flex: 1,
  fontSize: 69,
  fontWeight: 700,
  position: 'relative',
  top: 17,
  textAlign: 'right',
  fontFamily: 'JetBrains Mono, monospace',
})

let equalizerBarStyle = css({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
})

let equalizerSegmentStyle = css({
  flex: 1,
  width: '100%',
  borderRadius: 3,
})

let controlGroupStyle = css({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gridTemplateRows: '1fr 1fr',
  gap: 18,
  alignItems: 'center',
  justifyContent: 'center',
  '& button:focus-visible': {
    outline: '2px solid #2684FF',
    outlineOffset: 2,
  },
})

let buttonStyle = css({
  all: 'unset',
  letterSpacing: 0.9,
  height: 120,
  display: 'flex',
  alignItems: 'end',
  background: '#666',
  borderRadius: 18,
  padding: 32,
  fontSize: 18,
  fontWeight: 700,
  '&:disabled': {
    opacity: 0.25,
  },
  '&:active': {
    background: '#555',
  },
  '@media (prefers-color-scheme: light)': {
    background: '#E0E0E0',
    '&:active': {
      background: '#D0D0D0',
    },
  },
})

let tempoButtonStyle = css({
  all: 'unset',
  flex: 1,
  background: '#666',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:active': {
    background: '#555',
  },
  '@media (prefers-color-scheme: light)': {
    background: '#E0E0E0',
    '&:active': {
      background: '#D0D0D0',
    },
  },
})

let logoStyle = css({
  fontSize: 32,
  fontWeight: 800,
  letterSpacing: 1,
})

function mergeMix<node extends EventTarget>(base: unknown, next: MixProp<node> | undefined) {
  if (!next) return [base] as MixProp<node>
  return [base, ...next] as MixProp<node>
}

export function Layout() {
  return ({ children }: ChildrenProps) => (
    <div mix={[layoutStyle]}>
      <header mix={[headerStyle]}>
        <Logo />
        <div mix={[titleStyle]}>
          REMIX 3
          <br />
          DRUM MACHINE
        </div>
      </header>
      {children}
    </div>
  )
}

export function EqualizerLayout() {
  return ({ children }: ChildrenProps) => <div mix={[equalizerLayoutStyle]}>{children}</div>
}

export function TempoLayout() {
  return ({ children }: ChildrenProps) => <div mix={[tempoLayoutStyle]}>{children}</div>
}

export function TempoButtons() {
  return ({ children }: ChildrenProps) => <div mix={[tempoButtonsStyle]}>{children}</div>
}

export function BPMDisplay() {
  return ({ bpm }: { bpm: number }) => (
    <div mix={[bpmDisplayStyle]}>
      <div mix={[bpmLabelStyle]}>BPM</div>
      <div mix={[bpmValueStyle]}>{bpm}</div>
    </div>
  )
}

export function EqualizerBar() {
  let colors = [
    '#FF3000',
    '#FF3000',
    '#E561C3',
    '#E561C3',
    '#FFD400',
    '#FFD400',
    '#64C146',
    '#64C146',
    '#1A72FF',
    '#1A72FF',
  ]

  return ({ volume }: { volume: number }) => {
    let startIndexToShow = 10 - Math.round(volume * 10)
    return (
      <div mix={[equalizerBarStyle]}>
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            mix={[equalizerSegmentStyle]}
            style={{
              background: colors[index],
              opacity: index >= startIndexToShow ? 1 : 0.25,
            }}
          />
        ))}
      </div>
    )
  }
}

export function ControlGroup() {
  return ({ children, mix, ...rest }: DivProps) => (
    <div {...rest} mix={mergeMix<HTMLDivElement>(controlGroupStyle, mix)}>
      {children}
    </div>
  )
}

export function Button() {
  return ({ children, mix, ...rest }: ButtonProps) => (
    <button {...rest} mix={mergeMix<HTMLButtonElement>(buttonStyle, mix)}>
      {children}
    </button>
  )
}

export function Triangle() {
  return ({ label, orientation }: { label: string; orientation: 'up' | 'down' }) => {
    let up = '5,1.34 9.33,8.66 0.67,8.66'
    let down = '5,8.66 9.33,1.34 0.67,1.34'
    return (
      <svg
        aria-label={label}
        viewBox="0 0 10 10"
        style={{
          width: 14,
          height: 14,
        }}
      >
        <polygon points={orientation === 'up' ? up : down} fill="currentColor" />
      </svg>
    )
  }
}

export function TempoButton() {
  return ({ orientation, mix, ...rest }: TempoButtonProps) => (
    <button {...rest} mix={mergeMix<HTMLButtonElement>(tempoButtonStyle, mix)}>
      <Triangle label={orientation} orientation={orientation} />
    </button>
  )
}

export function Logo() {
  return () => <div mix={[logoStyle]}>REMIX</div>
}
