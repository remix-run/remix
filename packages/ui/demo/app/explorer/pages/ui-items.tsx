import { ExplorerExampleCard } from '../example-card.tsx'
import { PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderUiItemsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="UI items and status"
        description="Item rows and status treatments are shared primitives behind menus, command surfaces, sidebar rows, and compact operational UI."
      >
        <ExplorerExampleCard example={EXAMPLES.itemStatus} />
      </PageSection>
    </div>
  )
}
