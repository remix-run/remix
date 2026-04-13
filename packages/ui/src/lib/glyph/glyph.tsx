import { createElement } from '@remix-run/component'
import type { Props, RemixElement, RemixNode } from '@remix-run/component'

export let glyphNames = [
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

export type GlyphDefinition = {
  content: RemixNode
  viewBox: string
}

export type GlyphValues = {
  readonly [key in GlyphName]: GlyphDefinition
}

export type GlyphSheetProps = Omit<Props<'svg'>, 'children'>

type GlyphSheetRenderer = () => (props?: GlyphSheetProps) => RemixElement

export type GlyphSheetComponent = GlyphSheetRenderer & {
  ids: Readonly<Record<GlyphName, string>>
  values: GlyphValues
}

export type GlyphProps = Omit<Props<'svg'>, 'children'> & {
  name: GlyphName
}

let DEFAULT_GLYPH_ID_PREFIX = 'rmx-glyph'

let glyphViewBoxes = {
  add: '0 0 16 16',
  alert: '0 0 16 16',
  check: '0 0 16 16',
  chevronDown: '0 0 16 16',
  chevronVertical: '0 0 16 16',
  chevronUp: '0 0 16 16',
  chevronRight: '0 0 16 16',
  close: '0 0 16 16',
  copy: '0 0 16 16',
  edit: '0 0 16 16',
  expand: '0 0 16 16',
  info: '0 0 16 16',
  menu: '0 0 16 16',
  open: '0 0 16 16',
  search: '0 0 16 16',
  spinner: '0 0 16 16',
  trash: '0 0 16 16',
} as const satisfies Record<GlyphName, string>

export let glyphContract = Object.freeze(createGlyphContract(DEFAULT_GLYPH_ID_PREFIX))

export let RMX_01_GLYPHS: GlyphValues = {
  add: {
    viewBox: glyphViewBoxes.add,
    content: createElement('path', {
      d: 'M8 3.25v9.5M3.25 8h9.5',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  },
  alert: {
    viewBox: glyphViewBoxes.alert,
    content: [
      createElement('path', {
        d: 'M8 2.5 13.75 12.5H2.25Z',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'M8 5.75v3.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeWidth: '1.5',
      }),
      createElement('circle', {
        cx: '8',
        cy: '11.25',
        fill: 'currentColor',
        r: '0.75',
      }),
    ],
  },
  check: {
    viewBox: glyphViewBoxes.check,
    content: createElement('path', {
      d: 'm3.5 8.25 2.75 2.75L12.5 4.75',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  },
  chevronDown: {
    viewBox: glyphViewBoxes.chevronDown,
    content: createElement('path', {
      d: 'm3.75 6.25 4.25 4 4.25-4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  },
  chevronVertical: {
    viewBox: glyphViewBoxes.chevronVertical,
    content: [
      createElement('path', {
        d: 'm3.75 6.5 4.25-4 4.25 4',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'm3.75 9.5 4.25 4 4.25-4',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
    ],
  },
  chevronUp: {
    viewBox: glyphViewBoxes.chevronUp,
    content: createElement('path', {
      d: 'm3.75 9.75 4.25-4 4.25 4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  },
  chevronRight: {
    viewBox: glyphViewBoxes.chevronRight,
    content: createElement('path', {
      d: 'm6 4 4 4-4 4',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeWidth: '1.5',
    }),
  },
  close: {
    viewBox: glyphViewBoxes.close,
    content: createElement('path', {
      d: 'm4.5 4.5 7 7m0-7-7 7',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  },
  copy: {
    viewBox: glyphViewBoxes.copy,
    content: [
      createElement('rect', {
        x: '5.25',
        y: '3.25',
        width: '7.5',
        height: '7.5',
        rx: '1.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'M10.75 12.75h-5.5a2 2 0 0 1-2-2v-5.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
    ],
  },
  edit: {
    viewBox: glyphViewBoxes.edit,
    content: [
      createElement('path', {
        d: 'm10.75 3.75 1.5 1.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'm4 12 2.5-.5 5.75-5.75a1.06 1.06 0 0 0 0-1.5l-.5-.5a1.06 1.06 0 0 0-1.5 0L4.5 9.5 4 12Z',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
    ],
  },
  expand: {
    viewBox: glyphViewBoxes.expand,
    content: [
      createElement('path', {
        d: 'M9.25 3.5h3.25v3.25',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'm12.5 3.5-5.5 5.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'M6.75 12.5H3.5V9.25',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'm3.5 12.5 5.5-5.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
    ],
  },
  info: {
    viewBox: glyphViewBoxes.info,
    content: [
      createElement('circle', {
        cx: '8',
        cy: '8',
        fill: 'none',
        r: '5.75',
        stroke: 'currentColor',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'M8 7.25v3',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeWidth: '1.5',
      }),
      createElement('circle', {
        cx: '8',
        cy: '5',
        fill: 'currentColor',
        r: '0.75',
      }),
    ],
  },
  menu: {
    viewBox: glyphViewBoxes.menu,
    content: createElement('path', {
      d: 'M3 4.75h10M3 8h10M3 11.25h10',
      fill: 'none',
      stroke: 'currentColor',
      strokeLinecap: 'round',
      strokeWidth: '1.5',
    }),
  },
  open: {
    viewBox: glyphViewBoxes.open,
    content: [
      createElement('path', {
        d: 'M6.25 4H4.5A1.5 1.5 0 0 0 3 5.5v6A1.5 1.5 0 0 0 4.5 13h6A1.5 1.5 0 0 0 12 11.5V9.75',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'M8 3h5v5',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'm13 3-6.25 6.25',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
    ],
  },
  search: {
    viewBox: glyphViewBoxes.search,
    content: [
      createElement('circle', {
        cx: '7',
        cy: '7',
        fill: 'none',
        r: '4.25',
        stroke: 'currentColor',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'm10.25 10.25 3 3',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeWidth: '1.5',
      }),
    ],
  },
  spinner: {
    viewBox: glyphViewBoxes.spinner,
    content: [
      createElement('circle', {
        cx: '8',
        cy: '8',
        fill: 'none',
        opacity: '0.24',
        r: '5.25',
        stroke: 'currentColor',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'M8 2.75a5.25 5.25 0 0 1 5.25 5.25',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeWidth: '1.5',
      }),
    ],
  },
  trash: {
    viewBox: glyphViewBoxes.trash,
    content: [
      createElement('path', {
        d: 'M3.75 4.75h8.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'M6.25 4.75V4a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v.75',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'm5 6.25.45 5.1A1.5 1.5 0 0 0 6.94 12.75h2.12a1.5 1.5 0 0 0 1.49-1.4L11 6.25',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        strokeWidth: '1.5',
      }),
      createElement('path', {
        d: 'M7 7.25v3.5M9 7.25v3.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeLinecap: 'round',
        strokeWidth: '1.5',
      }),
    ],
  },
}

export function createGlyphSheet(values: GlyphValues): GlyphSheetComponent {
  let ids = Object.freeze(createGlyphIds(DEFAULT_GLYPH_ID_PREFIX))

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

          return createElement(
            'symbol',
            { id: ids[name], key: name, viewBox: glyph.viewBox },
            glyph.content,
          )
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
    let { fill, name, viewBox, ...svgProps } = props
    let contract = glyphContract[name]
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
        viewBox: viewBox ?? contract.viewBox,
        xmlns: 'http://www.w3.org/2000/svg',
      },
      createElement('use', {
        xlinkHref: `#${contract.id}`,
      }),
    )
  }
}

function createGlyphIds(idPrefix: string): Record<GlyphName, string> {
  return Object.fromEntries(glyphNames.map((name) => [name, `${idPrefix}-${name}`])) as Record<
    GlyphName,
    string
  >
}

function createGlyphContract(idPrefix: string) {
  let ids = createGlyphIds(idPrefix)

  return Object.freeze(
    Object.fromEntries(
      glyphNames.map((name) => [
        name,
        {
          id: ids[name],
          viewBox: glyphViewBoxes[name],
        },
      ]),
    ) as Record<GlyphName, { id: string; viewBox: string }>,
  )
}
