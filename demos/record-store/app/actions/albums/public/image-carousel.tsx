import type { Handle } from 'remix/component'
import { clientEntry, css, on, ref, updateUrl } from 'remix/component'

import type { Album } from '../../../data/schema.ts'
import type { AlbumImage } from '../../../utils/album-images.ts'
import { albumCoverTransition } from '../../../ui/album-transitions.ts'

export const faceoutImageSizes = '(max-width: 388px) calc(100vw - 88px), 300px'

export const ImageCarousel = clientEntry(
  import.meta.url,
  function ImageCarousel(
    handle: Handle<{ albumId: Album['id']; images: AlbumImage[]; startIndex?: number }>,
  ) {
    let index = handle.props.startIndex ?? 0
    let hydrated = false
    let positioned = false
    let track: HTMLDivElement | undefined
    let previousButton: HTMLButtonElement | undefined
    let nextButton: HTMLButtonElement | undefined
    let pendingIndex: number | undefined
    let announcement = ''
    let settleTimeout: ReturnType<typeof setTimeout> | undefined
    let supportsScrollEnd =
      typeof HTMLElement !== 'undefined' && 'onscrollend' in HTMLElement.prototype

    handle.queueTask(() => {
      hydrated = true
      void handle.update()
    })
    handle.signal.addEventListener('abort', () => clearTimeout(settleTimeout))

    function moveImage(direction: number) {
      if (!track) return
      selectImage((pendingIndex ?? Math.round(track.scrollLeft / track.clientWidth)) + direction)
    }

    function selectImage(nextIndex: number) {
      if (!track || !positioned) return
      if (nextIndex < 0 || nextIndex >= handle.props.images.length) return
      pendingIndex = nextIndex
      track.scrollTo({
        left: nextIndex * track.clientWidth,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      })
    }

    async function settleImage() {
      if (!track || !positioned || track.clientWidth === 0) return
      let nextIndex = Math.round(track.scrollLeft / track.clientWidth)
      if (pendingIndex !== undefined && nextIndex !== pendingIndex) return
      pendingIndex = undefined
      if (nextIndex === index) return
      index = nextIndex
      announcement = `Image ${index + 1} of ${handle.props.images.length}`
      let focusTarget: HTMLButtonElement | undefined
      if (index === 0 && document.activeElement === previousButton) {
        focusTarget = nextButton
      } else if (
        index === handle.props.images.length - 1 &&
        document.activeElement === nextButton
      ) {
        focusTarget = previousButton
      }
      await handle.update()
      focusTarget?.focus()

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

      if (hydrated && !positioned) {
        handle.queueTask(() => {
          if (!track) return
          track.scrollTo({ left: index * track.clientWidth, behavior: 'instant' })
          positioned = true
        })
      }

      return (
        <div
          role="region"
          aria-label="Record images"
          aria-roledescription="carousel"
          mix={css({
            position: 'relative',
            width: '100%',
          })}
        >
          <div
            data-album-faceout={handle.props.albumId}
            mix={[
              albumCoverTransition(handle.props.albumId),
              css({
                position: 'relative',
                width: '100%',
                aspectRatio: '1 / 1',
                borderRadius: '8px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                backgroundColor: '#f5f5f5',
              }),
            ]}
          >
            <button
              type="button"
              aria-label="Previous image"
              disabled={index === 0}
              mix={[
                ref((node: HTMLButtonElement) => {
                  previousButton = node
                }),
                on('click', () => moveImage(-1)),
                carouselButtonStyle,
                css({ left: '8px' }),
              ]}
            >
              <span aria-hidden="true" mix={carouselButtonIconStyle}>
                {'‹'}
              </span>
            </button>

            <button
              type="button"
              aria-label="Next image"
              disabled={index === total - 1}
              mix={[
                ref((node: HTMLButtonElement) => {
                  nextButton = node
                }),
                on('click', () => moveImage(1)),
                carouselButtonStyle,
                css({ right: '8px' }),
              ]}
            >
              <span aria-hidden="true" mix={carouselButtonIconStyle}>
                {'›'}
              </span>
            </button>

            <div
              role="group"
              aria-label="Images"
              tabIndex={hydrated ? 0 : undefined}
              mix={[
                ref((node: HTMLDivElement) => {
                  track = node
                }),
                on(supportsScrollEnd ? 'scrollend' : 'scroll', () => {
                  if (supportsScrollEnd) {
                    void settleImage()
                  } else {
                    clearTimeout(settleTimeout)
                    settleTimeout = setTimeout(() => {
                      void settleImage()
                    }, 150)
                  }
                }),
                on('pointerdown', () => {
                  pendingIndex = undefined
                }),
                on('wheel', () => {
                  pendingIndex = undefined
                }),
                on('keydown', () => {
                  pendingIndex = undefined
                }),
                css({
                  display: 'flex',
                  height: '100%',
                  width: '100%',
                  overflowX: hydrated ? 'auto' : 'visible',
                  overflowY: hydrated ? 'hidden' : 'visible',
                  scrollbarWidth: 'none',
                  '&::-webkit-scrollbar': { display: 'none' },
                  scrollSnapType: 'x mandatory',
                  overscrollBehaviorX: 'contain',
                  // Keep the requested image visible before hydration and without JavaScript.
                  transform: hydrated ? undefined : `translateX(-${index * 100}%)`,
                  '&:focus-visible': { outline: '3px solid #1f2937', outlineOffset: '-3px' },
                }),
              ]}
            >
              {handle.props.images.map((image, i) => (
                <div
                  key={image.src + i}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${total}`}
                  mix={css({
                    flex: '0 0 100%',
                    minWidth: 0,
                    height: '100%',
                    position: 'relative',
                    scrollSnapAlign: 'start',
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
          </div>

          {total > 1 && (
            <div
              role="group"
              aria-label="Choose image"
              mix={css({
                display: 'flex',
                justifyContent: 'center',
                marginTop: '4px',
              })}
            >
              {handle.props.images.map((image, i) => (
                <button
                  key={image.src + i}
                  type="button"
                  aria-label={`Show image ${i + 1} of ${total}`}
                  aria-current={i === index ? 'true' : undefined}
                  mix={[
                    on('click', () => selectImage(i)),
                    css({
                      display: 'grid',
                      placeItems: 'center',
                      width: '28px',
                      height: '28px',
                      padding: 0,
                      borderRadius: '999px',
                      '&:focus-visible': {
                        outline: '2px solid #1f2937',
                        outlineOffset: '-2px',
                      },
                      '& > span': {
                        width: '8px',
                        height: '8px',
                        border: '2px solid #1f2937',
                        borderRadius: '50%',
                        background: '#1f2937',
                        opacity: 0.6,
                        '@media (forced-colors: active)': { opacity: 1 },
                      },
                      '&[aria-current="true"] > span': {
                        width: '12px',
                        height: '12px',
                        opacity: 1,
                      },
                    }),
                  ]}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
          )}

          <p
            role="status"
            aria-atomic="true"
            mix={css({
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clipPath: 'inset(50%)',
              whiteSpace: 'nowrap',
            })}
          >
            {announcement}
          </p>
        </div>
      )
    }
  },
)

const carouselButtonStyle = css({
  position: 'absolute',
  zIndex: 1,
  top: '50%',
  transform: 'translateY(-50%)',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#1f2937',
  color: 'white',
  border: 'none',
  borderRadius: '999px',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: '3px solid white',
    outlineOffset: '2px',
    boxShadow: '0 0 0 6px #1f2937',
  },
  transition: 'background-color 150ms ease, opacity 150ms ease',
  opacity: 0.9,
  '&:disabled': { opacity: 0.4 },
})

const carouselButtonIconStyle = css({ fontSize: '22px', lineHeight: '1' })
