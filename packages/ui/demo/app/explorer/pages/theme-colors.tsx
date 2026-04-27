import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderThemeColorsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Theme colors"
        description="Color tokens should define the visual hierarchy of the system before any component-specific styling exists."
      >
        <div mix={exampleGridCss}>
          <ExplorerExampleCard example={EXAMPLES.themeSurfaceStack} />
          <ExplorerExampleCard example={EXAMPLES.themeColorRoles} />
        </div>
      </PageSection>
    </div>
  )
}
