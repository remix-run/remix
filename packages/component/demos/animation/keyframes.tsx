export function Keyframes() {
  return () => (
    <div css={{ padding: 60 }}>
      <div
        css={{
          width: 100,
          height: 100,
          backgroundColor: '#888',
          borderRadius: 5,
          // 2s animation + 1s delay = 3s total cycle
          // Original times [0, 0.2, 0.5, 0.8, 1] scaled to first 66.67% of animation
          '@keyframes box-animation': {
            '0%': { transform: 'scale(1) rotate(0deg)', borderRadius: '0%' },
            '13.33%': { transform: 'scale(2) rotate(0deg)', borderRadius: '0%' },
            '33.33%': { transform: 'scale(2) rotate(180deg)', borderRadius: '50%' },
            '53.33%': { transform: 'scale(1) rotate(180deg)', borderRadius: '50%' },
            '66.67%': { transform: 'scale(1) rotate(0deg)', borderRadius: '0%' },
            '100%': { transform: 'scale(1) rotate(0deg)', borderRadius: '0%' },
          },
          animation: 'box-animation 3s ease-in-out infinite',
        }}
      />
    </div>
  )
}
