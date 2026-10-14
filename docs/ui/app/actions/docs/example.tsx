import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'
import type { LoadedExample } from '../../data/examples.tsx'

interface ExampleProps {
  id: string
  example: LoadedExample
  title?: string
  description?: string
  hero?: boolean
  compact?: boolean
}

export function Example(handle: Handle<ExampleProps>) {
  return () => {
    let { id, example, title, description, hero, compact } = handle.props
    let { Component, sourceHtml } = example
    return (
      <div id={id} class={hero ? 'ui-example ui-example-hero' : 'ui-example'}>
        {title ? <h3>{title}</h3> : null}
        {description ? <p>{description}</p> : null}
        <div class="ui-demo">
          <div
            class={compact ? 'ui-demo-preview ui-demo-preview-compact' : 'ui-demo-preview'}
            data-pagefind-ignore
          >
            <Component />
          </div>
          <div class="ui-demo-source" data-pagefind-ignore>
            <div data-code-block data-demo-source innerHTML={unsafeHTML(sourceHtml)} />
          </div>
        </div>
      </div>
    )
  }
}
