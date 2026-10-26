import { css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import {
  animateLayout,
  drag,
  onDrag,
  onDragEnd,
  prefersReducedMotion,
} from '@remix-run/ui/animation'

export default function Reordering(handle: Handle) {
  let items = ['Review API', 'Update examples', 'Run tests', 'Publish preview']
  let rows = new Map<string, HTMLElement>()
  let list: HTMLElement | undefined
  let grabOffset = 0
  let announcement = ''

  function move(item: string, index: number) {
    let from = items.indexOf(item)
    if (from === index) return
    items = items.filter((value) => value !== item)
    items.splice(index, 0, item)
    handle.update()
  }

  function announce(item: string) {
    announcement = `${item}, position ${items.indexOf(item) + 1} of ${items.length}`
    handle.update()
  }

  async function moveFromButton(target: EventTarget | null, item: string, index: number) {
    if (index < 0 || index >= items.length) return
    move(item, index)
    announce(item)
    await handle.update()
    // Keyed DOM movement can blur the activated button.
    if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true })
  }

  function reorder(item: string, pointerY: number) {
    let node = rows.get(item)
    if (!node || !list) return
    let center = pointerY - grabOffset + node.offsetHeight / 2
    let listTop = list.getBoundingClientRect().top
    let from = items.indexOf(item)
    let index = from
    // Hit-test natural slots, not their animated visual positions.
    for (let other of items) {
      let sibling = rows.get(other)
      if (!sibling || other === item) continue
      let siblingIndex = items.indexOf(other)
      let midpoint = listTop + sibling.offsetTop + sibling.offsetHeight / 2
      if (siblingIndex > from && center > midpoint) index = Math.max(index, siblingIndex)
      if (siblingIndex < from && center < midpoint) index = Math.min(index, siblingIndex)
    }
    move(item, index)
  }

  return () => {
    return (
      <section aria-label="Reorder work queue" mix={styles.stage}>
        <ol
          aria-label="Work queue"
          mix={[
            styles.list,
            ref((node) => {
              list = node
            }),
          ]}
        >
          {items.map((item, index) => {
            let options = {
              axis: 'y' as const,
              momentum: false,
              snapToOrigin: true,
            }
            let layout = {
              size: false,
              duration: prefersReducedMotion() ? 0 : 350,
            }
            return (
              <li
                key={item}
                aria-label={item}
                mix={[
                  styles.row,
                  ref((node, signal) => {
                    rows.set(item, node)
                    signal.addEventListener('abort', () => rows.delete(item), { once: true })
                  }),
                  on('pointerdown', (event) => {
                    let node = rows.get(item)
                    if (node) grabOffset = event.clientY - node.getBoundingClientRect().top
                  }),
                  drag(options),
                  onDrag((event) => reorder(item, event.point.y)),
                  onDragEnd(() => announce(item)),
                  animateLayout(layout),
                ]}
              >
                <svg
                  aria-hidden="true"
                  width="16"
                  height="20"
                  viewBox="0 0 16 20"
                  fill="currentColor"
                >
                  <path d="M5 4h2v2H5zm4 0h2v2H9zM5 9h2v2H5zm4 0h2v2H9zM5 14h2v2H5zm4 0h2v2H9z" />
                </svg>
                <span mix={styles.title}>{item}</span>
                <div mix={styles.actions}>
                  <button
                    type="button"
                    aria-label={`Move ${item} up`}
                    aria-disabled={index === 0}
                    mix={[
                      styles.button,
                      on('click', (event) => moveFromButton(event.currentTarget, item, index - 1)),
                    ]}
                  >
                    <Arrow up />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item} down`}
                    aria-disabled={index === items.length - 1}
                    mix={[
                      styles.button,
                      on('click', (event) => moveFromButton(event.currentTarget, item, index + 1)),
                    ]}
                  >
                    <Arrow />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
        <div role="status" mix={styles.status}>
          {announcement}
        </div>
      </section>
    )
  }
}

function Arrow(handle: Handle<{ up?: boolean }>) {
  return () => (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d={handle.props.up ? 'm4 9 4-4 4 4' : 'm4 7 4 4 4-4'} />
    </svg>
  )
}

const styles = {
  stage: css({
    display: 'grid',
    padding: '24px',
    boxSizing: 'border-box',
    width: '100%',
    colorScheme: 'light dark',
    color: 'light-dark(#484852, #d0d0d9)',
    font: '13px/1.5 ui-sans-serif, system-ui, sans-serif',
    overflow: 'clip',
  }),
  list: css({
    position: 'relative',
    display: 'grid',
    gap: '12px',
    padding: '16px 0',
    margin: 0,
    listStyle: 'none',
  }),
  row: css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    border: '1px solid light-dark(#dedee5, #41414a)',
    borderRadius: '12px',
    background: 'light-dark(#fff, #222228)',
    cursor: 'grab',
    '&[data-dragging]': {
      cursor: 'grabbing',
      zIndex: 1,
      boxShadow: '0 8px 18px #0002',
    },
  }),
  title: css({
    flex: 1,
  }),
  actions: css({
    display: 'flex',
    gap: '2px',
  }),
  button: css({
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    width: '28px',
    height: '32px',
    padding: 0,
    border: 0,
    borderRadius: '6px',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    '&:hover:not([aria-disabled="true"])': {
      background: 'light-dark(#eeeef2, #34343d)',
    },
    '&[aria-disabled="true"]': {
      opacity: 0.25,
      cursor: 'default',
    },
    '&:focus-visible': {
      outline: '2px solid currentColor',
      outlineOffset: '2px',
    },
  }),
  status: css({
    position: 'absolute',
    width: '1px',
    height: '1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap',
  }),
}
