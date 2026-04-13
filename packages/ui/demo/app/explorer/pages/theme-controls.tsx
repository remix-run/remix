import { ExplorerExampleCard } from '../example-card.tsx'
import { PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderThemeControlsPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Theme control sizes"
        description="Control sizing tokens align buttons, fields, menus, and other compact interactions across the library."
      >
        <ExplorerExampleCard example={EXAMPLES.themeControlSizes} />
      </PageSection>
    </div>
  )
}
