import { clientEntry } from 'remix/ui'
import type { Handle } from 'remix/ui'

// Distance the reader must scroll before the header hides, so tiny scrolls
// near the top never flicker it away.
const HIDE_AFTER = 8
// Ignore sub-pixel jitter when deciding scroll direction.
const DIRECTION_THRESHOLD = 4

export const RevealHeaderOnScrollUp = clientEntry(
  import.meta.url,
  function RevealHeaderOnScrollUp(handle: Handle) {
    handle.queueTask((signal) => {
      let header = document.querySelector<HTMLElement>('.site-header')
      if (!header) return

      // Publish the header height so layout (e.g. the sticky TOC) can offset
      // itself and animate as the header reveals or hides.
      function publishHeight() {
        if (!header) return
        document.documentElement.style.setProperty(
          '--site-header-height',
          `${header.offsetHeight}px`,
        )
      }

      publishHeight()

      let resizeObserver = new ResizeObserver(publishHeight)
      resizeObserver.observe(header)
      signal.addEventListener('abort', () => resizeObserver.disconnect())

      let lastScrollY = window.scrollY
      let ticking = false

      function update() {
        ticking = false
        if (!header) return

        let currentY = window.scrollY
        let delta = currentY - lastScrollY

        if (Math.abs(delta) < DIRECTION_THRESHOLD) return

        if (delta > 0 && currentY > HIDE_AFTER) {
          // Scrolling down and past the header: tuck it away.
          header.dataset.hidden = 'true'
        } else if (delta < 0) {
          // Scrolling up anywhere on the page: bring it back.
          delete header.dataset.hidden
        }

        lastScrollY = currentY
      }

      function onScroll() {
        if (ticking) return
        ticking = true
        window.requestAnimationFrame(update)
      }

      window.addEventListener('scroll', onScroll, { passive: true })
      signal.addEventListener('abort', () => window.removeEventListener('scroll', onScroll))
    })

    return () => null
  },
)
