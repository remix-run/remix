import { ui } from 'remix/theme'
import { navPreviewCardCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={[ui.card.secondary, navPreviewCardCss]}>
      <div mix={ui.sidebar.section}>
        <p mix={ui.sidebar.heading}>Navigation</p>
        <nav aria-label="UI recipe nav preview" mix={ui.nav.list}>
          <a href="/ui-recipes" aria-current="page" mix={ui.nav.itemActive}>
            Current page
          </a>
          <a href="/ui-recipes" mix={ui.nav.item}>
            Secondary page
          </a>
        </nav>
      </div>
    </div>
  )
}
