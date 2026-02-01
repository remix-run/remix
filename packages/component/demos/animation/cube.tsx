import type { Handle } from 'remix/component'

export function Cube(handle: Handle) {
  let cube: HTMLDivElement

  function animate(t: number) {
    if (handle.signal.aborted) return

    let rotate = Math.sin(t / 10000) * 200
    let y = (1 + Math.sin(t / 1000)) * -25
    cube.style.transform = `translateY(${y}px) rotateX(${rotate}deg) rotateY(${rotate}deg)`

    requestAnimationFrame(animate)
  }

  return () => (
    <div
      css={{
        perspective: '400px',
        width: '100px',
        height: '100px',
      }}
    >
      <div
        connect={(node) => {
          cube = node
          requestAnimationFrame(animate)
        }}
        css={{
          width: '100px',
          height: '100px',
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          css={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.6,
            transform: 'rotateY(0deg) translateZ(50px)',
            backgroundColor: '#ff0055',
          }}
        />
        <div
          css={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.6,
            transform: 'rotateY(90deg) translateZ(50px)',
            backgroundColor: '#0099ff',
          }}
        />
        <div
          css={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.6,
            transform: 'rotateY(180deg) translateZ(50px)',
            backgroundColor: '#22cc88',
          }}
        />
        <div
          css={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.6,
            transform: 'rotateY(-90deg) translateZ(50px)',
            backgroundColor: '#ffaa00',
          }}
        />
        <div
          css={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.6,
            transform: 'rotateX(90deg) translateZ(50px)',
            backgroundColor: '#aa00ff',
          }}
        />
        <div
          css={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0.6,
            transform: 'rotateX(-90deg) translateZ(50px)',
            backgroundColor: '#ff00aa',
          }}
        />
      </div>
    </div>
  )
}
