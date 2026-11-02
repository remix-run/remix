import { unsafeHTML } from 'remix/component'
import type { Handle, RemixNode } from 'remix/component'

import { DemoSourceBehavior } from './public/demo-source.tsx'

export interface DocsDemoProps {
  /** Highlighted source HTML. The source starts collapsed behind a "Show code" button. */
  sourceHtml?: string
  /** Live demo rendered in the preview area. */
  children: RemixNode
}

export function DocsDemo(handle: Handle<DocsDemoProps>) {
  return () => {
    let { sourceHtml, children } = handle.props
    let sourceId = `${handle.id}-source`

    return (
      <div class="docs-demo">
        <div class="docs-demo-preview" data-pagefind-ignore>
          {children}
        </div>
        {sourceHtml ? (
          <div class="docs-demo-source" data-pagefind-ignore>
            <div id={sourceId} class="docs-demo-source-code" inert aria-hidden="true">
              <div data-code-block data-demo-source innerHTML={unsafeHTML(sourceHtml)} />
            </div>
            <div class="docs-demo-source-actions">
              <button type="button" aria-expanded="false" aria-controls={sourceId}>
                Show code
              </button>
            </div>
            <DemoSourceBehavior sourceId={sourceId} />
          </div>
        ) : null}
      </div>
    )
  }
}
