import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderUiCardsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="UI cards"
        description="Card tokens should solve recurring surface structure and tone without forcing app code to re-invent panel layout every time."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard example={EXAMPLES.overviewCard} />
          <ExplorerExampleCard example={EXAMPLES.cardStructuredSurface} />
        </div>
      </PageSection>
    </div>
  )
}
