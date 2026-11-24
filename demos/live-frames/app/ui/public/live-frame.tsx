import { clientEntry, css, Frame, on, ref, type Handle } from 'remix/component'

const surface = css({
  border: '1px solid #d8dee9',
  borderRadius: '10px',
  overflow: 'hidden',
  background: 'white',
})

const scrollable = css({ maxHeight: '16rem', overflowY: 'auto' })

/**
 * Mounts a frame that reads its source as a live connection.
 *
 * The frame mounts from a queued task, which only runs in the browser: a frame rendered on the
 * server resolves while the page does, and an open event stream never finishes resolving.
 *
 * The surface lives here rather than in the streamed HTML because appended events join the frame's
 * content, so only an element outside the frame can contain everything a stream has sent.
 */
export const LiveFrame = clientEntry(
  import.meta.url,
  function LiveFrame(
    handle: Handle<{
      title: string
      note: string
      src: string
      follow?: boolean
      count?: boolean
    }>,
  ) {
    let mounted = false
    let lines = 0

    handle.queueTask(() => {
      mounted = true
      handle.update()
    })

    // The frame renders what the server pushes; the heading around it stays current by counting
    // rows whenever the frame says it rendered something.
    let countLines = on('rmx:update', (event) => {
      lines = event.currentTarget.querySelectorAll('[data-line]').length
      handle.update()
    })

    return () => (
      <section mix={css({ marginBottom: '2rem' })}>
        <h2 mix={css({ fontSize: '1.1rem', marginBottom: '0.15rem', color: '#0f172a' })}>
          {handle.props.title}
          {handle.props.count ? ` · ${lines} line${lines === 1 ? '' : 's'}` : ''}
        </h2>
        <p mix={css({ color: '#64748b', fontSize: '0.85rem', marginBottom: '0.5rem' })}>
          {handle.props.note}
        </p>
        <div
          mix={[
            surface,
            handle.props.follow ? [scrollable, ref(followNewContent)] : [],
            handle.props.count ? countLines : [],
          ]}
        >
          {mounted ? <Frame src={handle.props.src} fallback={<Connecting />} /> : <Connecting />}
        </div>
      </section>
    )
  },
)

// Keeps the newest content in view, but only while the reader is already at the bottom, so
// scrolling back through what arrived earlier is not yanked away by the next event.
function followNewContent(node: Element, signal: AbortSignal): void {
  let pinned = true

  let observer = new MutationObserver(() => {
    if (pinned) node.scrollTop = node.scrollHeight
  })
  observer.observe(node, { childList: true, subtree: true, characterData: true })
  signal.addEventListener('abort', () => observer.disconnect(), { once: true })

  node.addEventListener(
    'scroll',
    () => {
      pinned = node.scrollHeight - node.scrollTop - node.clientHeight < 8
    },
    { signal },
  )
}

function Connecting(handle: Handle) {
  return () => <p mix={css({ padding: '1rem', color: '#64748b' })}>Connecting…</p>
}
