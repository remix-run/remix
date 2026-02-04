import { type Handle, hydrationRoot } from 'remix/component'

export const ImageCarousel = hydrationRoot(
  import.meta.url + '#ImageCarousel',
  function ImageCarousel(handle: Handle, setup?: { startIndex?: number }) {
    let index = setup?.startIndex ?? 0

    let goPrev = (total: number) => {
      if (index <= 0) return
      index = index - 1
      handle.update()
    }

    let goNext = (total: number) => {
      if (index >= total - 1) return
      index = index + 1
      handle.update()
    }

    return ({ images }: { images: string[] }) => {
      let total = images.length
      if (total === 0) return null
      if (index > total - 1) index = total - 1
      if (index < 0) index = 0

      return (
        <div
          css={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: '#f5f5f5',
          }}
        >
          <div
            css={{
              display: 'flex',
              height: '100%',
              width: '100%',
              transition: 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
            }}
            style={{
              transform: `translateX(-${index * 100}%)`,
            }}
          >
            {images.map((src, i) => (
              <div
                key={src + i}
                css={{
                  minWidth: '100%',
                  height: '100%',
                  position: 'relative',
                }}
              >
                <img
                  src={src}
                  alt={`Image ${i + 1} of ${total}`}
                  css={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          <button
            aria-label="Previous image"
            disabled={index === 0}
            on={{ click: () => goPrev(total) }}
            css={{
              position: 'absolute',
              top: '50%',
              left: '8px',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background-color 150ms ease, opacity 150ms ease',
            }}
            style={{
              opacity: index === 0 ? 0.4 : 0.9,
            }}
          >
            <span css={{ fontSize: '22px', lineHeight: '1' }}>{'‹'}</span>
          </button>

          <button
            aria-label="Next image"
            disabled={index === total - 1}
            on={{ click: () => goNext(total) }}
            css={{
              position: 'absolute',
              top: '50%',
              right: '8px',
              transform: 'translateY(-50%)',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              color: 'white',
              border: 'none',
              borderRadius: '999px',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background-color 150ms ease, opacity 150ms ease',
            }}
            style={{
              opacity: index === total - 1 ? 0.4 : 0.9,
            }}
          >
            <span css={{ fontSize: '22px', lineHeight: '1' }}>{'›'}</span>
          </button>
        </div>
      )
    }
  },
)
