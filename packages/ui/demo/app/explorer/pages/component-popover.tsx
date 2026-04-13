import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderComponentPopoverPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Popover"
        description="Use the floating-surface primitive for anchored, non-modal UI. Positioning belongs to `popover.surface()`, while the default surface treatment stays shared below it."
      >
        <ExplorerExampleCard example={EXAMPLES.popoverOverview} />
      </PageSection>

      <PageSection title="What to remember">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>Reach for `popover.surface()` before inventing one-off floating panel mechanics.</li>
              <li>Keep the popup visually on-system instead of styling each surface from scratch.</li>
              <li>Use it for anchored UI, not for modal workflows that deserve dialog semantics later.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}
