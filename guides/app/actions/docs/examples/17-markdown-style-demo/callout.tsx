import { css } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'

import type { AppContext } from '../../../../router.ts'

export async function handler(context: AppContext) {
  return context.render(<Callouts />)
}

function Callouts() {
  return () => (
    <div mix={calloutGridStyles}>
      <Callout tone="brand" title="Start with the route">
        Make the server response correct before adding browser behavior.
      </Callout>
      <Callout tone="neutral" title="Add frames when a region has its own lifecycle">
        Frames keep the embedded UI route-owned while the surrounding guide stays plain Markdown.
      </Callout>
    </div>
  )
}

function Callout(
  handle: Handle<{
    tone: 'brand' | 'neutral'
    title: string
    children: RemixNode
  }>,
) {
  return () => (
    <article mix={[calloutStyles, calloutToneStyles[handle.props.tone]]}>
      <h4 mix={calloutTitleStyles}>{handle.props.title}</h4>
      <p mix={calloutBodyStyles}>{handle.props.children}</p>
    </article>
  )
}

const calloutGridStyles = css({
  display: 'grid',
  gap: '0.75rem',
  margin: '1.5rem 0',
})

const calloutStyles = css({
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  background: 'var(--bg)',
})

const calloutToneStyles = {
  brand: css({
    borderColor: 'color-mix(in srgb, var(--red-brand), var(--border) 60%)',
    boxShadow: 'inset 4px 0 0 var(--red-brand)',
  }),
  neutral: css({
    boxShadow: 'inset 4px 0 0 var(--fg-subtle)',
  }),
}

const calloutTitleStyles = css({
  margin: '0 0 0.375rem',
  fontSize: '1rem',
  lineHeight: '1.3',
})

const calloutBodyStyles = css({
  margin: '0',
  color: 'var(--fg-muted)',
})
