import type { Handle } from 'remix/component'
import { DocsDemo } from 'remix-docs-shared/ui/demo'
import type { LoadedExample } from '../data/examples.tsx'

interface ExampleProps {
  id: string
  example: LoadedExample
  title?: string
  description?: string
  hero?: boolean
  fullBleed?: boolean
}

export function Example(handle: Handle<ExampleProps>) {
  return () => {
    let { id, example, title, description, hero, fullBleed } = handle.props
    let { Component, sourceHtml } = example
    return (
      <div id={id} class={hero ? 'ui-example ui-example-hero' : 'ui-example'}>
        {title ? <h3>{title}</h3> : null}
        {description ? <p>{description}</p> : null}
        <DocsDemo sourceHtml={sourceHtml} fullBleed={fullBleed}>
          <Component />
        </DocsDemo>
      </div>
    )
  }
}
