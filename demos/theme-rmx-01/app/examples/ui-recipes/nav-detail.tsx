import { ui } from 'remix/theme'
import { navPreviewCardCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={[ui.card.secondary, navPreviewCardCss]}>
      <div mix={ui.sidebar.section}>
        <p mix={ui.sidebar.heading}>Navigation</p>
        <nav aria-label="UI recipe nav detail preview" mix={ui.nav.list}>
          <a href="/ui-recipes/navigation" aria-current="page" mix={ui.nav.itemActive}>
            Current page
          </a>
          <a href="/ui-recipes/navigation" mix={ui.nav.item}>
            Secondary page
          </a>
          <a href="/ui-recipes/navigation" mix={ui.nav.item}>
            Tertiary page
          </a>
        </nav>
      </div>
    </div>
  )
}
