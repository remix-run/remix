import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderUiPopupsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="UI popup tokens"
        description="Popup-backed controls can share the same theme values while still exposing separate component-owned contracts."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard example={EXAMPLES.popoverContract} />
          <ExplorerExampleCard example={EXAMPLES.menuContract} />
          <ExplorerExampleCard example={EXAMPLES.listboxContract} />
        </div>
      </PageSection>
    </div>
  )
}
