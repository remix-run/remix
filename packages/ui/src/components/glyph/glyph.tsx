import { createElement } from '@remix-run/ui'
import type { Handle, Props, RemixElement } from '@remix-run/ui'

import {
  glyphContract,
  glyphNames,
  type GlyphName,
  type GlyphValues,
} from '../../theme/glyph-contract.ts'

export type { GlyphName, GlyphSymbol, GlyphValues } from '../../theme/glyph-contract.ts'

export type GlyphSheetProps = Omit<Props<'svg'>, 'children'>

type GlyphSheetRenderer = (handle: Handle<GlyphSheetProps>) => () => RemixElement

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

  function GlyphSheet(handle: Handle<GlyphSheetProps>) {
    return () => {
      let { style, ...svgProps } = handle.props
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
          'aria-hidden': handle.props['aria-hidden'] ?? true,
          focusable: handle.props.focusable ?? 'false',
          height: handle.props.height ?? '0',
          style: nextStyle,
          width: handle.props.width ?? '0',
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

export function Glyph(handle: Handle<GlyphProps>) {
  return () => {
    let { fill, name, ...svgProps } = handle.props
    let glyphId = glyphContract[name].id
    let hiddenByDefault =
      handle.props['aria-hidden'] === undefined &&
      handle.props['aria-label'] === undefined &&
      handle.props['aria-labelledby'] === undefined

    return createElement(
      'svg',
      {
        ...svgProps,
        'aria-hidden': hiddenByDefault ? true : handle.props['aria-hidden'],
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
