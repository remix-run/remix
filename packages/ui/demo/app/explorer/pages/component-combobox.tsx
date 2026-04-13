import { ui } from 'remix/ui'

import { ExplorerExampleCard } from '../example-card.tsx'
import { exampleGridCss, noteListCss, PageSection, pageStackCss } from '../page-primitives.tsx'
import { EXAMPLES } from '../../examples/index.tsx'

let comboboxExamples = [EXAMPLES.comboboxOverview, EXAMPLES.comboboxRemote]

export function renderComponentComboboxPage() {
  return (
    <div mix={pageStackCss}>
      <PageSection
        title="Combobox"
        description="Combobox keeps focus on an input while filtering and selecting one committed value from a popup-backed option list."
      >
        <div mix={exampleGridCss}>
          {comboboxExamples.map((example) => (
            <ExplorerExampleCard key={example.id} example={example} />
          ))}
        </div>
      </PageSection>

      <PageSection title="What to remember">
        <article mix={ui.card.base}>
          <div mix={ui.card.body}>
            <ul mix={noteListCss}>
              <li>Focus stays on the input, and `aria-activedescendant` lives there instead of on the list.</li>
              <li>Typing filters visible options and only opens the popup when something matches.</li>
              <li>`ArrowDown` and `ArrowUp` open the popup, but `Enter` only selects once the popup is already open.</li>
              <li>Exact matches commit on blur, while invalid draft text clears on blur or `Escape`.</li>
            </ul>
          </div>
        </article>
      </PageSection>
    </div>
  )
}
