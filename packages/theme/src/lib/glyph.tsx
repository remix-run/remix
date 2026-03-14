import { createElement } from '@remix-run/component'
import type { Props, RemixElement, RemixNode } from '@remix-run/component'

export let glyphNames = [
  'add',
  'alert',
  'check',
  'chevronDown',
  'chevronRight',
  'close',
  'info',
  'menu',
  'search',
  'spinner',
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
  chevronRight: '0 0 16 16',
  close: '0 0 16 16',
  info: '0 0 16 16',
  menu: '0 0 16 16',
  search: '0 0 16 16',
  spinner: '0 0 16 16',
} as const satisfies Record<GlyphName, string>

export let glyphContract = Object.freeze(createGlyphContract(DEFAULT_GLYPH_ID_PREFIX))

export let RMX_01_GLYPHS: GlyphValues = {
  add: {
    viewBox: glyphViewBoxes.add,
    content: (
      <path
        d="M8 3.25v9.5M3.25 8h9.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    ),
  },
  alert: {
    viewBox: glyphViewBoxes.alert,
    content: (
      <>
        <path
          d="M8 2.5 13.75 12.5H2.25Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M8 5.75v3.5"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <circle cx="8" cy="11.25" fill="currentColor" r="0.75" />
      </>
    ),
  },
  check: {
    viewBox: glyphViewBoxes.check,
    content: (
      <path
        d="m3.5 8.25 2.75 2.75L12.5 4.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    ),
  },
  chevronDown: {
    viewBox: glyphViewBoxes.chevronDown,
    content: (
      <path
        d="m3.75 6.25 4.25 4 4.25-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    ),
  },
  chevronRight: {
    viewBox: glyphViewBoxes.chevronRight,
    content: (
      <path
        d="m6 4 4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    ),
  },
  close: {
    viewBox: glyphViewBoxes.close,
    content: (
      <path
        d="m4.5 4.5 7 7m0-7-7 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    ),
  },
  info: {
    viewBox: glyphViewBoxes.info,
    content: (
      <>
        <circle
          cx="8"
          cy="8"
          fill="none"
          r="5.75"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 7.25v3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
        <circle cx="8" cy="5" fill="currentColor" r="0.75" />
      </>
    ),
  },
  menu: {
    viewBox: glyphViewBoxes.menu,
    content: (
      <path
        d="M3 4.75h10M3 8h10M3 11.25h10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    ),
  },
  search: {
    viewBox: glyphViewBoxes.search,
    content: (
      <>
        <circle
          cx="7"
          cy="7"
          fill="none"
          r="4.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="m10.25 10.25 3 3"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </>
    ),
  },
  spinner: {
    viewBox: glyphViewBoxes.spinner,
    content: (
      <>
        <circle
          cx="8"
          cy="8"
          fill="none"
          opacity="0.24"
          r="5.25"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M8 2.75a5.25 5.25 0 0 1 5.25 5.25"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </>
    ),
  },
}

export function createGlyphSheet(
  values: GlyphValues,
): GlyphSheetComponent {
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
        glyphNames.map(name => {
          let glyph = values[name]

          return (
            <symbol id={ids[name]} key={name} viewBox={glyph.viewBox}>
              {glyph.content}
            </symbol>
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

    return (
      <svg
        {...svgProps}
        aria-hidden={hiddenByDefault ? true : props['aria-hidden']}
        fill={fill ?? 'none'}
        viewBox={viewBox ?? contract.viewBox}
        xmlns="http://www.w3.org/2000/svg"
      >
        <use href={`#${contract.id}`} />
      </svg>
    )
  }
}

function createGlyphIds(idPrefix: string): Record<GlyphName, string> {
  return Object.fromEntries(glyphNames.map(name => [name, `${idPrefix}-${name}`])) as Record<
    GlyphName,
    string
  >
}

function createGlyphContract(idPrefix: string) {
  let ids = createGlyphIds(idPrefix)

  return Object.freeze(
    Object.fromEntries(
      glyphNames.map(name => [
        name,
        {
          id: ids[name],
          viewBox: glyphViewBoxes[name],
        },
      ]),
    ) as Record<GlyphName, { id: string; viewBox: string }>,
  )
}
