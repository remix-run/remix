import { Frame } from 'remix/component'

import type { ExampleEntry } from '../examples/index.tsx'
import { getExampleContentHref } from '../examples/index.tsx'

export function ExplorerExampleCard() {
  return ({
    description,
    example,
    title,
  }: {
    description?: string
    example: ExampleEntry
    title?: string
  }) => {
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
