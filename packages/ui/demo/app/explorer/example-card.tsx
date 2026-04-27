import { Frame } from 'remix/component'
import type { Handle } from 'remix/component'

import type { ExampleEntry } from '../examples/index.tsx'
import { getExampleContentHref } from '../examples/index.tsx'

interface ExplorerExampleCardProps {
  description?: string
  example: ExampleEntry
  title?: string
}

export function ExplorerExampleCard(handle: Handle<ExplorerExampleCardProps>) {
  return () => {
    let { description, example, title } = handle.props
    let nextTitle = title ?? example.title
    let nextDescription = description ?? example.description

    return (
      <Frame
        src={getExampleContentHref(example, {
          description: nextDescription === example.description ? undefined : nextDescription,
          title: nextTitle === example.title ? undefined : nextTitle,
        })}
      />
    )
  }
}
