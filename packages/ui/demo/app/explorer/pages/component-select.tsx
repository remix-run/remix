import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

const selectExamples = [EXAMPLES.selectOverview, EXAMPLES.selectDeconstructed]

export function renderComponentSelectPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Select"
        description="Select packages the ordinary single-select button + popover interaction into one component while keeping the list-focused keyboard model and optional form serialization built in."
      >
        <div mix={exampleGridCss}>
          {selectExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>
    </div>
  )
}
