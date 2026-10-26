import { css } from 'remix/component'
import { drag } from '@remix-run/ui/animation'

export default function ExampleDrag() {
  return () => (
    <div mix={styles.stage}>
      <article
        aria-label="Drag vertically"
        mix={[
          styles.tile,
          drag({
            snapToOrigin: true,
            axis: 'y',
          }),
        ]}
      >
        <span aria-hidden="true">↕</span>
      </article>
    </div>
  )
}

const styles = {
  stage: css({
    colorScheme: 'light dark',
    display: 'grid',
    justifyItems: 'center',
    paddingBlock: '72px',
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
}
