import { ExamplePreview } from '../example-preview.tsx'
import type { ExampleEntry } from '../examples/index.tsx'

export function ExplorerExampleCard() {
  return ({
    description,
    example,
    title,
  }: {
    description?: string
    example: ExampleEntry
    title?: string
  }) => (
    <ExamplePreview
      code={example.code}
      description={description ?? example.description}
      href={example.path}
      title={title ?? example.title}
    >
      {example.preview}
    </ExamplePreview>
  )
}
