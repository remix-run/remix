import type { RemixElement } from '@remix-run/ui'

export const glyphNames = [
  'add',
  'alert',
  'check',
  'chevronDown',
  'chevronVertical',
  'chevronUp',
  'chevronRight',
  'close',
  'copy',
  'edit',
  'expand',
  'info',
  'menu',
  'open',
  'search',
  'spinner',
  'trash',
] as const

export type GlyphName = (typeof glyphNames)[number]

export type GlyphSymbol = RemixElement

export type GlyphValues = {
  readonly [key in GlyphName]: GlyphSymbol
}

export type GlyphContract = Readonly<Record<GlyphName, { id: string }>>

const DEFAULT_GLYPH_ID_PREFIX = 'rmx-glyph'

export const glyphContract = Object.freeze(createGlyphContract(DEFAULT_GLYPH_ID_PREFIX))

function createGlyphIds(idPrefix: string): Record<GlyphName, string> {
  return Object.fromEntries(glyphNames.map((name) => [name, `${idPrefix}-${name}`])) as Record<
    GlyphName,
    string
  >
}

function createGlyphContract(idPrefix: string): GlyphContract {
  let ids = createGlyphIds(idPrefix)

  return Object.freeze(
    Object.fromEntries(
      glyphNames.map((name) => [
        name,
        {
          id: ids[name],
        },
      ]),
    ) as GlyphContract,
  )
}
