import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'
import type { LoadedExample } from '../data/examples.tsx'
import { ExampleSourceBehavior } from '../ui/public/example-source.tsx'

interface ExampleProps {
  id: string
  example: LoadedExample
  title?: string
  description?: string
  hero?: boolean
}

export function Example(handle: Handle<ExampleProps>) {
  return () => {
    let { id, example, title, description, hero } = handle.props
    let { Component, sourceHtml } = example
    return (
      <div id={id} class={hero ? 'ui-example ui-example-hero' : 'ui-example'}>
        {title ? <h3>{title}</h3> : null}
        {description ? <p>{description}</p> : null}
        <div class="ui-demo">
          <div class="ui-demo-preview" data-pagefind-ignore>
            <Component />
          </div>
          <div class="ui-demo-source" data-pagefind-ignore>
            <div id={`${id}-source`} class="ui-demo-source-code" inert aria-hidden="true">
              <div data-code-block data-demo-source innerHTML={unsafeHTML(sourceHtml)} />
            </div>
            <div class="ui-demo-source-actions">
              <button type="button" aria-expanded="false" aria-controls={`${id}-source`}>
                Show code
              </button>
            </div>
            <ExampleSourceBehavior sourceId={`${id}-source`} />
          </div>
        </div>
      </div>
    )
  }
}
