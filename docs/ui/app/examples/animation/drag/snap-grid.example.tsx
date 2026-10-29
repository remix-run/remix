import { css } from 'remix/component'
import { drag } from '@remix-run/ui/animation'

export default function ExampleDragSnapGrid() {
  return () => (
    <div mix={styles.stage}>
      <div mix={styles.grid}>
        {Array.from({ length: 25 }, (_, index) => (
          <div key={index} aria-hidden="true" mix={styles.slot} />
        ))}
        <article
          aria-label="Drag between grid slots"
          mix={[
            styles.tile,
            drag({
              constraints: {
                left: -128,
                right: 128,
                top: -128,
                bottom: 128,
              },
              elasticity: 0.15,
              stiffness: 350,
              dampingRatio: 0.85,
              friction: 8,
              modifyTarget: (target) => Math.round(target / 64) * 64,
            }),
          ]}
        >
          <svg
            aria-hidden="true"
            width="28"
            height="28"
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
    paddingBlock: '32px',
  }),
  grid: css({
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 48px)',
    gap: '16px',
  }),
  slot: css({
    boxSizing: 'border-box',
    opacity: 0.75,
    width: '48px',
    height: '48px',
    border: '1px dashed light-dark(#c8c8d0, #555560)',
    borderRadius: '12px',
  }),
  tile: css({
    boxSizing: 'border-box',
    position: 'absolute',
    top: '128px',
    left: '128px',
    display: 'grid',
    placeItems: 'center',
    width: '48px',
    height: '48px',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '12px',
    color: 'light-dark(#484852, #d0d0d9)',
    background: 'light-dark(#fff, #222228)',
    boxShadow: '0 8px 28px #00000012, 0 2px 6px #00000008',
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
