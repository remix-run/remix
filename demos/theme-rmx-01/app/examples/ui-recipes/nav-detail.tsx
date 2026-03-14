import { Glyph, ui } from 'remix/theme'
import { navPreviewCardCss, navPreviewGlyphCss } from './shared.ts'

export default function Example() {
  return () => (
    <div mix={[ui.card.secondary, navPreviewCardCss]}>
      <div mix={ui.sidebar.section}>
        <p mix={ui.sidebar.heading}>Navigation</p>
        <nav aria-label="UI mixin nav detail preview" mix={ui.nav.list}>
          <a href="/ui-recipes/navigation" aria-current="page" mix={ui.nav.itemActive}>
            <Glyph mix={[ui.icon.sm, navPreviewGlyphCss]} name="menu" />
            Current page
          </a>
          <a href="/ui-recipes/navigation" mix={ui.nav.item}>
            <Glyph mix={[ui.icon.sm, navPreviewGlyphCss]} name="search" />
            Secondary page
          </a>
          <a href="/ui-recipes/navigation" mix={ui.nav.item}>
            <Glyph mix={[ui.icon.sm, navPreviewGlyphCss]} name="info" />
            Tertiary page
          </a>
        </nav>
      </div>
    </div>
  )
}
