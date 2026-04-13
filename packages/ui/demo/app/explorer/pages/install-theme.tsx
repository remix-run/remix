import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

export function renderInstallThemePage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Installing a theme"
        description="Get the shared design-system surface into your document first, then let app code and components consume the same theme and UI contracts."
      >
        <ExplorerExampleCard example={EXAMPLES.installTheme} />
      </PageSection>

      <PageSection title="What to install once">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>Install `remix` so the app can import from `remix/ui`.</li>
              <li>
                Render <code>{'<RMX_01 />'}</code> or your own <code>createTheme(...)</code> result
                near the top of the document.
              </li>
              <li>Render the glyph sheet once in the body so icons are available everywhere.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}
