import { ExplorerExampleCard } from '../example-card.tsx'
import { PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderUiLayoutPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="UI layout"
        description="Rows and stacks should cover the common flex mechanics without creating a separate wrapper component for every layout pattern."
      >
        <ExplorerExampleCard example={EXAMPLES.rowStack} />
      </PageSection>
    </div>
  )
}
