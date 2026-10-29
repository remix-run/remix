import { css, ref } from 'remix/component'
import { drag } from '@remix-run/ui/animation'

export default function ExamplePanning() {
  let viewport: HTMLElement | undefined
  return () => (
    <div mix={styles.stage}>
      <div
        mix={[
          styles.viewport,
          ref((node: HTMLElement) => {
            viewport = node
          }),
        ]}
      >
        <div
          aria-label="Pan workflow diagram"
          mix={[styles.canvas, drag({ constraints: () => viewport })]}
        >
          <svg
            width="640"
            height="400"
            viewBox="0 0 640 400"
            aria-hidden="true"
            mix={styles.connections}
          >
            <path d="M160 130H320V270H480M320 130H480" />
          </svg>
          <div mix={styles.node} style={{ left: '96px', top: '104px' }}>
            Draft
          </div>
          <div mix={styles.node} style={{ left: '256px', top: '104px' }}>
            Review
          </div>
          <div mix={styles.node} style={{ left: '416px', top: '104px' }}>
            Publish
          </div>
          <div mix={styles.node} style={{ left: '416px', top: '244px' }}>
            Archive
          </div>
        </div>
      </div>
    </div>
  )
}

const styles = {
  stage: css({
    colorScheme: 'light dark',
    width: '100%',
    paddingBlock: '24px',
  }),
  viewport: css({
    position: 'relative',
    width: 'min(360px, 100%)',
    height: '240px',
    marginInline: 'auto',
    overflow: 'clip',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '16px',
    background: 'light-dark(#fafafa, #19191e)',
  }),
  canvas: css({
    position: 'relative',
    left: 'calc(50% - 320px)',
    top: '-80px',
    width: '640px',
    height: '400px',
    backgroundImage: 'radial-gradient(circle, light-dark(#c8c8d0, #41414a) 1px, transparent 1px)',
    backgroundSize: '16px 16px',
    cursor: 'grab',
    '&[data-dragging]': {
      cursor: 'grabbing',
    },
  }),
  connections: css({
    position: 'absolute',
    inset: 0,
    fill: 'none',
    stroke: 'light-dark(#b4b4bf, #666672)',
    strokeWidth: '1.5px',
  }),
  node: css({
    boxSizing: 'border-box',
    position: 'absolute',
    width: '128px',
    height: '52px',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #222228)',
    color: 'light-dark(#484852, #d0d0d9)',
    font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
    boxShadow: '0 4px 12px #00000008',
  }),
}
