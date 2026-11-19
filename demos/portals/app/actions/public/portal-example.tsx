import { clientEntry, css, Frame, on, Portal, type Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { styles } from './styles.ts'

export const Reload = clientEntry(
  import.meta.url,
  function Reload(handle: Handle<{ label: string; top?: boolean }>) {
    return () => (
      <button
        type="button"
        mix={[
          styles.button,
          on('click', async () => {
            await (handle.props.top ? handle.frames.top : handle.frame).reload()
          }),
        ]}
      >
        {handle.props.label}
      </button>
    )
  },
)

export const PortalExample = clientEntry(
  import.meta.url,
  function PortalExample(handle: Handle<{ servedAt: string; renderId: string }>) {
    let placement = 'body'
    let container: HTMLElement | undefined
    let mounted = true
    let second = false

    return () => (
      <section
        class="owner"
        aria-label="Portal owner"
        mix={[styles.panel, css({ marginBottom: 20 })]}
      >
        <header mix={styles.header}>
          <h2 mix={styles.heading}>Owner</h2>
          <time
            mix={[styles.muted, styles.timestamp]}
            dateTime={handle.props.servedAt}
            data-render-id={handle.props.renderId}
          >
            {handle.props.servedAt.slice(11, 23)}
          </time>
          <Reload label="Reload owner" />
        </header>
        <div mix={[styles.row, css({ marginTop: 18 })]}>
          <label mix={styles.label}>
            Destination{' '}
            <select
              value={placement}
              mix={[
                styles.field,
                css({ minHeight: 36, padding: '6px 10px' }),
                on('change', (event) => {
                  let next = event.currentTarget.value
                  let destination =
                    next === 'body' ? undefined : document.getElementById(`container-${next}`)
                  if (next !== 'body' && !destination) throw new Error('Destination has not loaded')
                  placement = next
                  container = destination ?? undefined
                  handle.update()
                }),
              ]}
            >
              <option value="body">Body</option>
              <option value="a">Container A</option>
              <option value="b">Container B</option>
            </select>
          </label>
          <label mix={styles.label}>
            <input
              type="checkbox"
              checked={mounted}
              mix={[
                styles.checkbox,
                on('change', (event) => {
                  mounted = event.currentTarget.checked
                  handle.update()
                }),
              ]}
            />{' '}
            Mounted
          </label>
          <label mix={styles.label}>
            <input
              type="checkbox"
              checked={second}
              mix={[
                styles.checkbox,
                on('change', (event) => {
                  second = event.currentTarget.checked
                  handle.update()
                }),
              ]}
            />{' '}
            Second portal
          </label>
        </div>
        <p mix={[styles.muted, css({ margin: '14px 0 0' })]}>
          Retargeting resets local state. Reloading keeps it.
        </p>
        {mounted && (
          <Portal container={container}>
            <PortalCard placement={placement} />
          </Portal>
        )}
        {second && (
          <Portal container={container}>
            <aside
              class="companion"
              data-placement={placement}
              mix={[
                styles.secondary,
                css({
                  marginTop: 12,
                  '&[data-placement="body"]': { maxWidth: 960, margin: '20px auto 0' },
                }),
              ]}
            >
              Second portal
            </aside>
          </Portal>
        )}
      </section>
    )
  },
)

function PortalCard(handle: Handle<{ placement: string }>) {
  let count = 0
  let nested = false

  return () => (
    <article
      class="portal"
      data-placement={handle.props.placement}
      aria-label="Portal content"
      mix={[
        css({
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 18,
          background: 'var(--surface)',
          marginTop: 18,
          '&[data-placement="body"]': { maxWidth: 960, margin: '20px auto 0' },
        }),
      ]}
    >
      <header mix={styles.header}>
        <h2 mix={styles.heading}>Portal</h2>
        <span
          mix={[
            styles.muted,
            css({
              border: '1px solid var(--subtle-border)',
              borderRadius: 4,
              padding: '3px 6px',
            }),
          ]}
        >
          {handle.props.placement === 'body'
            ? 'Body'
            : `Container ${handle.props.placement.toUpperCase()}`}
        </span>
      </header>
      <textarea
        aria-label="Portal note"
        autoComplete="off"
        placeholder="Type a note…"
        rows={3}
        mix={[
          styles.field,
          css({
            display: 'block',
            width: '100%',
            padding: 10,
            resize: 'vertical',
            margin: '16px 0 12px',
          }),
          on('keydown', async (event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              await handle.frame.reload()
            }
          }),
        ]}
      />
      <div mix={styles.row}>
        <button
          type="button"
          mix={[
            styles.button,
            on('click', () => {
              count++
              handle.update()
            }),
          ]}
        >
          Count {count}
        </button>
        <button
          type="button"
          aria-expanded={nested}
          mix={[
            styles.button,
            on('click', () => {
              nested = !nested
              handle.update()
            }),
          ]}
        >
          Nested portal
        </button>
      </div>
      <Frame name="inside-portal" src={routes.inside.href()} />
      {nested && (
        <Portal>
          <aside
            class="nested"
            aria-label="Nested portal"
            mix={[styles.header, styles.secondary, css({ maxWidth: 960, margin: '20px auto 0' })]}
          >
            Nested portal · Body
            <button
              type="button"
              mix={[
                styles.button,
                on('click', () => {
                  nested = false
                  handle.update()
                }),
              ]}
            >
              Close nested portal
            </button>
          </aside>
        </Portal>
      )}
    </article>
  )
}
