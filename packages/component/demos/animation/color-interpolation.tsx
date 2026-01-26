/*
 * A comparison of color interpolation methods.
 *
 * The "dimming effect" in browser animations happens because sRGB is
 * gamma-encoded, so linear interpolation passes through desaturated colors.
 *
 * The OKLCH box uses the @property hack: register a custom property as <number>,
 * animate it 0→1, then use color-mix(in oklch, ...) with that number.
 */
export function ColorInterpolation() {
  return () => (
    <div css={{ display: 'flex', gap: 30, alignItems: 'center', justifyContent: 'center' }}>
      <style>
        {`
          @property --color-t {
            syntax: '<number>';
            inherits: false;
            initial-value: 0;
          }

          @keyframes color-t-anim {
            0%, 100% { --color-t: 0; }
            50% { --color-t: 1; }
          }

          .oklch-box {
            animation: color-t-anim 4s linear infinite;
            background-color: color-mix(
              in oklch,
              #ff0088 calc((1 - var(--color-t)) * 100%),
              #0d63f8 calc(var(--color-t) * 100%)
            );
          }
        `}
      </style>

      <div css={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          css={{
            width: 100,
            height: 100,
            borderRadius: 8,
            backgroundColor: '#ff0088',
            '@keyframes srgb-color': {
              '0%, 100%': { backgroundColor: '#ff0088' },
              '50%': { backgroundColor: '#0d63f8' },
            },
            animation: 'srgb-color 4s linear infinite',
          }}
        />
        <div css={{ fontSize: 14, color: '#666' }}>sRGB</div>
      </div>

      <div css={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          className="oklch-box"
          css={{
            width: 100,
            height: 100,
            borderRadius: 8,
          }}
        />
        <div css={{ fontSize: 14, color: '#666' }}>OKLCH</div>
      </div>
    </div>
  )
}
