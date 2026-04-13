import { ExplorerExampleCard } from '../example-card.tsx'
import { PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderThemeSpacingPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Theme spacing"
        description="Spacing tokens set the shared rhythm for padding, gaps, and dense layout decisions."
      >
        <ExplorerExampleCard example={EXAMPLES.themeSpaceRhythm} />
      </PageSection>
    </div>
  )
}
