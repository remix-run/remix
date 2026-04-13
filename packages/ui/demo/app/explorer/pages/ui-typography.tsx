import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderUiTypographyPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="UI typography"
        description="Text mixins give the system a shared page voice and keep ordinary interface writing from splintering into one-off styles."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard example={EXAMPLES.overviewText} />
          <ExplorerExampleCard example={EXAMPLES.textPageTypography} />
        </div>
      </PageSection>
    </div>
  )
}
