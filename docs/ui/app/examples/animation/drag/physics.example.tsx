import { drag } from '@remix-run/ui/animation'
import { css, on } from 'remix/component'
import type { Handle } from 'remix/component'

export default function ExampleDragPhysics(handle: Handle) {
  let elasticity = 0.2
  let stiffness = 350
  let dampingRatio = 0.5

  return () => (
    <div mix={styles.stage}>
      <div mix={styles.surface}>
        <div mix={styles.origin}>
          <article
            aria-label="Explore drag physics"
            mix={[
              styles.tile,
              drag({
                constraints: { left: 0, right: 0, top: 0, bottom: 0 },
                elasticity,
                momentum: false,
                stiffness,
                dampingRatio,
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
      <div mix={styles.controls}>
        <label mix={styles.control}>
          <span>
            Elasticity{' '}
            <span mix={styles.value} aria-hidden="true">
              {elasticity}
            </span>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={elasticity}
            mix={on('input', (event) => {
              elasticity = event.currentTarget.valueAsNumber
              handle.update()
            })}
          />
        </label>
        <label mix={styles.control}>
          <span>
            Stiffness{' '}
            <span mix={styles.value} aria-hidden="true">
              {stiffness}
            </span>
          </span>
          <input
            type="range"
            min="100"
            max="700"
            step="50"
            value={stiffness}
            mix={on('input', (event) => {
              stiffness = event.currentTarget.valueAsNumber
              handle.update()
            })}
          />
        </label>
        <label mix={styles.control}>
          <span>
            Damping ratio{' '}
            <span mix={styles.value} aria-hidden="true">
              {dampingRatio}
            </span>
          </span>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={dampingRatio}
            mix={on('input', (event) => {
              dampingRatio = event.currentTarget.valueAsNumber
              handle.update()
            })}
          />
        </label>
      </div>
    </div>
  )
}

const styles = {
  stage: css({
    colorScheme: 'light dark',
    width: '100%',
    font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
    color: 'light-dark(#484852, #d0d0d9)',
  }),
  surface: css({
    display: 'grid',
    placeItems: 'center',
    height: '260px',
    overflow: 'clip',
  }),
  origin: css({
    boxSizing: 'border-box',
    display: 'grid',
    placeContent: 'center',
    width: '72px',
    height: '72px',
    border: '1px dashed light-dark(#c8c8d0, #555560)',
    borderRadius: '16px',
  }),
  tile: css({
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    width: '72px',
    height: '72px',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '16px',
    background: 'light-dark(#fff, #222228)',
    boxShadow: '0 8px 28px #00000012, 0 2px 6px #00000008',
    cursor: 'grab',
    '&[data-dragging]': {
      cursor: 'grabbing',
    },
  }),
  controls: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px 24px',
    padding: '16px 24px 24px',
    borderTop: '1px solid light-dark(#e6e6ec, #35353e)',
  }),
  value: css({
    float: 'right',
    fontVariantNumeric: 'tabular-nums',
  }),
  control: css({
    display: 'grid',
    gap: '8px',
    flex: '1 1 160px',
    '& input': {
      width: '100%',
      margin: 0,
      accentColor: 'currentColor',
    },
  }),
}
