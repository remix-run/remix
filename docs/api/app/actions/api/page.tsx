import type { Handle } from 'remix/component'
import { unsafeHTML } from 'remix/component'

export function MarkdownContent(handle: Handle<{ html: string }>) {
  return () => <div innerHTML={unsafeHTML(handle.props.html)} />
}

export function NotFound(handle: Handle<{ slug: string }>) {
  return () => (
    <div class="error">
      <p>Could not find a document at:</p>
      <p>
        <code>{handle.props.slug}</code>
      </p>
    </div>
  )
}
