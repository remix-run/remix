import { css } from 'remix/component'
import { drag } from '@remix-run/ui/animation'

export default function ExampleDragDirectionLock() {
  return () => (
    <div mix={styles.stage}>
      <div mix={styles.bounds}>
        <article
          aria-label="Lock drag direction"
          mix={[
            styles.tile,
            drag({
              directionLock: true,
              constraints: {
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              },
              elasticity: 0.2,
              stiffness: 500,
              dampingRatio: 0.35,
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
            <path data-arrow-axis="x" mix={styles.arrow} d="M4 16h24M8 12l-4 4 4 4M24 12l4 4-4 4" />
            <path data-arrow-axis="y" mix={styles.arrow} d="M16 4v24M12 8l4-4 4 4M12 24l4 4 4-4" />
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
    '&::before, &::after': {
      content: '""',
      position: 'absolute',
      background: 'light-dark(#d8d8e0, #383842)',
      pointerEvents: 'none',
      transition: 'background 120ms',
    },
    '&::before': {
      width: '100%',
      height: '1px',
    },
    '&::after': {
      width: '1px',
      height: '100%',
    },
    '&:has([data-drag-axis="x"])::before, &:has([data-drag-axis="y"])::after': {
      background: 'light-dark(#62626c, #b0b0bb)',
    },
  }),
  arrow: css({
    transition: 'opacity 140ms ease-out',
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
    },
  }),
  tile: css({
    zIndex: 1,
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
    '&[data-drag-axis="x"] [data-arrow-axis="y"], &[data-drag-axis="y"] [data-arrow-axis="x"]': {
      opacity: 0,
    },
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
