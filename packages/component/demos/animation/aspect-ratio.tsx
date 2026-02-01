import { type Handle } from 'remix/component'
import { spring } from 'remix/component'

export function AspectRatio(handle: Handle) {
  let aspectRatio = 1
  let width = 100

  return () => (
    <div
      css={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div
        css={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: 180,
          height: 180,
        }}
      >
        <div
          css={{
            backgroundColor: '#8df0cc',
            borderRadius: 10,
            transition: spring.transition(['width', 'aspect-ratio'], 'bouncy'),
          }}
          style={{
            width,
            aspectRatio,
          }}
        />
      </div>
      <div css={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <label
          css={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: '#666',
          }}
        >
          <span css={{ width: 50, flexShrink: 0 }}>Ratio</span>
          <input
            type="range"
            value={aspectRatio}
            min={0.2}
            max={3}
            step={0.1}
            css={rangeInputCss}
            on={{
              input(event, signal) {
                let value = event.currentTarget.value

                setTimeout(() => {
                  if (signal.aborted) return
                  aspectRatio = parseFloat(value)
                  handle.update()
                }, 200)
              },
            }}
          />
          <span css={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {aspectRatio.toFixed(1)}
          </span>
        </label>
        <label
          css={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: '#666',
          }}
        >
          <span css={{ width: 50, flexShrink: 0 }}>Width</span>
          <input
            type="range"
            value={width}
            min={20}
            max={160}
            step={5}
            css={rangeInputCss}
            on={{
              input(event, signal) {
                let value = event.currentTarget.value

                setTimeout(() => {
                  if (signal.aborted) return
                  width = parseFloat(value)
                  handle.update()
                }, 200)
              },
            }}
          />
          <span css={{ width: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {width}
          </span>
        </label>
      </div>
    </div>
  )
}

let rangeInputCss = {
  flex: 1,
  accentColor: '#8df0cc',
  cursor: 'pointer',
} as const
