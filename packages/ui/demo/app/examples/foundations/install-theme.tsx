import type { RemixNode } from 'remix/component'
import { createGlyphSheet, Glyph, RMX_01, RMX_01_GLYPHS, ui } from 'remix/ui'

let Glyphs = createGlyphSheet(RMX_01_GLYPHS)

export function AppDocument(props: { children: RemixNode }) {
  return (
    <html>
      <head>
        <RMX_01 />
      </head>
      <body>
        <Glyphs />
        {props.children}
      </body>
    </html>
  )
}

export default function Example() {
  return () => (
    <article mix={ui.card.base}>
      <div mix={ui.card.header}>
        <p mix={ui.card.eyebrow}>Installed once</p>
        <h3 mix={ui.card.title}>Theme + glyph sheet in the document</h3>
        <p mix={ui.card.description}>
          Render the theme in the head, render glyphs in the body, then use the shared `ui.*`
          layer everywhere else.
        </p>
      </div>
      <div mix={ui.card.footer}>
        <button mix={ui.button.primary}>
          <Glyph mix={ui.button.icon} name="add" />
          <span mix={ui.button.label}>New project</span>
        </button>
      </div>
    </article>
  )
}
