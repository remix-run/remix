import type { Handle, RemixNode, Props } from 'remix/component'

export function Layout() {
  return ({ children }: { children: RemixNode }) => (
    <div
      css={{
        boxSizing: 'border-box',
        '& *': {
          boxSizing: 'border-box',
        },
        display: 'flex',
        flexDirection: 'column',
        gap: '44px',
        width: 735,
        margin: '4.5rem auto',
        background: '#2D2D2D',
        color: 'white',
        borderRadius: '54px',
        padding: '44px 48px 54px 48px',
        '@media (prefers-color-scheme: light)': {
          background: '#F5F5F5',
          color: 'black',
        },
      }}
    >
      <header
        css={{
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <Logo />
        <div
          css={{
            display: 'flex',
            alignItems: 'end',
            lineHeight: '0.88',
            textAlign: 'right',
            fontSize: '30px',
            fontWeight: 700,
            position: 'relative',
            top: '1px',
          }}
        >
          REMIX 3<br />
          DRUM MACHINE
        </div>
      </header>

      {children}
    </div>
  )
}

export function EqualizerLayout() {
  return ({ children }: { children: RemixNode }) => (
    <div
      css={{
        display: 'flex',
        background: 'black',
        borderRadius: '18px',
        padding: '18px',
        height: 339,
        gap: '3px',
        '@media (prefers-color-scheme: light)': {
          background: '#FFFFFF',
        },
      }}
    >
      {children}
    </div>
  )
}

export function TempoLayout() {
  return ({ children }: { children: RemixNode }) => (
    <div
      css={{
        display: 'flex',
        flexDirection: 'row',
        gap: '8px',
        alignItems: 'flex-end',
        height: 120,
      }}
    >
      {children}
    </div>
  )
}

export function TempoButtons() {
  return ({ children }: { children: RemixNode }) => (
    <div
      css={{
        width: 56,
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        height: '100%',
        justifyContent: 'space-between',
      }}
    >
      {children}
    </div>
  )
}

export function BPMDisplay() {
  return ({ bpm }: { bpm: number }) => (
    <div
      css={{
        height: '100%',
        display: 'flex',
        flex: 1,
        background: '#0B1B05',
        color: '#64C146',
        padding: '32px',
        borderTopLeftRadius: '18px',
        borderBottomLeftRadius: '18px',
        alignItems: 'end',
        '@media (prefers-color-scheme: light)': {
          background: '#EAF7E6',
        },
      }}
    >
      <div
        css={{
          fontSize: '18px',
          fontWeight: 700,
          width: '33%',
        }}
      >
        BPM
      </div>
      <div
        css={{
          flex: 1,
          fontSize: '69px',
          fontWeight: 700,
          position: 'relative',
          top: 17,
          textAlign: 'right',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        {bpm}
      </div>
    </div>
  )
}

export function EqualizerBar(handle: Handle) {
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

  return ({ volume }: { volume: number /* 0-1 */ }) => {
    let startIndexToShow = 10 - Math.round(volume * 10)
    return (
      <div
        css={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {Array.from({ length: 10 }).map((_, index) => (
          <div
            css={{
              flex: 1,
              width: '100%',
              borderRadius: '3px',
              background: colors[index],
            }}
            style={{
              opacity: index >= startIndexToShow ? 1 : 0.25,
            }}
          />
        ))}
      </div>
    )
  }
}

export function ControlGroup() {
  return ({ children, css, ...rest }: Props<'div'>) => (
    <div
      {...rest}
      css={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '18px',
        alignItems: 'center',
        justifyContent: 'center',
        '& button:focus-visible': {
          outline: '2px solid #2684FF',
          outlineOffset: '2px',
        },
        ...css,
      }}
    >
      {children}
    </div>
  )
}

export function Button() {
  return ({ children, ...rest }: Props<'button'>) => (
    <button
      {...rest}
      css={{
        all: 'unset',
        letterSpacing: 0.9,
        height: 120,
        display: 'flex',
        alignItems: 'end',
        background: '#666',
        borderRadius: '18px',
        padding: '32px',
        fontSize: '18px',
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
      }}
    >
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

interface TempoButtonProps extends Props<'button'> {
  orientation: 'up' | 'down'
}

export function TempoButton() {
  return ({ orientation, css, ...rest }: TempoButtonProps) => (
    <button
      {...rest}
      css={{
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
        '&:first-child': {
          borderTopRightRadius: '18px',
        },
        '&:last-child': {
          borderBottomRightRadius: '18px',
        },
        ...css,
      }}
    >
      <Triangle label={orientation} orientation={orientation} />
    </button>
  )
}

export function Logo() {
  return () => (
    <svg
      height="65"
      viewBox="0 0 400 143"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      css={{
        '@media (prefers-color-scheme: light)': {
          "& [fill='white']": { fill: 'black' },
        },
      }}
    >
      <g clip-path="url(#clip0_836_2441)">
        <path d="M82.8363 111.891H58.0045L49.7144 142.85H74.5342L82.8363 111.891Z" fill="#FFD400" />
        <path d="M68.846 71.4047L60.7856 101.501H85.6204L93.6897 71.4047H68.846Z" fill="#FFD400" />
        <path d="M96.707 60.1494L104.776 30.0588H79.9207L71.8604 60.1494H96.707Z" fill="#FFD400" />
        <path d="M57.9867 111.891H33.1549L24.8647 142.85H49.6876L57.9867 111.891Z" fill="#64C146" />
        <path
          d="M71.8604 60.1494L79.9267 30.0588H55.0741L47.0137 60.1494H71.8604Z"
          fill="#64C146"
        />
        <path d="M43.9994 71.4047L35.939 101.501H60.7737L68.8431 71.4047H43.9994Z" fill="#64C146" />
        <path d="M33.122 111.891H8.29019L0 142.85H24.8228L33.122 111.891Z" fill="#1A72FF" />
        <path
          d="M19.1351 71.4047L11.0747 101.501H35.9095L43.9758 71.4047H19.1351Z"
          fill="#1A72FF"
        />
        <path d="M46.9956 60.1494L55.062 30.0588H30.2093L22.1489 60.1494H46.9956Z" fill="#1A72FF" />
        <path
          d="M132.401 111.891L124.111 142.85H203.626L210.459 117.33C211.194 114.587 209.129 111.891 206.288 111.891H132.398H132.401Z"
          fill="white"
        />
        <path
          d="M339.31 30.0618H154.317L146.257 60.1554H296.095C301.732 60.1554 305.627 62.6752 304.791 65.7831C303.959 68.8909 298.715 71.4107 293.081 71.4107H143.243L135.183 101.507H220.729C223.158 101.507 225.536 102.203 227.586 103.511L287.823 142.859H380.394L317.089 101.51H320.172C350.31 101.51 378.347 88.0368 382.796 71.4167L385.813 60.1614C390.266 43.5412 369.445 30.0677 339.307 30.0677L339.31 30.0618Z"
          fill="white"
        />
        <path d="M107.375 111.891H82.5436L74.2534 142.85H99.0762L107.375 111.891Z" fill="#E561C3" />
        <path
          d="M93.3885 71.4047L85.3281 101.501H110.163L118.229 71.4047H93.3885Z"
          fill="#E561C3"
        />
        <path
          d="M121.249 60.1494L129.315 30.0588H104.463L96.4023 60.1494H121.249Z"
          fill="#E561C3"
        />
        <path d="M132.222 111.891H107.39L99.1001 142.85H123.92L132.222 111.891Z" fill="#FF3000" />
        <path
          d="M118.232 71.4047L110.172 101.501H135.007L143.076 71.4047H118.232Z"
          fill="#FF3000"
        />
        <path
          d="M146.093 60.1494L154.162 30.0588H129.306L121.246 60.1494H146.093Z"
          fill="#FF3000"
        />
        <path
          d="M386.574 12.3877C386.574 11.4174 385.905 10.9338 384.935 10.9338C383.691 10.9338 382.906 11.7638 382.652 13.1729H378.731C379.238 9.68884 381.614 7.70648 385.282 7.70648C388.442 7.70648 390.564 9.20519 390.564 11.8354C390.564 13.5879 389.618 14.8119 388.072 15.5046C389.316 16.1733 389.985 17.3048 389.985 18.9199C389.985 22.2428 387.194 24.5506 383.204 24.5506C379.492 24.5506 376.77 22.5652 377.415 18.8304H381.336C381.038 20.4903 381.96 21.3233 383.41 21.3233C384.861 21.3233 385.971 20.4455 385.971 19.1319C385.971 17.9795 385.141 17.3794 383.688 17.3794H382.464L382.673 16.227L382.996 14.382H384.219C385.604 14.382 386.571 13.5759 386.571 12.3967L386.574 12.3877Z"
          fill="white"
        />
        <path
          d="M383.942 3.04615C391.152 3.04615 397.016 8.91262 397.016 16.1255C397.016 23.3385 391.152 29.2049 383.942 29.2049C376.732 29.2049 370.868 23.3385 370.868 16.1255C370.868 8.91262 376.732 3.04615 383.942 3.04615ZM383.942 0.0606689C375.073 0.0606689 367.884 7.25269 367.884 16.1255C367.884 24.9984 375.073 32.1904 383.942 32.1904C392.811 32.1904 400 24.9984 400 16.1255C400 7.25269 392.811 0.0606689 383.942 0.0606689Z"
          fill="white"
        />
      </g>
      <defs>
        <clipPath id="clip0_836_2441">
          <rect width="400" height="142.79" fill="white" transform="translate(0 0.0606689)" />
        </clipPath>
      </defs>
    </svg>
  )
}
