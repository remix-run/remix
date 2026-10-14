import { unsafeHTML } from 'remix/component'
import type { Handle } from 'remix/component'
import type { LoadedExample } from '../../data/examples.tsx'

export function Example(handle: Handle<{ example: LoadedExample; showHeading?: boolean }>) {
  return () => {
    let { definition, Component, sourceHtml } = handle.props.example
    return (
      <div
        id={definition.id}
        class={definition.section ? 'ui-example' : 'ui-example ui-example-hero'}
      >
        {definition.section && handle.props.showHeading ? (
          <>
            <h3>{definition.title}</h3>
            {definition.description ? <p>{definition.description}</p> : null}
          </>
        ) : null}
        <div class="ui-demo">
          <div
            class={
              definition.previewSize === 'compact'
                ? 'ui-demo-preview ui-demo-preview-compact'
                : 'ui-demo-preview'
            }
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
