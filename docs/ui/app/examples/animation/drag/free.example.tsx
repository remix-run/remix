import { animateEntrance, animateExit, prefersReducedMotion, drag } from '@remix-run/ui/animation'
import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleDrag(handle: Handle) {
  let generation = 0
  let outside = false
  return () => (
    <div mix={styles.stage}>
      <article
        key={generation}
        aria-label="Drag anywhere"
        mix={[
          styles.tile,
          ref((node, signal) => {
            let observer = new IntersectionObserver(
              ([entry]) => {
                let next = entry.intersectionRatio < 1
                if (outside === next) return
                outside = next
                handle.update()
              },
              { root: node.parentElement, threshold: 1 },
            )
            observer.observe(node)
            signal.addEventListener('abort', () => observer.disconnect(), { once: true })
          }),
          drag(),
        ]}
      >
        <svg
          aria-hidden="true"
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M16 4v24M4 16h24M12 8l4-4 4 4M12 24l4 4 4-4M8 12l-4 4 4 4M24 12l4 4-4 4" />
        </svg>
      </article>
      {outside && (
        <button
          key="reset"
          type="button"
          mix={[
            styles.reset,
            animateEntrance({
              opacity: 0,
              duration: prefersReducedMotion() ? 0 : 140,
            }),
            animateExit({
              opacity: 0,
              duration: prefersReducedMotion() ? 0 : 100,
            }),
            on('click', () => {
              outside = false
              generation++
              handle.update()
            }),
          ]}
        >
          Reset position
        </button>
      )}
    </div>
  )
}

const styles = {
  stage: css({
    colorScheme: 'light dark',
    display: 'grid',
    justifyItems: 'center',
    alignItems: 'center',
    position: 'relative',
    height: '320px',
    width: '100%',
  }),
  tile: css({
    display: 'grid',
    placeItems: 'center',
    width: '72px',
    height: '72px',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '16px',
    color: 'light-dark(#484852, #d0d0d9)',
    background: 'light-dark(#fff, #222228)',
    boxShadow: '0 8px 28px #00000012, 0 2px 6px #00000008',
    font: '32px/1 ui-sans-serif, system-ui, sans-serif',
    cursor: 'grab',
    '&[data-dragging]': {
      cursor: 'grabbing',
    },
  }),
  reset: css({
    position: 'absolute',
    bottom: '12px',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: 'light-dark(#484852, #d0d0d9)',
    background: 'light-dark(#fff, #222228)',
    font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
  }),
}
