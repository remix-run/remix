import { css, ref } from 'remix/component'
import { drag } from '@remix-run/ui/animation'

export default function ExampleDragConstraints() {
  let container: HTMLElement | undefined
  return () => (
    <div mix={styles.stage}>
      <div
        mix={[
          styles.bounds,
          ref((node: HTMLElement) => {
            container = node
          }),
        ]}
      >
        <article
          aria-label="Drag within container"
          mix={[
            styles.tile,
            drag({
              constraints: () => container,
            }),
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
      </div>
    </div>
  )
}

const styles = {
  stage: css({
    colorScheme: 'light dark',
    display: 'grid',
    placeItems: 'center',
    width: '100%',
    paddingBlock: '24px',
    font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
  }),
  bounds: css({
    display: 'grid',
    placeItems: 'center',
    position: 'relative',
    width: 'min(280px, 100%)',
    height: '240px',
    border: '1px dashed light-dark(#c8c8d0, #555560)',
    borderRadius: '20px',
    background: 'light-dark(#f5f5f8, #19191e)',
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
    fontSize: '28px',
    cursor: 'grab',
    transition: 'scale 140ms, box-shadow 140ms',
    '&[data-dragging]': {
      cursor: 'grabbing',
      scale: '1.06',
      boxShadow: '0 16px 32px #00000024',
    },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),
}
