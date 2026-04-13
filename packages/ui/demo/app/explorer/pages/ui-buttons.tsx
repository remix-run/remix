import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderUiButtonsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="UI buttons"
        description="Buttons should expose both fast aliases and deliberate composition without wrapper-heavy APIs."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard example={EXAMPLES.buttonAliases} />
          <ExplorerExampleCard example={EXAMPLES.buttonBaseSizeTone} />
          <ExplorerExampleCard example={EXAMPLES.buttonSizes} />
          <ExplorerExampleCard example={EXAMPLES.buttonSlotsStates} />
        </div>
      </PageSection>
    </div>
  )
}
