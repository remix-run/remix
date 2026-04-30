import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

const listboxExamples = [EXAMPLES.listboxOverview]

export function renderComponentListboxPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Listbox"
        description="Listbox is the current headless value-picker primitive. It owns focus movement, highlight state, and selection mechanics while app code owns structure and surrounding UI."
      >
        <div mix={exampleGridCss}>
          {listboxExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>
    </div>
  )
}
