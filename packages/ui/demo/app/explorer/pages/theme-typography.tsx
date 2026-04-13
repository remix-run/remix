import { ExplorerExampleCard } from '../example-card.tsx'
import { PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderThemeTypographyPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Theme typography"
        description="Typography tokens should shift hierarchy and density globally without forcing every component to carry its own scale."
      >
        <ExplorerExampleCard example={EXAMPLES.themeTypographyScale} />
      </PageSection>
    </div>
  )
}
