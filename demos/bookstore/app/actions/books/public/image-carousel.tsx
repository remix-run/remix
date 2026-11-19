import { css, type Handle, clientEntry, on, updateUrl } from 'remix/component'

import type { BookImage } from '../../../utils/book-images.ts'

export const faceoutImageSizes = '(max-width: 388px) calc(100vw - 88px), 300px'

export const ImageCarousel = clientEntry(
  import.meta.url,
  function ImageCarousel(handle: Handle<{ images: BookImage[]; startIndex?: number }>) {
    let index = handle.props.startIndex ?? 0

    async function selectImage(nextIndex: number) {
      if (nextIndex < 0 || nextIndex >= handle.props.images.length) return
      index = nextIndex
      await handle.update()

      let url = new URL(window.location.href)
      if (index === 0) url.searchParams.delete('image')
      else url.searchParams.set('image', String(index + 1))
      await updateUrl(url.href, { signal: handle.signal })
    }

    return () => {
      let total = handle.props.images.length
      if (total === 0) return null
      if (index > total - 1) index = total - 1
      if (index < 0) index = 0

      return (
        <div
          mix={css({
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            backgroundColor: '#f5f5f5',
          })}
        >
          <div
            mix={css({
              display: 'flex',
              height: '100%',
              width: '100%',
              transition: 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'transform',
              transform: `translateX(-${index * 100}%)`,
            })}
          >
            {handle.props.images.map((image, i) => (
              <div
                key={image.src + i}
                mix={css({
                  minWidth: '100%',
                  height: '100%',
                  position: 'relative',
                })}
              >
                <img
                  src={image.src}
                  srcset={image.srcSet}
                  sizes={image.srcSet ? faceoutImageSizes : undefined}
                  alt={`Image ${i + 1} of ${total}`}
                  loading={i === index ? 'eager' : 'lazy'}
                  mix={css({
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  })}
                  draggable={false}
                />
              </div>
            ))}
          </div>

          <button
            aria-label="Previous image"
            disabled={index === 0}
            mix={[
              on('click', () => selectImage(index - 1)),
              carouselButtonStyle,
              css({ left: '8px' }),
            ]}
          >
            <span mix={carouselButtonIconStyle}>{'‹'}</span>
          </button>

          <button
            aria-label="Next image"
            disabled={index === total - 1}
            mix={[
              on('click', () => selectImage(index + 1)),
              carouselButtonStyle,
              css({ right: '8px' }),
            ]}
          >
            <span mix={carouselButtonIconStyle}>{'›'}</span>
          </button>
        </div>
      )
    }
  },
)

const carouselButtonStyle = css({
  position: 'absolute',
  top: '50%',
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
  opacity: 0.9,
  '&:disabled': { opacity: 0.4 },
})

const carouselButtonIconStyle = css({ fontSize: '22px', lineHeight: '1' })
