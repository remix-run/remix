import { spring } from 'remix/component'

export function Rotate() {
  return () => (
    <div
      css={{
        width: 100,
        height: 100,
        backgroundColor: '#ff0088',
        borderRadius: 5,
        '@keyframes rotate-demo': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        animation: `rotate-demo 1s ease-in-out 1`,
      }}
    />
  )
}
