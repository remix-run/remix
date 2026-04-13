import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderUiNavigationPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="UI navigation"
        description="Navigation tokens should be useful for docs-style sidebars, settings rails, and ordinary in-product collections."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard example={EXAMPLES.navOverview} />
          <ExplorerExampleCard example={EXAMPLES.navDetail} />
        </div>
      </PageSection>
    </div>
  )
}
