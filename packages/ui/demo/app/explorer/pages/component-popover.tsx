import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderComponentPopoverPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Popover"
        description="Popover is the low-level anchored surface primitive, while related popup-backed controls still keep their own contracts."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard example={EXAMPLES.popoverOverview} />
          <ExplorerExampleCard example={EXAMPLES.popoverContract} />
          <ExplorerExampleCard example={EXAMPLES.menuContract} />
          <ExplorerExampleCard example={EXAMPLES.listboxContract} />
        </div>
      </PageSection>
    </div>
  )
}
