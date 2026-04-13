import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let selectExamples = [EXAMPLES.selectOverview, EXAMPLES.selectDeconstructed]

export function renderComponentSelectPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Select"
        description="Select packages the ordinary single-select button + popover interaction into one component while keeping the list-focused keyboard model and optional form serialization built in."
      >
        <div mix={exampleGridCss}>
          {selectExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>

      <PageSection title="What to remember">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>Reach for `Select` when you want the ordinary single-select button + popup shape.</li>
              <li>Focus moves into the list on open, and `aria-activedescendant` tracks the active option.</li>
              <li>Use the built-in hidden input when you want ordinary form submission with a `name`.</li>
              <li>Drop to `listbox` when you need a more headless or multi-select surface.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}
