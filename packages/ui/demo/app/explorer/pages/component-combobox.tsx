import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

const comboboxExamples = [EXAMPLES.comboboxOverview]

export function renderComponentComboboxPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Combobox"
        description="Combobox keeps focus on an input while filtering and selecting one committed value from a popup-backed option list."
      >
        <div mix={exampleGridCss}>
          {comboboxExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>
    </div>
  )
}
