import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderComponentButtonPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Button"
        description="Button stays intentionally small: a thin wrapper for ordinary actions plus slot-level styles for custom structure."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard example={EXAMPLES.buttonAliases} />
          <ExplorerExampleCard example={EXAMPLES.buttonBaseTone} />
          <ExplorerExampleCard example={EXAMPLES.buttonSlotsStates} />
        </div>
      </PageSection>
    </div>
  )
}
