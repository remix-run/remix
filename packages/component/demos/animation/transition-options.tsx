export function TransitionOptions() {
  return () => (
    <div
      css={{
        width: 100,
        height: 100,
        borderRadius: '50%',
        backgroundColor: '#9911ff',
      }}
      animate={{
        enter: {
          opacity: 0,
          transform: 'scale(0.5)',
          duration: 800,
          delay: 500,
          easing: 'cubic-bezier(0, 0.71, 0.2, 1.01)',
        },
      }}
    />
  )
}
