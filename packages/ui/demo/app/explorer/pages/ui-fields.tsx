import { ExplorerExampleCard } from '../example-card.tsx'
import { PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderUiFieldsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="UI fields"
        description="Field chrome, labels, and help text should travel together so forms stay aligned with the rest of the system."
      >
        <ExplorerExampleCard example={EXAMPLES.fieldStack} />
      </PageSection>
    </div>
  )
}
