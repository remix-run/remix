import { createElement } from '@remix-run/component'
import type { Props, RemixElement } from '@remix-run/component'

import {
  glyphContract,
  glyphNames,
  type GlyphName,
  type GlyphValues,
} from '../theme/glyph-contract.ts'

export type { GlyphName, GlyphSymbol, GlyphValues } from '../theme/glyph-contract.ts'

export type GlyphSheetProps = Omit<Props<'svg'>, 'children'>

type GlyphSheetRenderer = () => (props?: GlyphSheetProps) => RemixElement

export type GlyphSheetComponent = GlyphSheetRenderer & {
  ids: Readonly<Record<GlyphName, string>>
  values: GlyphValues
}

export type GlyphProps = Omit<Props<'svg'>, 'children'> & {
  name: GlyphName
}

export function createGlyphSheet(values: GlyphValues): GlyphSheetComponent {
  let ids = Object.freeze(
    Object.fromEntries(glyphNames.map((name) => [name, glyphContract[name].id])) as Record<
      GlyphName,
      string
    >,
  )

  function GlyphSheet() {
    return (props: GlyphSheetProps = {}) => {
      let { style, ...svgProps } = props
      let hiddenStyle = {
        position: 'absolute',
        width: '0',
        height: '0',
        overflow: 'hidden',
        pointerEvents: 'none',
      }
      let nextStyle =
        typeof style === 'object' && style !== null ? { ...hiddenStyle, ...style } : hiddenStyle

      return createElement(
        'svg',
        {
          ...svgProps,
          'aria-hidden': props['aria-hidden'] ?? true,
          focusable: props.focusable ?? 'false',
          height: props.height ?? '0',
          style: nextStyle,
          width: props.width ?? '0',
          xmlns: 'http://www.w3.org/2000/svg',
        },
        glyphNames.map((name) => {
          let glyph = values[name]

          return cloneGlyphSymbol(name, glyph, ids[name])
        }),
      )
    }
  }

  return Object.assign(GlyphSheet, {
    ids,
    values,
  })
}

export function Glyph() {
  return (props: GlyphProps) => {
    let { fill, name, ...svgProps } = props
    let glyphId = glyphContract[name].id
    let hiddenByDefault =
      props['aria-hidden'] === undefined &&
      props['aria-label'] === undefined &&
      props['aria-labelledby'] === undefined

    return createElement(
      'svg',
      {
        ...svgProps,
        'aria-hidden': hiddenByDefault ? true : props['aria-hidden'],
        fill: fill ?? 'none',
        xmlns: 'http://www.w3.org/2000/svg',
      },
      createElement('use', {
        xlinkHref: `#${glyphId}`,
      }),
    )
  }
}

function cloneGlyphSymbol(name: GlyphName, glyph: RemixElement, id: string): RemixElement {
  if (glyph.type !== 'symbol') {
    throw new TypeError(`Expected glyph "${name}" to be a <symbol> element`)
  }

  return {
    ...glyph,
    key: name,
    props: {
      ...glyph.props,
      id,
    },
  }
}
