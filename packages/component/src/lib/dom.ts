import type { CSSProps, StyleProps } from './style/lib/style.ts'
import type { EventListeners } from '@remix-run/interaction'
import type { RemixNode } from './jsx.ts'

/**
 * Adapted from Preact:
 * - Source: https://github.com/preactjs/preact/blob/eee0c6ef834534498e433f0f7a3ef679efd24380/src/dom.d.ts
 * - License: MIT https://github.com/preactjs/preact/blob/eee0c6ef834534498e433f0f7a3ef679efd24380/LICENSE
 * - Copyright (c) 2015-present Jason Miller
 */
type Booleanish = boolean | 'true' | 'false'

/**
 * All animatable CSS properties with autocomplete.
 * Derived from CSSStyleDeclaration for complete coverage.
 */
export type PresenceStyleProperties = {
  [K in keyof Omit<
    CSSStyleDeclaration,
    | 'length'
    | 'parentRule'
    | 'cssFloat'
    | 'cssText'
    | 'item'
    | 'setProperty'
    | 'removeProperty'
    | 'getPropertyValue'
    | 'getPropertyPriority'
    | typeof Symbol.iterator
  >]?: string | number
}

/**
 * A keyframe in a presence animation sequence.
 * Extends animatable properties with timing/composition controls.
 */
export interface PresenceKeyframe extends PresenceStyleProperties {
  /** Position in timeline (0-1) */
  offset?: number
  /** Per-keyframe easing function */
  easing?: string
  /** How this keyframe's values combine with underlying values */
  composite?: CompositeOperationOrAuto
}

/**
 * Timing and playback options for presence animations.
 */
export interface PresenceOptions {
  /** Animation duration in milliseconds */
  duration: number
  /** Delay before animation starts in milliseconds */
  delay?: number
  /** Easing function for the animation */
  easing?: string
  /** How animated values combine with underlying values */
  composite?: CompositeOperationOrAuto
}

/**
 * Full presence configuration with multiple keyframes.
 * Use for complex multi-step animations.
 */
export interface PresenceConfig extends PresenceOptions {
  /** Array of keyframes defining the animation sequence */
  keyframes: PresenceKeyframe[]
}

/**
 * Shorthand presence configuration with a single keyframe.
 * For enter: defines the starting state (animates FROM these values TO natural styles).
 * For exit: defines the ending state (animates FROM current styles TO these values).
 */
export interface PresenceKeyframeConfig extends PresenceKeyframe, PresenceOptions {
  keyframes?: undefined
}

/**
 * Layout animation configuration for FLIP-based position animations.
 * All properties are optional - defaults are applied when `true` or `{}` is used.
 */
export interface LayoutAnimationConfig {
  /** Animation duration in milliseconds (default: 200) */
  duration?: number
  /** CSS easing function (default: spring 'snappy' easing) */
  easing?: string
}

/**
 * Presence animation configuration for enter/exit/layout transitions.
 * Each property can be:
 * - `true`: Use default animation
 * - Object: Custom configuration
 * - Falsy (`false`, `null`, `undefined`): Disabled
 *
 * Falsy values are useful for conditional animations:
 * ```tsx
 * animate={{ enter: isReady && { opacity: 0, duration: 200 } }}
 * ```
 */
export interface AnimateProp {
  enter?: true | false | null | PresenceConfig | PresenceKeyframeConfig
  exit?: true | false | null | PresenceConfig | PresenceKeyframeConfig
  layout?: true | false | null | LayoutAnimationConfig
}

export interface HostProps<eventTarget extends EventTarget> {
  key?: any
  children?: RemixNode
  on?: EventListeners<eventTarget> | undefined
  css?: CSSProps
  connect?: (node: eventTarget, signal: AbortSignal) => void
  /**
   * Enable animations for this element.
   * - `{ enter, exit, layout }`: Configure each animation type
   * - Use `true` for defaults: `{ enter: true, exit: true, layout: true }`
   * - Use falsy values to disable: `{ enter: false }`
   */
  animate?: AnimateProp
  /**
   * Set the innerHTML of the element directly.
   * When provided, children are ignored.
   * Use with caution as this can expose XSS vulnerabilities if the content is not sanitized.
   */
  innerHTML?: string
}

export type Trackable<T> = T

export interface SVGProps<eventTarget extends EventTarget = SVGElement>
  extends HTMLProps<eventTarget> {
  accentHeight?: Trackable<number | string | undefined>
  accumulate?: Trackable<'none' | 'sum' | undefined>
  additive?: Trackable<'replace' | 'sum' | undefined>
  alignmentBaseline?: Trackable<
    | 'auto'
    | 'baseline'
    | 'before-edge'
    | 'text-before-edge'
    | 'middle'
    | 'central'
    | 'after-edge'
    | 'text-after-edge'
    | 'ideographic'
    | 'alphabetic'
    | 'hanging'
    | 'mathematical'
    | 'inherit'
    | undefined
  >
  'alignment-baseline'?: Trackable<
    | 'auto'
    | 'baseline'
    | 'before-edge'
    | 'text-before-edge'
    | 'middle'
    | 'central'
    | 'after-edge'
    | 'text-after-edge'
    | 'ideographic'
    | 'alphabetic'
    | 'hanging'
    | 'mathematical'
    | 'inherit'
    | undefined
  >
  allowReorder?: Trackable<'no' | 'yes' | undefined>
  'allow-reorder'?: Trackable<'no' | 'yes' | undefined>
  alphabetic?: Trackable<number | string | undefined>
  amplitude?: Trackable<number | string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/arabic-form */
  arabicForm?: Trackable<'initial' | 'medial' | 'terminal' | 'isolated' | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/arabic-form */
  'arabic-form'?: Trackable<'initial' | 'medial' | 'terminal' | 'isolated' | undefined>
  ascent?: Trackable<number | string | undefined>
  attributeName?: Trackable<string | undefined>
  attributeType?: Trackable<string | undefined>
  azimuth?: Trackable<number | string | undefined>
  baseFrequency?: Trackable<number | string | undefined>
  baselineShift?: Trackable<number | string | undefined>
  'baseline-shift'?: Trackable<number | string | undefined>
  baseProfile?: Trackable<number | string | undefined>
  bbox?: Trackable<number | string | undefined>
  begin?: Trackable<number | string | undefined>
  bias?: Trackable<number | string | undefined>
  by?: Trackable<number | string | undefined>
  calcMode?: Trackable<number | string | undefined>
  capHeight?: Trackable<number | string | undefined>
  'cap-height'?: Trackable<number | string | undefined>
  clip?: Trackable<number | string | undefined>
  clipPath?: Trackable<string | undefined>
  'clip-path'?: Trackable<string | undefined>
  clipPathUnits?: Trackable<number | string | undefined>
  clipRule?: Trackable<number | string | undefined>
  'clip-rule'?: Trackable<number | string | undefined>
  colorInterpolation?: Trackable<number | string | undefined>
  'color-interpolation'?: Trackable<number | string | undefined>
  colorInterpolationFilters?: Trackable<'auto' | 'sRGB' | 'linearRGB' | 'inherit' | undefined>
  'color-interpolation-filters'?: Trackable<'auto' | 'sRGB' | 'linearRGB' | 'inherit' | undefined>
  colorProfile?: Trackable<number | string | undefined>
  'color-profile'?: Trackable<number | string | undefined>
  colorRendering?: Trackable<number | string | undefined>
  'color-rendering'?: Trackable<number | string | undefined>
  contentScriptType?: Trackable<number | string | undefined>
  'content-script-type'?: Trackable<number | string | undefined>
  contentStyleType?: Trackable<number | string | undefined>
  'content-style-type'?: Trackable<number | string | undefined>
  cursor?: Trackable<number | string | undefined>
  cx?: Trackable<number | string | undefined>
  cy?: Trackable<number | string | undefined>
  d?: Trackable<string | undefined>
  decelerate?: Trackable<number | string | undefined>
  descent?: Trackable<number | string | undefined>
  diffuseConstant?: Trackable<number | string | undefined>
  direction?: Trackable<number | string | undefined>
  display?: Trackable<number | string | undefined>
  divisor?: Trackable<number | string | undefined>
  dominantBaseline?: Trackable<number | string | undefined>
  'dominant-baseline'?: Trackable<number | string | undefined>
  dur?: Trackable<number | string | undefined>
  dx?: Trackable<number | string | undefined>
  dy?: Trackable<number | string | undefined>
  edgeMode?: Trackable<number | string | undefined>
  elevation?: Trackable<number | string | undefined>
  enableBackground?: Trackable<number | string | undefined>
  'enable-background'?: Trackable<number | string | undefined>
  end?: Trackable<number | string | undefined>
  exponent?: Trackable<number | string | undefined>
  externalResourcesRequired?: Trackable<number | string | undefined>
  fill?: Trackable<string | undefined>
  fillOpacity?: Trackable<number | string | undefined>
  'fill-opacity'?: Trackable<number | string | undefined>
  fillRule?: Trackable<'nonzero' | 'evenodd' | 'inherit' | undefined>
  'fill-rule'?: Trackable<'nonzero' | 'evenodd' | 'inherit' | undefined>
  filter?: Trackable<string | undefined>
  filterRes?: Trackable<number | string | undefined>
  filterUnits?: Trackable<number | string | undefined>
  floodColor?: Trackable<number | string | undefined>
  'flood-color'?: Trackable<number | string | undefined>
  floodOpacity?: Trackable<number | string | undefined>
  'flood-opacity'?: Trackable<number | string | undefined>
  focusable?: Trackable<number | string | undefined>
  fontFamily?: Trackable<string | undefined>
  'font-family'?: Trackable<string | undefined>
  fontSize?: Trackable<number | string | undefined>
  'font-size'?: Trackable<number | string | undefined>
  fontSizeAdjust?: Trackable<number | string | undefined>
  'font-size-adjust'?: Trackable<number | string | undefined>
  fontStretch?: Trackable<number | string | undefined>
  'font-stretch'?: Trackable<number | string | undefined>
  fontStyle?: Trackable<number | string | undefined>
  'font-style'?: Trackable<number | string | undefined>
  fontVariant?: Trackable<number | string | undefined>
  'font-variant'?: Trackable<number | string | undefined>
  fontWeight?: Trackable<number | string | undefined>
  'font-weight'?: Trackable<number | string | undefined>
  format?: Trackable<number | string | undefined>
  from?: Trackable<number | string | undefined>
  fx?: Trackable<number | string | undefined>
  fy?: Trackable<number | string | undefined>
  g1?: Trackable<number | string | undefined>
  g2?: Trackable<number | string | undefined>
  glyphName?: Trackable<number | string | undefined>
  'glyph-name'?: Trackable<number | string | undefined>
  glyphOrientationHorizontal?: Trackable<number | string | undefined>
  'glyph-orientation-horizontal'?: Trackable<number | string | undefined>
  glyphOrientationVertical?: Trackable<number | string | undefined>
  'glyph-orientation-vertical'?: Trackable<number | string | undefined>
  glyphRef?: Trackable<number | string | undefined>
  gradientTransform?: Trackable<string | undefined>
  gradientUnits?: Trackable<string | undefined>
  hanging?: Trackable<number | string | undefined>
  height?: Trackable<number | string | undefined>
  horizAdvX?: Trackable<number | string | undefined>
  'horiz-adv-x'?: Trackable<number | string | undefined>
  horizOriginX?: Trackable<number | string | undefined>
  'horiz-origin-x'?: Trackable<number | string | undefined>
  href?: Trackable<string | undefined>
  hreflang?: Trackable<string | undefined>
  hrefLang?: Trackable<string | undefined>
  ideographic?: Trackable<number | string | undefined>
  imageRendering?: Trackable<number | string | undefined>
  'image-rendering'?: Trackable<number | string | undefined>
  in2?: Trackable<number | string | undefined>
  in?: Trackable<string | undefined>
  intercept?: Trackable<number | string | undefined>
  k1?: Trackable<number | string | undefined>
  k2?: Trackable<number | string | undefined>
  k3?: Trackable<number | string | undefined>
  k4?: Trackable<number | string | undefined>
  k?: Trackable<number | string | undefined>
  kernelMatrix?: Trackable<number | string | undefined>
  kernelUnitLength?: Trackable<number | string | undefined>
  kerning?: Trackable<number | string | undefined>
  keyPoints?: Trackable<number | string | undefined>
  keySplines?: Trackable<number | string | undefined>
  keyTimes?: Trackable<number | string | undefined>
  lengthAdjust?: Trackable<number | string | undefined>
  letterSpacing?: Trackable<number | string | undefined>
  'letter-spacing'?: Trackable<number | string | undefined>
  lightingColor?: Trackable<number | string | undefined>
  'lighting-color'?: Trackable<number | string | undefined>
  limitingConeAngle?: Trackable<number | string | undefined>
  local?: Trackable<number | string | undefined>
  markerEnd?: Trackable<string | undefined>
  'marker-end'?: Trackable<string | undefined>
  markerHeight?: Trackable<number | string | undefined>
  markerMid?: Trackable<string | undefined>
  'marker-mid'?: Trackable<string | undefined>
  markerStart?: Trackable<string | undefined>
  'marker-start'?: Trackable<string | undefined>
  markerUnits?: Trackable<number | string | undefined>
  markerWidth?: Trackable<number | string | undefined>
  mask?: Trackable<string | undefined>
  maskContentUnits?: Trackable<number | string | undefined>
  maskUnits?: Trackable<number | string | undefined>
  mathematical?: Trackable<number | string | undefined>
  mode?: Trackable<number | string | undefined>
  numOctaves?: Trackable<number | string | undefined>
  offset?: Trackable<number | string | undefined>
  opacity?: Trackable<number | string | undefined>
  operator?: Trackable<number | string | undefined>
  order?: Trackable<number | string | undefined>
  orient?: Trackable<number | string | undefined>
  orientation?: Trackable<number | string | undefined>
  origin?: Trackable<number | string | undefined>
  overflow?: Trackable<number | string | undefined>
  overlinePosition?: Trackable<number | string | undefined>
  'overline-position'?: Trackable<number | string | undefined>
  overlineThickness?: Trackable<number | string | undefined>
  'overline-thickness'?: Trackable<number | string | undefined>
  paintOrder?: Trackable<number | string | undefined>
  'paint-order'?: Trackable<number | string | undefined>
  panose1?: Trackable<number | string | undefined>
  'panose-1'?: Trackable<number | string | undefined>
  pathLength?: Trackable<number | string | undefined>
  patternContentUnits?: Trackable<string | undefined>
  patternTransform?: Trackable<number | string | undefined>
  patternUnits?: Trackable<string | undefined>
  pointerEvents?: Trackable<number | string | undefined>
  'pointer-events'?: Trackable<number | string | undefined>
  points?: Trackable<string | undefined>
  pointsAtX?: Trackable<number | string | undefined>
  pointsAtY?: Trackable<number | string | undefined>
  pointsAtZ?: Trackable<number | string | undefined>
  preserveAlpha?: Trackable<number | string | undefined>
  preserveAspectRatio?: Trackable<string | undefined>
  primitiveUnits?: Trackable<number | string | undefined>
  r?: Trackable<number | string | undefined>
  radius?: Trackable<number | string | undefined>
  refX?: Trackable<number | string | undefined>
  refY?: Trackable<number | string | undefined>
  renderingIntent?: Trackable<number | string | undefined>
  'rendering-intent'?: Trackable<number | string | undefined>
  repeatCount?: Trackable<number | string | undefined>
  'repeat-count'?: Trackable<number | string | undefined>
  repeatDur?: Trackable<number | string | undefined>
  'repeat-dur'?: Trackable<number | string | undefined>
  requiredExtensions?: Trackable<number | string | undefined>
  requiredFeatures?: Trackable<number | string | undefined>
  restart?: Trackable<number | string | undefined>
  result?: Trackable<string | undefined>
  rotate?: Trackable<number | string | undefined>
  rx?: Trackable<number | string | undefined>
  ry?: Trackable<number | string | undefined>
  scale?: Trackable<number | string | undefined>
  seed?: Trackable<number | string | undefined>
  shapeRendering?: Trackable<number | string | undefined>
  'shape-rendering'?: Trackable<number | string | undefined>
  slope?: Trackable<number | string | undefined>
  spacing?: Trackable<number | string | undefined>
  specularConstant?: Trackable<number | string | undefined>
  specularExponent?: Trackable<number | string | undefined>
  speed?: Trackable<number | string | undefined>
  spreadMethod?: Trackable<string | undefined>
  startOffset?: Trackable<number | string | undefined>
  stdDeviation?: Trackable<number | string | undefined>
  stemh?: Trackable<number | string | undefined>
  stemv?: Trackable<number | string | undefined>
  stitchTiles?: Trackable<number | string | undefined>
  stopColor?: Trackable<string | undefined>
  'stop-color'?: Trackable<string | undefined>
  stopOpacity?: Trackable<number | string | undefined>
  'stop-opacity'?: Trackable<number | string | undefined>
  strikethroughPosition?: Trackable<number | string | undefined>
  'strikethrough-position'?: Trackable<number | string | undefined>
  strikethroughThickness?: Trackable<number | string | undefined>
  'strikethrough-thickness'?: Trackable<number | string | undefined>
  string?: Trackable<number | string | undefined>
  stroke?: Trackable<string | undefined>
  strokeDasharray?: Trackable<string | number | undefined>
  'stroke-dasharray'?: Trackable<string | number | undefined>
  strokeDashoffset?: Trackable<string | number | undefined>
  'stroke-dashoffset'?: Trackable<string | number | undefined>
  strokeLinecap?: Trackable<'butt' | 'round' | 'square' | 'inherit' | undefined>
  'stroke-linecap'?: Trackable<'butt' | 'round' | 'square' | 'inherit' | undefined>
  strokeLinejoin?: Trackable<'miter' | 'round' | 'bevel' | 'inherit' | undefined>
  'stroke-linejoin'?: Trackable<'miter' | 'round' | 'bevel' | 'inherit' | undefined>
  strokeMiterlimit?: Trackable<string | number | undefined>
  'stroke-miterlimit'?: Trackable<string | number | undefined>
  strokeOpacity?: Trackable<number | string | undefined>
  'stroke-opacity'?: Trackable<number | string | undefined>
  strokeWidth?: Trackable<number | string | undefined>
  'stroke-width'?: Trackable<number | string | undefined>
  surfaceScale?: Trackable<number | string | undefined>
  systemLanguage?: Trackable<number | string | undefined>
  tableValues?: Trackable<number | string | undefined>
  targetX?: Trackable<number | string | undefined>
  targetY?: Trackable<number | string | undefined>
  textAnchor?: Trackable<string | undefined>
  'text-anchor'?: Trackable<string | undefined>
  textDecoration?: Trackable<number | string | undefined>
  'text-decoration'?: Trackable<number | string | undefined>
  textLength?: Trackable<number | string | undefined>
  textRendering?: Trackable<number | string | undefined>
  'text-rendering'?: Trackable<number | string | undefined>
  to?: Trackable<number | string | undefined>
  transform?: Trackable<string | undefined>
  transformOrigin?: Trackable<string | undefined>
  'transform-origin'?: Trackable<string | undefined>
  type?: Trackable<string | undefined>
  u1?: Trackable<number | string | undefined>
  u2?: Trackable<number | string | undefined>
  underlinePosition?: Trackable<number | string | undefined>
  'underline-position'?: Trackable<number | string | undefined>
  underlineThickness?: Trackable<number | string | undefined>
  'underline-thickness'?: Trackable<number | string | undefined>
  unicode?: Trackable<number | string | undefined>
  unicodeBidi?: Trackable<number | string | undefined>
  'unicode-bidi'?: Trackable<number | string | undefined>
  unicodeRange?: Trackable<number | string | undefined>
  'unicode-range'?: Trackable<number | string | undefined>
  unitsPerEm?: Trackable<number | string | undefined>
  'units-per-em'?: Trackable<number | string | undefined>
  vAlphabetic?: Trackable<number | string | undefined>
  'v-alphabetic'?: Trackable<number | string | undefined>
  values?: Trackable<string | undefined>
  vectorEffect?: Trackable<number | string | undefined>
  'vector-effect'?: Trackable<number | string | undefined>
  version?: Trackable<string | undefined>
  vertAdvY?: Trackable<number | string | undefined>
  'vert-adv-y'?: Trackable<number | string | undefined>
  vertOriginX?: Trackable<number | string | undefined>
  'vert-origin-x'?: Trackable<number | string | undefined>
  vertOriginY?: Trackable<number | string | undefined>
  'vert-origin-y'?: Trackable<number | string | undefined>
  vHanging?: Trackable<number | string | undefined>
  'v-hanging'?: Trackable<number | string | undefined>
  vIdeographic?: Trackable<number | string | undefined>
  'v-ideographic'?: Trackable<number | string | undefined>
  viewBox?: Trackable<string | undefined>
  viewTarget?: Trackable<number | string | undefined>
  visibility?: Trackable<number | string | undefined>
  vMathematical?: Trackable<number | string | undefined>
  'v-mathematical'?: Trackable<number | string | undefined>
  width?: Trackable<number | string | undefined>
  wordSpacing?: Trackable<number | string | undefined>
  'word-spacing'?: Trackable<number | string | undefined>
  writingMode?: Trackable<number | string | undefined>
  'writing-mode'?: Trackable<number | string | undefined>
  x1?: Trackable<number | string | undefined>
  x2?: Trackable<number | string | undefined>
  x?: Trackable<number | string | undefined>
  xChannelSelector?: Trackable<string | undefined>
  xHeight?: Trackable<number | string | undefined>
  'x-height'?: Trackable<number | string | undefined>
  xlinkActuate?: Trackable<string | undefined>
  'xlink:actuate'?: Trackable<SVGProps['xlinkActuate']>
  xlinkArcrole?: Trackable<string | undefined>
  'xlink:arcrole'?: Trackable<string | undefined>
  xlinkHref?: Trackable<string | undefined>
  'xlink:href'?: Trackable<string | undefined>
  xlinkRole?: Trackable<string | undefined>
  'xlink:role'?: Trackable<string | undefined>
  xlinkShow?: Trackable<string | undefined>
  'xlink:show'?: Trackable<string | undefined>
  xlinkTitle?: Trackable<string | undefined>
  'xlink:title'?: Trackable<string | undefined>
  xlinkType?: Trackable<string | undefined>
  'xlink:type'?: Trackable<string | undefined>
  xmlBase?: Trackable<string | undefined>
  'xml:base'?: Trackable<string | undefined>
  xmlLang?: Trackable<string | undefined>
  'xml:lang'?: Trackable<string | undefined>
  xmlns?: Trackable<string | undefined>
  xmlnsXlink?: Trackable<string | undefined>
  xmlSpace?: Trackable<string | undefined>
  'xml:space'?: Trackable<string | undefined>
  y1?: Trackable<number | string | undefined>
  y2?: Trackable<number | string | undefined>
  y?: Trackable<number | string | undefined>
  yChannelSelector?: Trackable<string | undefined>
  z?: Trackable<number | string | undefined>
  zoomAndPan?: Trackable<string | undefined>
}

export interface PathProps {
  d: string
}

// All the WAI-ARIA 1.1 attributes from https://www.w3.org/TR/wai-aria-1.1/
export interface AriaProps {
  /** Identifies the currently active element when DOM focus is on a composite widget, textbox, group, or application. */
  'aria-activedescendant'?: Trackable<string | undefined>
  /** Indicates whether assistive technologies will present all, or only parts of, the changed region based on the change notifications defined by the aria-relevant attribute. */
  'aria-atomic'?: Trackable<Booleanish | undefined>
  /**
   * Indicates whether inputting text could trigger display of one or more predictions of the user's intended value for an input and specifies how predictions would be
   * presented if they are made.
   */
  'aria-autocomplete'?: Trackable<'none' | 'inline' | 'list' | 'both' | undefined>
  /**
   * Defines a string value that labels the current element, which is intended to be converted into Braille.
   * @see aria-label.
   */
  'aria-braillelabel'?: Trackable<string | undefined>
  /**
   * Defines a human-readable, author-localized abbreviated description for the role of an element, which is intended to be converted into Braille.
   * @see aria-roledescription.
   */
  'aria-brailleroledescription'?: Trackable<string | undefined>
  /** Indicates an element is being modified and that assistive technologies MAY want to wait until the modifications are complete before exposing them to the user. */
  'aria-busy'?: Trackable<Booleanish | undefined>
  /**
   * Indicates the current "checked" state of checkboxes, radio buttons, and other widgets.
   * @see aria-pressed
   * @see aria-selected.
   */
  'aria-checked'?: Trackable<Booleanish | 'mixed' | undefined>
  /**
   * Defines the total number of columns in a table, grid, or treegrid.
   * @see aria-colindex.
   */
  'aria-colcount'?: Trackable<number | undefined>
  /**
   * Defines an element's column index or position with respect to the total number of columns within a table, grid, or treegrid.
   * @see aria-colcount
   * @see aria-colspan.
   */
  'aria-colindex'?: Trackable<number | undefined>
  /**
   * Defines a human readable text alternative of aria-colindex.
   * @see aria-rowindextext.
   */
  'aria-colindextext'?: Trackable<string | undefined>
  /**
   * Defines the number of columns spanned by a cell or gridcell within a table, grid, or treegrid.
   * @see aria-colindex
   * @see aria-rowspan.
   */
  'aria-colspan'?: Trackable<number | undefined>
  /**
   * Identifies the element (or elements) whose contents or presence are controlled by the current element.
   * @see aria-owns.
   */
  'aria-controls'?: Trackable<string | undefined>
  /** Indicates the element that represents the current item within a container or set of related elements. */
  'aria-current'?: Trackable<
    Booleanish | 'page' | 'step' | 'location' | 'date' | 'time' | undefined
  >
  /**
   * Identifies the element (or elements) that describes the object.
   * @see aria-labelledby
   */
  'aria-describedby'?: Trackable<string | undefined>
  /**
   * Defines a string value that describes or annotates the current element.
   * @see related aria-describedby.
   */
  'aria-description'?: Trackable<string | undefined>
  /**
   * Identifies the element that provides a detailed, extended description for the object.
   * @see aria-describedby.
   */
  'aria-details'?: Trackable<string | undefined>
  /**
   * Indicates that the element is perceivable but disabled, so it is not editable or otherwise operable.
   * @see aria-hidden
   * @see aria-readonly.
   */
  'aria-disabled'?: Trackable<Booleanish | undefined>
  /**
   * Indicates what functions can be performed when a dragged object is released on the drop target.
   * @deprecated in ARIA 1.1
   */
  'aria-dropeffect'?: Trackable<'none' | 'copy' | 'execute' | 'link' | 'move' | 'popup' | undefined>
  /**
   * Identifies the element that provides an error message for the object.
   * @see aria-invalid
   * @see aria-describedby.
   */
  'aria-errormessage'?: Trackable<string | undefined>
  /** Indicates whether the element, or another grouping element it controls, is currently expanded or collapsed. */
  'aria-expanded'?: Trackable<Booleanish | undefined>
  /**
   * Identifies the next element (or elements) in an alternate reading order of content which, at the user's discretion,
   * allows assistive technology to override the general default of reading in document source order.
   */
  'aria-flowto'?: Trackable<string | undefined>
  /**
   * Indicates an element's "grabbed" state in a drag-and-drop operation.
   * @deprecated in ARIA 1.1
   */
  'aria-grabbed'?: Trackable<Booleanish | undefined>
  /** Indicates the availability and type of interactive popup element, such as menu or dialog, that can be triggered by an element. */
  'aria-haspopup'?: Trackable<
    Booleanish | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | undefined
  >
  /**
   * Indicates whether the element is exposed to an accessibility API.
   * @see aria-disabled.
   */
  'aria-hidden'?: Trackable<Booleanish | undefined>
  /**
   * Indicates the entered value does not conform to the format expected by the application.
   * @see aria-errormessage.
   */
  'aria-invalid'?: Trackable<Booleanish | 'grammar' | 'spelling' | undefined>
  /** Indicates keyboard shortcuts that an author has implemented to activate or give focus to an element. */
  'aria-keyshortcuts'?: Trackable<string | undefined>
  /**
   * Defines a string value that labels the current element.
   * @see aria-labelledby.
   */
  'aria-label'?: Trackable<string | undefined>
  /**
   * Identifies the element (or elements) that labels the current element.
   * @see aria-describedby.
   */
  'aria-labelledby'?: Trackable<string | undefined>
  /** Defines the hierarchical level of an element within a structure. */
  'aria-level'?: Trackable<number | undefined>
  /** Indicates that an element will be updated, and describes the types of updates the user agents, assistive technologies, and user can expect from the live region. */
  'aria-live'?: Trackable<'off' | 'assertive' | 'polite' | undefined>
  /** Indicates whether an element is modal when displayed. */
  'aria-modal'?: Trackable<Booleanish | undefined>
  /** Indicates whether a text box accepts multiple lines of input or only a single line. */
  'aria-multiline'?: Trackable<Booleanish | undefined>
  /** Indicates that the user may select more than one item from the current selectable descendants. */
  'aria-multiselectable'?: Trackable<Booleanish | undefined>
  /** Indicates whether the element's orientation is horizontal, vertical, or unknown/ambiguous. */
  'aria-orientation'?: Trackable<'horizontal' | 'vertical' | undefined>
  /**
   * Identifies an element (or elements) in order to define a visual, functional, or contextual parent/child relationship
   * between DOM elements where the DOM hierarchy cannot be used to represent the relationship.
   * @see aria-controls.
   */
  'aria-owns'?: Trackable<string | undefined>
  /**
   * Defines a short hint (a word or short phrase) intended to aid the user with data entry when the control has no value.
   * A hint could be a sample value or a brief description of the expected format.
   */
  'aria-placeholder'?: Trackable<string | undefined>
  /**
   * Defines an element's number or position in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
   * @see aria-setsize.
   */
  'aria-posinset'?: Trackable<number | undefined>
  /**
   * Indicates the current "pressed" state of toggle buttons.
   * @see aria-checked
   * @see aria-selected.
   */
  'aria-pressed'?: Trackable<Booleanish | 'mixed' | undefined>
  /**
   * Indicates that the element is not editable, but is otherwise operable.
   * @see aria-disabled.
   */
  'aria-readonly'?: Trackable<Booleanish | undefined>
  /**
   * Indicates what notifications the user agent will trigger when the accessibility tree within a live region is modified.
   * @see aria-atomic.
   */
  'aria-relevant'?: Trackable<
    | 'additions'
    | 'additions removals'
    | 'additions text'
    | 'all'
    | 'removals'
    | 'removals additions'
    | 'removals text'
    | 'text'
    | 'text additions'
    | 'text removals'
    | undefined
  >
  /** Indicates that user input is required on the element before a form may be submitted. */
  'aria-required'?: Trackable<Booleanish | undefined>
  /** Defines a human-readable, author-localized description for the role of an element. */
  'aria-roledescription'?: Trackable<string | undefined>
  /**
   * Defines the total number of rows in a table, grid, or treegrid.
   * @see aria-rowindex.
   */
  'aria-rowcount'?: Trackable<number | undefined>
  /**
   * Defines an element's row index or position with respect to the total number of rows within a table, grid, or treegrid.
   * @see aria-rowcount
   * @see aria-rowspan.
   */
  'aria-rowindex'?: Trackable<number | undefined>
  /**
   * Defines a human readable text alternative of aria-rowindex.
   * @see aria-colindextext.
   */
  'aria-rowindextext'?: Trackable<string | undefined>
  /**
   * Defines the number of rows spanned by a cell or gridcell within a table, grid, or treegrid.
   * @see aria-rowindex
   * @see aria-colspan.
   */
  'aria-rowspan'?: Trackable<number | undefined>
  /**
   * Indicates the current "selected" state of various widgets.
   * @see aria-checked
   * @see aria-pressed.
   */
  'aria-selected'?: Trackable<Booleanish | undefined>
  /**
   * Defines the number of items in the current set of listitems or treeitems. Not required if all elements in the set are present in the DOM.
   * @see aria-posinset.
   */
  'aria-setsize'?: Trackable<number | undefined>
  /** Indicates if items in a table or grid are sorted in ascending or descending order. */
  'aria-sort'?: Trackable<'none' | 'ascending' | 'descending' | 'other' | undefined>
  /** Defines the maximum allowed value for a range widget. */
  'aria-valuemax'?: Trackable<number | undefined>
  /** Defines the minimum allowed value for a range widget. */
  'aria-valuemin'?: Trackable<number | undefined>
  /**
   * Defines the current value for a range widget.
   * @see aria-valuetext.
   */
  'aria-valuenow'?: Trackable<number | undefined>
  /** Defines the human readable text alternative of aria-valuenow for a range widget. */
  'aria-valuetext'?: Trackable<string | undefined>
}

// All the WAI-ARIA 1.2 role attribute values from https://www.w3.org/TR/wai-aria-1.2/#role_definitions
export type WAIAriaRole =
  | 'alert'
  | 'alertdialog'
  | 'application'
  | 'article'
  | 'banner'
  | 'blockquote'
  | 'button'
  | 'caption'
  | 'cell'
  | 'checkbox'
  | 'code'
  | 'columnheader'
  | 'combobox'
  | 'command'
  | 'complementary'
  | 'composite'
  | 'contentinfo'
  | 'definition'
  | 'deletion'
  | 'dialog'
  | 'directory'
  | 'document'
  | 'emphasis'
  | 'feed'
  | 'figure'
  | 'form'
  | 'grid'
  | 'gridcell'
  | 'group'
  | 'heading'
  | 'img'
  | 'input'
  | 'insertion'
  | 'landmark'
  | 'link'
  | 'list'
  | 'listbox'
  | 'listitem'
  | 'log'
  | 'main'
  | 'marquee'
  | 'math'
  | 'meter'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'navigation'
  | 'none'
  | 'note'
  | 'option'
  | 'paragraph'
  | 'presentation'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'range'
  | 'region'
  | 'roletype'
  | 'row'
  | 'rowgroup'
  | 'rowheader'
  | 'scrollbar'
  | 'search'
  | 'searchbox'
  | 'section'
  | 'sectionhead'
  | 'select'
  | 'separator'
  | 'slider'
  | 'spinbutton'
  | 'status'
  | 'strong'
  | 'structure'
  | 'subscript'
  | 'superscript'
  | 'switch'
  | 'tab'
  | 'table'
  | 'tablist'
  | 'tabpanel'
  | 'term'
  | 'textbox'
  | 'time'
  | 'timer'
  | 'toolbar'
  | 'tooltip'
  | 'tree'
  | 'treegrid'
  | 'treeitem'
  | 'widget'
  | 'window'
  | 'none presentation'

// All the Digital Publishing WAI-ARIA 1.0 role attribute values from https://www.w3.org/TR/dpub-aria-1.0/#role_definitions
export type DPubAriaRole =
  | 'doc-abstract'
  | 'doc-acknowledgments'
  | 'doc-afterword'
  | 'doc-appendix'
  | 'doc-backlink'
  | 'doc-biblioentry'
  | 'doc-bibliography'
  | 'doc-biblioref'
  | 'doc-chapter'
  | 'doc-colophon'
  | 'doc-conclusion'
  | 'doc-cover'
  | 'doc-credit'
  | 'doc-credits'
  | 'doc-dedication'
  | 'doc-endnote'
  | 'doc-endnotes'
  | 'doc-epigraph'
  | 'doc-epilogue'
  | 'doc-errata'
  | 'doc-example'
  | 'doc-footnote'
  | 'doc-foreword'
  | 'doc-glossary'
  | 'doc-glossref'
  | 'doc-index'
  | 'doc-introduction'
  | 'doc-noteref'
  | 'doc-notice'
  | 'doc-pagebreak'
  | 'doc-pagelist'
  | 'doc-part'
  | 'doc-preface'
  | 'doc-prologue'
  | 'doc-pullquote'
  | 'doc-qna'
  | 'doc-subtitle'
  | 'doc-tip'
  | 'doc-toc'

export type AriaRole = WAIAriaRole | DPubAriaRole

export interface AllHTMLProps<eventTarget extends EventTarget = EventTarget>
  extends HostProps<eventTarget>,
    AriaProps {
  // Standard HTML Attributes
  accept?: Trackable<string | undefined>
  acceptCharset?: Trackable<string | undefined>
  'accept-charset'?: Trackable<AllHTMLProps['acceptCharset']>
  accessKey?: Trackable<string | undefined>
  accesskey?: Trackable<AllHTMLProps['accessKey']>
  action?: Trackable<string | undefined>
  allow?: Trackable<string | undefined>
  allowFullScreen?: Trackable<boolean | undefined>
  allowTransparency?: Trackable<boolean | undefined>
  alt?: Trackable<string | undefined>
  as?: Trackable<string | undefined>
  async?: Trackable<boolean | undefined>
  autocomplete?: Trackable<string | undefined>
  autoComplete?: Trackable<string | undefined>
  autocorrect?: Trackable<string | undefined>
  autoCorrect?: Trackable<string | undefined>
  autofocus?: Trackable<boolean | undefined>
  autoFocus?: Trackable<boolean | undefined>
  autoPlay?: Trackable<boolean | undefined>
  autoplay?: Trackable<boolean | undefined>
  capture?: Trackable<boolean | string | undefined>
  cellPadding?: Trackable<number | string | undefined>
  cellSpacing?: Trackable<number | string | undefined>
  charSet?: Trackable<string | undefined>
  charset?: Trackable<string | undefined>
  challenge?: Trackable<string | undefined>
  checked?: Trackable<boolean | undefined>
  cite?: Trackable<string | undefined>
  class?: Trackable<string | undefined>
  className?: Trackable<string | undefined>
  cols?: Trackable<number | undefined>
  colSpan?: Trackable<number | undefined>
  colspan?: Trackable<number | undefined>
  content?: Trackable<string | undefined>
  contentEditable?: Trackable<Booleanish | '' | 'plaintext-only' | 'inherit' | undefined>
  contenteditable?: Trackable<AllHTMLProps['contentEditable']>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contextmenu */
  contextMenu?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contextmenu */
  contextmenu?: Trackable<string | undefined>
  controls?: Trackable<boolean | undefined>
  controlslist?: Trackable<string | undefined>
  controlsList?: Trackable<string | undefined>
  coords?: Trackable<string | undefined>
  crossOrigin?: Trackable<string | undefined>
  crossorigin?: Trackable<string | undefined>
  currentTime?: Trackable<number | undefined>
  data?: Trackable<string | undefined>
  dateTime?: Trackable<string | undefined>
  datetime?: Trackable<string | undefined>
  default?: Trackable<boolean | undefined>
  defaultChecked?: Trackable<boolean | undefined>
  defaultMuted?: Trackable<boolean | undefined>
  defaultPlaybackRate?: Trackable<number | undefined>
  defaultValue?: Trackable<string | undefined>
  defer?: Trackable<boolean | undefined>
  dir?: Trackable<'auto' | 'rtl' | 'ltr' | undefined>
  disabled?: Trackable<boolean | undefined>
  disableremoteplayback?: Trackable<boolean | undefined>
  disableRemotePlayback?: Trackable<boolean | undefined>
  download?: Trackable<any | undefined>
  decoding?: Trackable<'sync' | 'async' | 'auto' | undefined>
  draggable?: Trackable<boolean | undefined>
  encType?: Trackable<string | undefined>
  enctype?: Trackable<string | undefined>
  enterkeyhint?: Trackable<
    'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  >
  elementTiming?: Trackable<string | undefined>
  elementtiming?: Trackable<AllHTMLProps['elementTiming']>
  exportparts?: Trackable<string | undefined>
  for?: Trackable<string | undefined>
  form?: Trackable<string | undefined>
  formAction?: Trackable<string | undefined>
  formaction?: Trackable<string | undefined>
  formEncType?: Trackable<string | undefined>
  formenctype?: Trackable<string | undefined>
  formMethod?: Trackable<string | undefined>
  formmethod?: Trackable<string | undefined>
  formNoValidate?: Trackable<boolean | undefined>
  formnovalidate?: Trackable<boolean | undefined>
  formTarget?: Trackable<string | undefined>
  formtarget?: Trackable<string | undefined>
  frameBorder?: Trackable<number | string | undefined>
  frameborder?: Trackable<number | string | undefined>
  headers?: Trackable<string | undefined>
  height?: Trackable<number | string | undefined>
  hidden?: Trackable<boolean | 'hidden' | 'until-found' | undefined>
  high?: Trackable<number | undefined>
  href?: Trackable<string | undefined>
  hrefLang?: Trackable<string | undefined>
  hreflang?: Trackable<string | undefined>
  htmlFor?: Trackable<string | undefined>
  httpEquiv?: Trackable<string | undefined>
  'http-equiv'?: Trackable<string | undefined>
  icon?: Trackable<string | undefined>
  id?: Trackable<string | undefined>
  indeterminate?: Trackable<boolean | undefined>
  inert?: Trackable<boolean | undefined>
  inputMode?: Trackable<string | undefined>
  inputmode?: Trackable<string | undefined>
  integrity?: Trackable<string | undefined>
  is?: Trackable<string | undefined>
  keyParams?: Trackable<string | undefined>
  keyType?: Trackable<string | undefined>
  kind?: Trackable<string | undefined>
  label?: Trackable<string | undefined>
  lang?: Trackable<string | undefined>
  list?: Trackable<string | undefined>
  loading?: Trackable<'eager' | 'lazy' | undefined>
  loop?: Trackable<boolean | undefined>
  low?: Trackable<number | undefined>
  manifest?: Trackable<string | undefined>
  marginHeight?: Trackable<number | undefined>
  marginWidth?: Trackable<number | undefined>
  max?: Trackable<number | string | undefined>
  maxLength?: Trackable<number | undefined>
  maxlength?: Trackable<number | undefined>
  media?: Trackable<string | undefined>
  mediaGroup?: Trackable<string | undefined>
  method?: Trackable<string | undefined>
  min?: Trackable<number | string | undefined>
  minLength?: Trackable<number | undefined>
  minlength?: Trackable<number | undefined>
  multiple?: Trackable<boolean | undefined>
  muted?: Trackable<boolean | undefined>
  name?: Trackable<string | undefined>
  nomodule?: Trackable<boolean | undefined>
  nonce?: Trackable<string | undefined>
  noValidate?: Trackable<boolean | undefined>
  novalidate?: Trackable<boolean | undefined>
  open?: Trackable<boolean | undefined>
  optimum?: Trackable<number | undefined>
  part?: Trackable<string | undefined>
  pattern?: Trackable<string | undefined>
  ping?: Trackable<string | undefined>
  placeholder?: Trackable<string | undefined>
  playsInline?: Trackable<boolean | undefined>
  playsinline?: Trackable<boolean | undefined>
  playbackRate?: Trackable<number | undefined>
  popover?: Trackable<'auto' | 'hint' | 'manual' | boolean | undefined>
  popovertarget?: Trackable<string | undefined>
  popoverTarget?: Trackable<string | undefined>
  popovertargetaction?: Trackable<'hide' | 'show' | 'toggle' | undefined>
  popoverTargetAction?: Trackable<'hide' | 'show' | 'toggle' | undefined>
  poster?: Trackable<string | undefined>
  preload?: Trackable<'auto' | 'metadata' | 'none' | undefined>
  preservesPitch?: Trackable<boolean | undefined>
  radioGroup?: Trackable<string | undefined>
  readonly?: Trackable<boolean | undefined>
  readOnly?: Trackable<boolean | undefined>
  referrerpolicy?: Trackable<
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | undefined
  >
  rel?: Trackable<string | undefined>
  required?: Trackable<boolean | undefined>
  reversed?: Trackable<boolean | undefined>
  role?: Trackable<AriaRole | undefined>
  rows?: Trackable<number | undefined>
  rowSpan?: Trackable<number | undefined>
  rowspan?: Trackable<number | undefined>
  sandbox?: Trackable<string | undefined>
  scope?: Trackable<string | undefined>
  scoped?: Trackable<boolean | undefined>
  scrolling?: Trackable<string | undefined>
  seamless?: Trackable<boolean | undefined>
  selected?: Trackable<boolean | undefined>
  shape?: Trackable<string | undefined>
  size?: Trackable<number | undefined>
  sizes?: Trackable<string | undefined>
  slot?: Trackable<string | undefined>
  span?: Trackable<number | undefined>
  spellcheck?: Trackable<boolean | undefined>
  src?: Trackable<string | undefined>
  srcDoc?: Trackable<string | undefined>
  srcdoc?: Trackable<string | undefined>
  srcLang?: Trackable<string | undefined>
  srclang?: Trackable<string | undefined>
  srcSet?: Trackable<string | undefined>
  srcset?: Trackable<string | undefined>
  srcObject?: Trackable<MediaStream | MediaSource | Blob | File | null>
  start?: Trackable<number | undefined>
  step?: Trackable<number | string | undefined>
  style?: Trackable<string | StyleProps | undefined>
  summary?: Trackable<string | undefined>
  tabIndex?: Trackable<number | undefined>
  tabindex?: Trackable<number | undefined>
  target?: Trackable<string | undefined>
  title?: Trackable<string | undefined>
  type?: Trackable<string | undefined>
  useMap?: Trackable<string | undefined>
  usemap?: Trackable<string | undefined>
  value?: Trackable<string | string[] | number | undefined>
  volume?: Trackable<string | number | undefined>
  width?: Trackable<number | string | undefined>
  wmode?: Trackable<string | undefined>
  wrap?: Trackable<string | undefined>

  // Non-standard Attributes
  autocapitalize?: Trackable<
    'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  >
  autoCapitalize?: Trackable<
    'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  >
  disablePictureInPicture?: Trackable<boolean | undefined>
  results?: Trackable<number | undefined>
  translate?: Trackable<boolean | undefined>

  // RDFa Attributes
  about?: Trackable<string | undefined>
  datatype?: Trackable<string | undefined>
  inlist?: Trackable<any>
  prefix?: Trackable<string | undefined>
  property?: Trackable<string | undefined>
  resource?: Trackable<string | undefined>
  typeof?: Trackable<string | undefined>
  vocab?: Trackable<string | undefined>

  // Microdata Attributes
  itemProp?: Trackable<string | undefined>
  itemprop?: Trackable<string | undefined>
  itemScope?: Trackable<boolean | undefined>
  itemscope?: Trackable<boolean | undefined>
  itemType?: Trackable<string | undefined>
  itemtype?: Trackable<string | undefined>
  itemID?: Trackable<string | undefined>
  itemid?: Trackable<string | undefined>
  itemRef?: Trackable<string | undefined>
  itemref?: Trackable<string | undefined>
}

export interface HTMLProps<eventTarget extends EventTarget = EventTarget>
  extends HostProps<eventTarget>,
    AriaProps {
  // Standard HTML Attributes
  accesskey?: Trackable<string | undefined>
  accessKey?: Trackable<string | undefined>
  autocapitalize?: Trackable<
    'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  >
  autoCapitalize?: Trackable<
    'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  >
  autocorrect?: Trackable<string | undefined>
  autoCorrect?: Trackable<string | undefined>
  autofocus?: Trackable<boolean | undefined>
  autoFocus?: Trackable<boolean | undefined>
  class?: Trackable<string | undefined>
  className?: Trackable<string | undefined>
  contenteditable?: Trackable<Booleanish | '' | 'plaintext-only' | 'inherit' | undefined>
  contentEditable?: Trackable<Booleanish | '' | 'plaintext-only' | 'inherit' | undefined>
  dir?: Trackable<'auto' | 'rtl' | 'ltr' | undefined>
  draggable?: Trackable<boolean | undefined>
  enterkeyhint?: Trackable<
    'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  >
  exportparts?: Trackable<string | undefined>
  hidden?: Trackable<boolean | 'hidden' | 'until-found' | undefined>
  id?: Trackable<string | undefined>
  inert?: Trackable<boolean | undefined>
  inputmode?: Trackable<string | undefined>
  inputMode?: Trackable<string | undefined>
  is?: Trackable<string | undefined>
  lang?: Trackable<string | undefined>
  nonce?: Trackable<string | undefined>
  part?: Trackable<string | undefined>
  popover?: Trackable<'auto' | 'hint' | 'manual' | boolean | undefined>
  slot?: Trackable<string | undefined>
  spellcheck?: Trackable<boolean | undefined>
  style?: Trackable<string | StyleProps | undefined>
  tabindex?: Trackable<number | undefined>
  tabIndex?: Trackable<number | undefined>
  title?: Trackable<string | undefined>
  translate?: Trackable<boolean | undefined>

  // WAI-ARIA Attributes
  // Most elements only allow a subset of roles and so this
  // is overwritten in many of the per-element interfaces below
  role?: Trackable<AriaRole | undefined>

  // Non-standard Attributes
  disablePictureInPicture?: Trackable<boolean | undefined>
  elementtiming?: Trackable<string | undefined>
  elementTiming?: Trackable<string | undefined>
  results?: Trackable<number | undefined>

  // RDFa Attributes
  about?: Trackable<string | undefined>
  datatype?: Trackable<string | undefined>
  inlist?: Trackable<any>
  prefix?: Trackable<string | undefined>
  property?: Trackable<string | undefined>
  resource?: Trackable<string | undefined>
  typeof?: Trackable<string | undefined>
  vocab?: Trackable<string | undefined>

  // Microdata Attributes
  itemid?: Trackable<string | undefined>
  itemID?: Trackable<string | undefined>
  itemprop?: Trackable<string | undefined>
  itemProp?: Trackable<string | undefined>
  itemref?: Trackable<string | undefined>
  itemRef?: Trackable<string | undefined>
  itemscope?: Trackable<boolean | undefined>
  itemScope?: Trackable<boolean | undefined>
  itemtype?: Trackable<string | undefined>
  itemType?: Trackable<string | undefined>
}

export type HTMLAttributeReferrerPolicy =
  | ''
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url'

export type HTMLAttributeAnchorTarget = '_self' | '_blank' | '_parent' | '_top' | (string & {})

export interface PartialAnchorHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  download?: Trackable<any>
  hreflang?: Trackable<string | undefined>
  hrefLang?: Trackable<string | undefined>
  media?: Trackable<string | undefined>
  ping?: Trackable<string | undefined>
  rel?: Trackable<string | undefined>
  target?: Trackable<HTMLAttributeAnchorTarget | undefined>
  type?: Trackable<string | undefined>
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
}

export type AnchorAriaRoles =
  | {
      href: Trackable<string>
      role?: Trackable<
        | 'link'
        | 'button'
        | 'checkbox'
        | 'menuitem'
        | 'menuitemcheckbox'
        | 'menuitemradio'
        | 'option'
        | 'radio'
        | 'switch'
        | 'tab'
        | 'treeitem'
        | 'doc-backlink'
        | 'doc-biblioref'
        | 'doc-glossref'
        | 'doc-noteref'
        | undefined
      >
    }
  | {
      href?: never
      role?: Trackable<AriaRole | undefined>
    }

export type AccessibleAnchorHTMLProps<eventTarget extends EventTarget = HTMLAnchorElement> = Omit<
  PartialAnchorHTMLProps<eventTarget>,
  'role'
> &
  AnchorAriaRoles

export interface AnchorHTMLProps<eventTarget extends EventTarget = HTMLAnchorElement>
  extends PartialAnchorHTMLProps<eventTarget> {
  href?: Trackable<string | undefined>
  role?: Trackable<AriaRole | undefined>
}

export interface PartialAreaHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  alt?: Trackable<string | undefined>
  coords?: Trackable<string | undefined>
  download?: Trackable<any>
  hreflang?: Trackable<string | undefined>
  hrefLang?: Trackable<string | undefined>
  media?: Trackable<string | undefined>
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  rel?: Trackable<string | undefined>
  shape?: Trackable<string | undefined>
  target?: Trackable<HTMLAttributeAnchorTarget | undefined>
}

export type AreaAriaRoles =
  | {
      href: Trackable<string>
      role?: Trackable<'link' | undefined>
    }
  | {
      href?: never
      role?: Trackable<'button' | 'link' | undefined>
    }

export type AccessibleAreaHTMLProps<eventTarget extends EventTarget = HTMLAreaElement> = Omit<
  PartialAreaHTMLProps<eventTarget>,
  'role'
> &
  AreaAriaRoles

export interface AreaHTMLProps<eventTarget extends EventTarget = HTMLAreaElement>
  extends PartialAreaHTMLProps<eventTarget> {
  href?: Trackable<string | undefined>
  role?: Trackable<'button' | 'link' | undefined>
}

export interface ArticleHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<
    | 'article'
    | 'application'
    | 'document'
    | 'feed'
    | 'main'
    | 'none'
    | 'presentation'
    | 'region'
    | undefined
  >
}

export interface AsideHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<
    | 'complementary'
    | 'feed'
    | 'none'
    | 'note'
    | 'presentation'
    | 'region'
    | 'search'
    | 'doc-dedication'
    | 'doc-example'
    | 'doc-footnote'
    | 'doc-glossary'
    | 'doc-pullquote'
    | 'doc-tip'
    | undefined
  >
}

export interface AudioHTMLProps<eventTarget extends EventTarget = HTMLAudioElement>
  extends MediaHTMLProps<eventTarget> {
  role?: Trackable<'application' | undefined>
}

export interface BaseHTMLProps<eventTarget extends EventTarget = HTMLBaseElement>
  extends HTMLProps<eventTarget> {
  href?: Trackable<string | undefined>
  role?: never
  target?: Trackable<HTMLAttributeAnchorTarget | undefined>
}

export interface BlockquoteHTMLProps<eventTarget extends EventTarget = HTMLQuoteElement>
  extends HTMLProps<eventTarget> {
  cite?: Trackable<string | undefined>
}

export interface BrHTMLProps<eventTarget extends EventTarget = HTMLBRElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'none' | 'presentation' | undefined>
}

export interface ButtonHTMLProps<eventTarget extends EventTarget = HTMLButtonElement>
  extends HTMLProps<eventTarget> {
  command?: Trackable<string | undefined>
  commandfor?: Trackable<string | undefined>
  commandFor?: Trackable<string | undefined>
  disabled?: Trackable<boolean | undefined>
  form?: Trackable<string | undefined>
  formaction?: Trackable<string | undefined>
  formAction?: Trackable<string | undefined>
  formenctype?: Trackable<string | undefined>
  formEncType?: Trackable<string | undefined>
  formmethod?: Trackable<string | undefined>
  formMethod?: Trackable<string | undefined>
  formnovalidate?: Trackable<boolean | undefined>
  formNoValidate?: Trackable<boolean | undefined>
  formtarget?: Trackable<string | undefined>
  formTarget?: Trackable<string | undefined>
  name?: Trackable<string | undefined>
  popovertarget?: Trackable<string | undefined>
  popoverTarget?: Trackable<string | undefined>
  popovertargetaction?: Trackable<'hide' | 'show' | 'toggle' | undefined>
  popoverTargetAction?: Trackable<'hide' | 'show' | 'toggle' | undefined>
  role?: Trackable<
    | 'button'
    | 'checkbox'
    | 'combobox'
    | 'gridcell'
    | 'link'
    | 'menuitem'
    | 'menuitemcheckbox'
    | 'menuitemradio'
    | 'option'
    | 'radio'
    | 'separator'
    | 'slider'
    | 'switch'
    | 'tab'
    | 'treeitem'
    | undefined
  >
  type?: Trackable<'submit' | 'reset' | 'button' | undefined>
  value?: Trackable<string | number | undefined>
}

export interface CanvasHTMLProps<eventTarget extends EventTarget = HTMLCanvasElement>
  extends HTMLProps<eventTarget> {
  height?: Trackable<number | string | undefined>
  width?: Trackable<number | string | undefined>
}

export interface CaptionHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: 'caption'
}

export interface ColHTMLProps<eventTarget extends EventTarget = HTMLTableColElement>
  extends HTMLProps<eventTarget> {
  role?: never
  span?: Trackable<number | undefined>
  width?: Trackable<number | string | undefined>
}

export interface ColgroupHTMLProps<eventTarget extends EventTarget = HTMLTableColElement>
  extends HTMLProps<eventTarget> {
  role?: never
  span?: Trackable<number | undefined>
}

export interface DataHTMLProps<eventTarget extends EventTarget = HTMLDataElement>
  extends HTMLProps<eventTarget> {
  value?: Trackable<string | number | undefined>
}

export interface DataListHTMLProps<eventTarget extends EventTarget = HTMLDataListElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'listbox' | undefined>
}

export interface DdHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: never
}

export interface DelHTMLProps<eventTarget extends EventTarget = HTMLModElement>
  extends HTMLProps<eventTarget> {
  cite?: Trackable<string | undefined>
  datetime?: Trackable<string | undefined>
  dateTime?: Trackable<string | undefined>
}

export interface DetailsHTMLProps<eventTarget extends EventTarget = HTMLDetailsElement>
  extends HTMLProps<eventTarget> {
  name?: Trackable<string | undefined>
  open?: Trackable<boolean | undefined>
  role?: Trackable<'group' | undefined>
}

export interface DialogHTMLProps<eventTarget extends EventTarget = HTMLDialogElement>
  extends HTMLProps<eventTarget> {
  open?: Trackable<boolean | undefined>
  closedby?: Trackable<'none' | 'closerequest' | 'any' | undefined>
  closedBy?: Trackable<'none' | 'closerequest' | 'any' | undefined>
  role?: Trackable<'dialog' | 'alertdialog' | undefined>
}

export interface DlHTMLProps<eventTarget extends EventTarget = HTMLDListElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'group' | 'list' | 'none' | 'presentation' | undefined>
}

export interface DtHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'listitem' | undefined>
}

export interface EmbedHTMLProps<eventTarget extends EventTarget = HTMLEmbedElement>
  extends HTMLProps<eventTarget> {
  height?: Trackable<number | string | undefined>
  role?: Trackable<'application' | 'document' | 'img' | 'none' | 'presentation' | undefined>
  src?: Trackable<string | undefined>
  type?: Trackable<string | undefined>
  width?: Trackable<number | string | undefined>
}

export interface FieldsetHTMLProps<eventTarget extends EventTarget = HTMLFieldSetElement>
  extends HTMLProps<eventTarget> {
  disabled?: Trackable<boolean | undefined>
  form?: Trackable<string | undefined>
  name?: Trackable<string | undefined>
  role?: Trackable<'group' | 'none' | 'presentation' | 'radiogroup' | undefined>
}

export interface FigcaptionHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'group' | 'none' | 'presentation' | undefined>
}

export interface FooterHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'contentinfo' | 'group' | 'none' | 'presentation' | 'doc-footnote' | undefined>
}

export interface FormHTMLProps<eventTarget extends EventTarget = HTMLFormElement>
  extends HTMLProps<eventTarget> {
  'accept-charset'?: Trackable<string | undefined>
  acceptCharset?: Trackable<string | undefined>
  action?: Trackable<string | undefined>
  autocomplete?: Trackable<string | undefined>
  autoComplete?: Trackable<string | undefined>
  enctype?: Trackable<string | undefined>
  encType?: Trackable<string | undefined>
  method?: Trackable<string | undefined>
  name?: Trackable<string | undefined>
  novalidate?: Trackable<boolean | undefined>
  noValidate?: Trackable<boolean | undefined>
  rel?: Trackable<string | undefined>
  role?: Trackable<'form' | 'none' | 'presentation' | 'search' | undefined>
  target?: Trackable<string | undefined>
}

export interface HeadingHTMLProps<eventTarget extends EventTarget = HTMLHeadingElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'heading' | 'none' | 'presentation' | 'tab' | 'doc-subtitle' | undefined>
}

export interface HeadHTMLProps<eventTarget extends EventTarget = HTMLHeadElement>
  extends HTMLProps<eventTarget> {
  role?: never
}

export interface HeaderHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'banner' | 'group' | 'none' | 'presentation' | undefined>
}

export interface HrHTMLProps<eventTarget extends EventTarget = HTMLHRElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'separator' | 'none' | 'presentation' | 'doc-pagebreak' | undefined>
}

export interface HtmlHTMLProps<eventTarget extends EventTarget = HTMLHtmlElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'document' | undefined>
}

export interface IframeHTMLProps<eventTarget extends EventTarget = HTMLIFrameElement>
  extends HTMLProps<eventTarget> {
  allow?: Trackable<string | undefined>
  allowFullScreen?: Trackable<boolean | undefined>
  allowTransparency?: Trackable<boolean | undefined>
  /** @deprecated */
  frameborder?: Trackable<number | string | undefined>
  /** @deprecated */
  frameBorder?: Trackable<number | string | undefined>
  height?: Trackable<number | string | undefined>
  loading?: Trackable<'eager' | 'lazy' | undefined>
  /** @deprecated */
  marginHeight?: Trackable<number | undefined>
  /** @deprecated */
  marginWidth?: Trackable<number | undefined>
  name?: Trackable<string | undefined>
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  role?: Trackable<'application' | 'document' | 'img' | 'none' | 'presentation' | undefined>
  sandbox?: Trackable<string | undefined>
  /** @deprecated */
  scrolling?: Trackable<string | undefined>
  seamless?: Trackable<boolean | undefined>
  src?: Trackable<string | undefined>
  srcdoc?: Trackable<string | undefined>
  srcDoc?: Trackable<string | undefined>
  width?: Trackable<number | string | undefined>
}

export type HTMLAttributeCrossOrigin = 'anonymous' | 'use-credentials'

export interface PartialImgHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  crossorigin?: Trackable<HTMLAttributeCrossOrigin>
  crossOrigin?: Trackable<HTMLAttributeCrossOrigin>
  decoding?: Trackable<'async' | 'auto' | 'sync' | undefined>
  fetchpriority?: Trackable<'high' | 'auto' | 'low' | undefined>
  fetchPriority?: Trackable<'high' | 'auto' | 'low' | undefined>
  height?: Trackable<number | string | undefined>
  loading?: Trackable<'eager' | 'lazy' | undefined>
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  sizes?: Trackable<string | undefined>
  src?: Trackable<string | undefined>
  srcset?: Trackable<string | undefined>
  srcSet?: Trackable<string | undefined>
  usemap?: Trackable<string | undefined>
  useMap?: Trackable<string | undefined>
  width?: Trackable<number | string | undefined>
}

export type ImgAriaRolesAccessibleName = Trackable<
  | 'img'
  | 'button'
  | 'checkbox'
  | 'link'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'meter'
  | 'option'
  | 'progressbar'
  | 'radio'
  | 'scrollbar'
  | 'separator'
  | 'slider'
  | 'switch'
  | 'tab'
  | 'treeitem'
  | 'doc-cover'
  | undefined
>

export type ImgAriaRoles =
  | {
      'aria-label': Trackable<string>
      role?: ImgAriaRolesAccessibleName
    }
  | {
      'aria-labelledby': Trackable<string>
      role?: ImgAriaRolesAccessibleName
    }
  | {
      alt: Trackable<string>
      role?: ImgAriaRolesAccessibleName
    }
  | {
      title: Trackable<string>
      role?: ImgAriaRolesAccessibleName
    }
  | {
      'aria-label'?: never
      'aria-labelledby'?: never
      alt?: never
      title?: never
      role?: Trackable<'img' | 'none' | 'presentation' | undefined>
    }

export type AccessibleImgHTMLProps<eventTarget extends EventTarget = HTMLImageElement> = Omit<
  PartialImgHTMLProps<eventTarget>,
  'role' | 'aria-label' | 'aria-labelledby' | 'title'
> &
  ImgAriaRoles

export interface ImgHTMLProps<eventTarget extends EventTarget = HTMLImageElement>
  extends PartialImgHTMLProps<eventTarget> {
  alt?: Trackable<string | undefined>
  'aria-label'?: Trackable<string | undefined>
  'aria-labelledby'?: Trackable<string | undefined>
  href?: Trackable<string | undefined>
  role?: ImgAriaRolesAccessibleName | Trackable<'img' | 'none' | 'presentation' | undefined>
  title?: Trackable<string | undefined>
}

export type HTMLInputTypeAttribute =
  | 'button'
  | 'checkbox'
  | 'color'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'hidden'
  | 'image'
  | 'month'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'reset'
  | 'search'
  | 'submit'
  | 'tel'
  | 'text'
  | 'time'
  | 'url'
  | 'week'

export interface PartialInputHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  accept?: Trackable<string | undefined>
  alt?: Trackable<string | undefined>
  autocomplete?: Trackable<string | undefined>
  autoComplete?: Trackable<string | undefined>
  capture?: Trackable<'user' | 'environment' | undefined> // https://www.w3.org/TR/html-media-capture/#the-capture-attribute
  checked?: Trackable<boolean | undefined>
  defaultChecked?: Trackable<boolean | undefined>
  defaultValue?: Trackable<string | number | undefined>
  disabled?: Trackable<boolean | undefined>
  enterKeyHint?: Trackable<
    'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  >
  form?: Trackable<string | undefined>
  formaction?: Trackable<string | undefined>
  formAction?: Trackable<string | undefined>
  formenctype?: Trackable<string | undefined>
  formEncType?: Trackable<string | undefined>
  formmethod?: Trackable<string | undefined>
  formMethod?: Trackable<string | undefined>
  formnovalidate?: Trackable<boolean | undefined>
  formNoValidate?: Trackable<boolean | undefined>
  formtarget?: Trackable<string | undefined>
  formTarget?: Trackable<string | undefined>
  height?: Trackable<number | string | undefined>
  indeterminate?: Trackable<boolean | undefined>
  max?: Trackable<number | string | undefined>
  maxlength?: Trackable<number | undefined>
  maxLength?: Trackable<number | undefined>
  min?: Trackable<number | string | undefined>
  minlength?: Trackable<number | undefined>
  minLength?: Trackable<number | undefined>
  multiple?: Trackable<boolean | undefined>
  name?: Trackable<string | undefined>
  pattern?: Trackable<string | undefined>
  placeholder?: Trackable<string | undefined>
  readonly?: Trackable<boolean | undefined>
  readOnly?: Trackable<boolean | undefined>
  required?: Trackable<boolean | undefined>
  size?: Trackable<number | undefined>
  src?: Trackable<string | undefined>
  step?: Trackable<number | string | undefined>
  value?: Trackable<string | number | undefined>
  width?: Trackable<number | string | undefined>
}

export type InputAriaRoles =
  | {
      type: Trackable<'button'>
      role?: Trackable<
        | 'button'
        | 'checkbox'
        | 'combobox'
        | 'gridcell'
        | 'link'
        | 'menuitem'
        | 'menuitemcheckbox'
        | 'menuitemradio'
        | 'option'
        | 'radio'
        | 'separator'
        | 'slider'
        | 'switch'
        | 'tab'
        | 'treeitem'
        | undefined
      >
    }
  | {
      type: Trackable<'checkbox'>
      role?: Trackable<'checkbox' | 'button' | 'menuitemcheckbox' | 'option' | 'switch' | undefined>
    }
  | {
      type: Trackable<'email'>
      list?: never
      role?: Trackable<'textbox' | undefined>
    }
  | {
      type: Trackable<'image'>
      role?: Trackable<
        | 'button'
        | 'checkbox'
        | 'gridcell'
        | 'link'
        | 'menuitem'
        | 'menuitemcheckbox'
        | 'menuitemradio'
        | 'option'
        | 'separator'
        | 'slider'
        | 'switch'
        | 'tab'
        | 'treeitem'
        | undefined
      >
    }
  | {
      type: Trackable<'number'>
      role?: Trackable<'spinbutton' | undefined>
    }
  | {
      type: Trackable<'radio'>
      role?: Trackable<'radio' | 'menuitemradio' | undefined>
    }
  | {
      type: Trackable<'range'>
      role?: Trackable<'slider' | undefined>
    }
  | {
      type: Trackable<'reset'>
      role?: Trackable<
        | 'button'
        | 'checkbox'
        | 'combobox'
        | 'gridcell'
        | 'link'
        | 'menuitem'
        | 'menuitemcheckbox'
        | 'menuitemradio'
        | 'option'
        | 'radio'
        | 'separator'
        | 'slider'
        | 'switch'
        | 'tab'
        | 'treeitem'
        | undefined
      >
    }
  | {
      type: Trackable<'search'>
      list?: never
      role?: Trackable<'searchbox' | undefined>
    }
  | {
      type: Trackable<'submit'>
      role?: Trackable<
        | 'button'
        | 'checkbox'
        | 'combobox'
        | 'gridcell'
        | 'link'
        | 'menuitem'
        | 'menuitemcheckbox'
        | 'menuitemradio'
        | 'option'
        | 'radio'
        | 'separator'
        | 'slider'
        | 'switch'
        | 'tab'
        | 'treeitem'
        | undefined
      >
    }
  | {
      type: Trackable<'tel'>
      list?: never
      role?: Trackable<'textbox' | undefined>
    }
  | {
      type?: Trackable<'text'>
      list?: never
      role?: Trackable<'textbox' | 'combobox' | 'searchbox' | 'spinbutton' | undefined>
    }
  | {
      type?: Trackable<'text' | 'search' | 'tel' | 'url' | 'email'>
      list: Trackable<string | undefined>
      role?: Trackable<'combobox' | undefined>
    }
  | {
      type: Trackable<'url'>
      list?: never
      role?: Trackable<'textbox' | undefined>
    }
  | {
      type: Trackable<
        | 'color'
        | 'date'
        | 'datetime-local'
        | 'file'
        | 'hidden'
        | 'month'
        | 'password'
        | 'time'
        | 'week'
      >
      role?: never
    }

export type AccessibleInputHTMLProps<eventTarget extends EventTarget = HTMLInputElement> = Omit<
  PartialInputHTMLProps<eventTarget>,
  'role'
> &
  InputAriaRoles

export interface InputHTMLProps<eventTarget extends EventTarget = HTMLInputElement>
  extends PartialInputHTMLProps<eventTarget> {
  type?: Trackable<HTMLInputTypeAttribute | undefined>
  role?: Trackable<
    | 'button'
    | 'checkbox'
    | 'combobox'
    | 'gridcell'
    | 'link'
    | 'menuitem'
    | 'menuitemcheckbox'
    | 'menuitemradio'
    | 'option'
    | 'radio'
    | 'searchbox'
    | 'separator'
    | 'slider'
    | 'spinbutton'
    | 'switch'
    | 'tab'
    | 'textbox'
    | 'treeitem'
    | undefined
  >
}

export interface InsHTMLProps<eventTarget extends EventTarget = HTMLModElement>
  extends HTMLProps<eventTarget> {
  cite?: Trackable<string | undefined>
  datetime?: Trackable<string | undefined>
  dateTime?: Trackable<string | undefined>
}

export interface KeygenHTMLProps<eventTarget extends EventTarget = HTMLUnknownElement>
  extends HTMLProps<eventTarget> {
  challenge?: Trackable<string | undefined>
  disabled?: Trackable<boolean | undefined>
  form?: Trackable<string | undefined>
  keyType?: Trackable<string | undefined>
  keyParams?: Trackable<string | undefined>
  name?: Trackable<string | undefined>
}

export interface LabelHTMLProps<eventTarget extends EventTarget = HTMLLabelElement>
  extends HTMLProps<eventTarget> {
  for?: Trackable<string | undefined>
  form?: Trackable<string | undefined>
  htmlFor?: Trackable<string | undefined>
  role?: never
}

export interface LegendHTMLProps<eventTarget extends EventTarget = HTMLLegendElement>
  extends HTMLProps<eventTarget> {
  role?: never
}

export interface LiHTMLProps<eventTarget extends EventTarget = HTMLLIElement>
  extends HTMLProps<eventTarget> {
  value?: Trackable<string | number | undefined>
}

export interface LinkHTMLProps<eventTarget extends EventTarget = HTMLLinkElement>
  extends HTMLProps<eventTarget> {
  as?: Trackable<string | undefined>
  crossorigin?: Trackable<HTMLAttributeCrossOrigin>
  crossOrigin?: Trackable<HTMLAttributeCrossOrigin>
  fetchpriority?: Trackable<'high' | 'low' | 'auto' | undefined>
  fetchPriority?: Trackable<'high' | 'low' | 'auto' | undefined>
  href?: Trackable<string | undefined>
  hreflang?: Trackable<string | undefined>
  hrefLang?: Trackable<string | undefined>
  integrity?: Trackable<string | undefined>
  media?: Trackable<string | undefined>
  imageSrcSet?: Trackable<string | undefined>
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  rel?: Trackable<string | undefined>
  role?: never
  sizes?: Trackable<string | undefined>
  type?: Trackable<string | undefined>
  charset?: Trackable<string | undefined>
  charSet?: Trackable<string | undefined>
}

export interface MainHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'main' | undefined>
}

export interface MapHTMLProps<eventTarget extends EventTarget = HTMLMapElement>
  extends HTMLProps<eventTarget> {
  name?: Trackable<string | undefined>
  role?: never
}

export interface MarqueeHTMLProps<eventTarget extends EventTarget = HTMLMarqueeElement>
  extends HTMLProps<eventTarget> {
  behavior?: Trackable<'scroll' | 'slide' | 'alternate' | undefined>
  bgColor?: Trackable<string | undefined>
  direction?: Trackable<'left' | 'right' | 'up' | 'down' | undefined>
  height?: Trackable<number | string | undefined>
  hspace?: Trackable<number | string | undefined>
  loop?: Trackable<number | string | undefined>
  scrollAmount?: Trackable<number | string | undefined>
  scrollDelay?: Trackable<number | string | undefined>
  trueSpeed?: Trackable<boolean | undefined>
  vspace?: Trackable<number | string | undefined>
  width?: Trackable<number | string | undefined>
}

export interface MediaHTMLProps<eventTarget extends EventTarget = HTMLMediaElement>
  extends HTMLProps<eventTarget> {
  autoplay?: Trackable<boolean | undefined>
  autoPlay?: Trackable<boolean | undefined>
  controls?: Trackable<boolean | undefined>
  controlslist?: Trackable<string | undefined>
  controlsList?: Trackable<string | undefined>
  crossorigin?: Trackable<HTMLAttributeCrossOrigin>
  crossOrigin?: Trackable<HTMLAttributeCrossOrigin>
  currentTime?: Trackable<number | undefined>
  defaultMuted?: Trackable<boolean | undefined>
  defaultPlaybackRate?: Trackable<number | undefined>
  disableremoteplayback?: Trackable<boolean | undefined>
  disableRemotePlayback?: Trackable<boolean | undefined>
  loop?: Trackable<boolean | undefined>
  mediaGroup?: Trackable<string | undefined>
  muted?: Trackable<boolean | undefined>
  playbackRate?: Trackable<number | undefined>
  preload?: Trackable<'auto' | 'metadata' | 'none' | undefined>
  preservesPitch?: Trackable<boolean | undefined>
  src?: Trackable<string | undefined>
  srcObject?: Trackable<MediaStream | MediaSource | Blob | File | null>
  volume?: Trackable<string | number | undefined>
}

export interface MenuHTMLProps<eventTarget extends EventTarget = HTMLMenuElement>
  extends HTMLProps<eventTarget> {
  role:
    | 'list'
    | 'group'
    | 'listbox'
    | 'menu'
    | 'menubar'
    | 'none'
    | 'presentation'
    | 'radiogroup'
    | 'tablist'
    | 'toolbar'
    | 'tree'
  type?: Trackable<string | undefined>
}

export interface MetaHTMLProps<eventTarget extends EventTarget = HTMLMetaElement>
  extends HTMLProps<eventTarget> {
  charset?: Trackable<string | undefined>
  charSet?: Trackable<string | undefined>
  content?: Trackable<string | undefined>
  'http-equiv'?: Trackable<string | undefined>
  httpEquiv?: Trackable<string | undefined>
  name?: Trackable<string | undefined>
  media?: Trackable<string | undefined>
  role?: never
}

export interface MeterHTMLProps<eventTarget extends EventTarget = HTMLMeterElement>
  extends HTMLProps<eventTarget> {
  form?: Trackable<string | undefined>
  high?: Trackable<number | undefined>
  low?: Trackable<number | undefined>
  max?: Trackable<number | string | undefined>
  min?: Trackable<number | string | undefined>
  optimum?: Trackable<number | undefined>
  role?: Trackable<'meter' | undefined>
  value?: Trackable<string | number | undefined>
}

export interface NavHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<
    'navigation' | 'menu' | 'menubar' | 'none' | 'presentation' | 'tablist' | undefined
  >
}

export interface NoScriptHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: never
}

export interface ObjectHTMLProps<eventTarget extends EventTarget = HTMLObjectElement>
  extends HTMLProps<eventTarget> {
  classID?: Trackable<string | undefined>
  data?: Trackable<string | undefined>
  form?: Trackable<string | undefined>
  height?: Trackable<number | string | undefined>
  name?: Trackable<string | undefined>
  role?: Trackable<'application' | 'document' | 'img' | undefined>
  type?: Trackable<string | undefined>
  usemap?: Trackable<string | undefined>
  useMap?: Trackable<string | undefined>
  width?: Trackable<number | string | undefined>
  wmode?: Trackable<string | undefined>
}

export interface OlHTMLProps<eventTarget extends EventTarget = HTMLOListElement>
  extends HTMLProps<eventTarget> {
  reversed?: Trackable<boolean | undefined>
  role?: Trackable<
    | 'list'
    | 'group'
    | 'listbox'
    | 'menu'
    | 'menubar'
    | 'none'
    | 'presentation'
    | 'radiogroup'
    | 'tablist'
    | 'toolbar'
    | 'tree'
    | undefined
  >
  start?: Trackable<number | undefined>
  type?: Trackable<'1' | 'a' | 'A' | 'i' | 'I' | undefined>
}

export interface OptgroupHTMLProps<eventTarget extends EventTarget = HTMLOptGroupElement>
  extends HTMLProps<eventTarget> {
  disabled?: Trackable<boolean | undefined>
  label?: Trackable<string | undefined>
  role?: Trackable<'group' | undefined>
}

export interface OptionHTMLProps<eventTarget extends EventTarget = HTMLOptionElement>
  extends HTMLProps<eventTarget> {
  disabled?: Trackable<boolean | undefined>
  label?: Trackable<string | undefined>
  role?: Trackable<'option' | undefined>
  selected?: Trackable<boolean | undefined>
  value?: Trackable<string | number | undefined>
}

export interface OutputHTMLProps<eventTarget extends EventTarget = HTMLOutputElement>
  extends HTMLProps<eventTarget> {
  for?: Trackable<string | undefined>
  form?: Trackable<string | undefined>
  htmlFor?: Trackable<string | undefined>
  name?: Trackable<string | undefined>
}

export interface ParamHTMLProps<eventTarget extends EventTarget = HTMLParamElement>
  extends HTMLProps<eventTarget> {
  name?: Trackable<string | undefined>
  role?: never
  value?: Trackable<string | number | undefined>
}

export interface PictureHTMLProps<eventTarget extends EventTarget = HTMLPictureElement>
  extends HTMLProps<eventTarget> {
  role?: never
}

export interface ProgressHTMLProps<eventTarget extends EventTarget = HTMLProgressElement>
  extends HTMLProps<eventTarget> {
  max?: Trackable<number | string | undefined>
  role?: Trackable<'progressbar' | undefined>
  value?: Trackable<string | number | undefined>
}

export interface QuoteHTMLProps<eventTarget extends EventTarget = HTMLQuoteElement>
  extends HTMLProps<eventTarget> {
  cite?: Trackable<string | undefined>
}

export interface ScriptHTMLProps<eventTarget extends EventTarget = HTMLScriptElement>
  extends HTMLProps<eventTarget> {
  async?: Trackable<boolean | undefined>
  /** @deprecated */
  charset?: Trackable<string | undefined>
  /** @deprecated */
  charSet?: Trackable<string | undefined>
  crossorigin?: Trackable<HTMLAttributeCrossOrigin>
  crossOrigin?: Trackable<HTMLAttributeCrossOrigin>
  defer?: Trackable<boolean | undefined>
  integrity?: Trackable<string | undefined>
  nomodule?: Trackable<boolean | undefined>
  noModule?: Trackable<boolean | undefined>
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  role?: never
  src?: Trackable<string | undefined>
  type?: Trackable<string | undefined>
}

export interface SearchHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'search' | 'form' | 'group' | 'none' | 'presentation' | 'region' | undefined>
}

export interface PartialSelectHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  autocomplete?: Trackable<string | undefined>
  autoComplete?: Trackable<string | undefined>
  defaultValue?: Trackable<string | number | undefined>
  disabled?: Trackable<boolean | undefined>
  form?: Trackable<string | undefined>
  name?: Trackable<string | undefined>
  required?: Trackable<boolean | undefined>
  size?: Trackable<number | undefined>
  value?: Trackable<string | number | undefined>
}

export type SelectAriaRoles =
  | {
      multiple?: never
      // Spec states this branch is limited to "no `multiple` attribute AND no `size` attribute greater than 1".
      // `1` as a default, however, caused some web compat issues and forced Firefox to default to `0` instead.
      size?: 0 | 1 | never
      role?: Trackable<'combobox' | 'menu' | undefined>
    }
  | {
      multiple?: Trackable<boolean | undefined>
      size?: Trackable<number | undefined>
      role?: Trackable<'listbox' | undefined>
    }

export type AccessibleSelectHTMLProps<eventTarget extends EventTarget = HTMLSelectElement> = Omit<
  PartialSelectHTMLProps<eventTarget>,
  'role'
> &
  SelectAriaRoles

export interface SelectHTMLProps<eventTarget extends EventTarget = HTMLSelectElement>
  extends PartialSelectHTMLProps<eventTarget> {
  multiple?: Trackable<boolean | undefined>
  size?: Trackable<number | undefined>
  type?: Trackable<HTMLInputTypeAttribute | undefined>
  role?: Trackable<'combobox' | 'listbox' | 'menu' | undefined>
}

export interface SlotHTMLProps<eventTarget extends EventTarget = HTMLSlotElement>
  extends HTMLProps<eventTarget> {
  name?: Trackable<string | undefined>
  role?: never
}

export interface SourceHTMLProps<eventTarget extends EventTarget = HTMLSourceElement>
  extends HTMLProps<eventTarget> {
  height?: Trackable<number | string | undefined>
  media?: Trackable<string | undefined>
  role?: never
  sizes?: Trackable<string | undefined>
  src?: Trackable<string | undefined>
  srcset?: Trackable<string | undefined>
  srcSet?: Trackable<string | undefined>
  type?: Trackable<string | undefined>
  width?: Trackable<number | string | undefined>
}

export interface StyleHTMLProps<eventTarget extends EventTarget = HTMLStyleElement>
  extends HTMLProps<eventTarget> {
  media?: Trackable<string | undefined>
  role?: never
  scoped?: Trackable<boolean | undefined>
  type?: Trackable<string | undefined>
}

export interface TableHTMLProps<eventTarget extends EventTarget = HTMLTableElement>
  extends HTMLProps<eventTarget> {
  cellPadding?: Trackable<string | undefined>
  cellSpacing?: Trackable<string | undefined>
  summary?: Trackable<string | undefined>
  width?: Trackable<number | string | undefined>
}

export interface TdHTMLProps<eventTarget extends EventTarget = HTMLTableCellElement>
  extends HTMLProps<eventTarget> {
  align?: Trackable<'left' | 'center' | 'right' | 'justify' | 'char' | undefined>
  colspan?: Trackable<number | undefined>
  colSpan?: Trackable<number | undefined>
  headers?: Trackable<string | undefined>
  rowspan?: Trackable<number | undefined>
  rowSpan?: Trackable<number | undefined>
  scope?: Trackable<string | undefined>
  abbr?: Trackable<string | undefined>
  height?: Trackable<number | string | undefined>
  width?: Trackable<number | string | undefined>
  valign?: Trackable<'top' | 'middle' | 'bottom' | 'baseline' | undefined>
}

export interface TemplateHTMLProps<eventTarget extends EventTarget = HTMLTemplateElement>
  extends HTMLProps<eventTarget> {
  role?: never
}

export interface TextareaHTMLProps<eventTarget extends EventTarget = HTMLTextAreaElement>
  extends HTMLProps<eventTarget> {
  autocomplete?: Trackable<string | undefined>
  autoComplete?: Trackable<string | undefined>
  cols?: Trackable<number | undefined>
  defaultValue?: Trackable<string | number | undefined>
  dirName?: Trackable<string | undefined>
  disabled?: Trackable<boolean | undefined>
  form?: Trackable<string | undefined>
  maxlength?: Trackable<number | undefined>
  maxLength?: Trackable<number | undefined>
  minlength?: Trackable<number | undefined>
  minLength?: Trackable<number | undefined>
  name?: Trackable<string | undefined>
  placeholder?: Trackable<string | undefined>
  readOnly?: Trackable<boolean | undefined>
  required?: Trackable<boolean | undefined>
  role?: Trackable<'textbox' | undefined>
  rows?: Trackable<number | undefined>
  value?: Trackable<string | number | undefined>
  wrap?: Trackable<string | undefined>
}

export interface ThHTMLProps<eventTarget extends EventTarget = HTMLTableCellElement>
  extends HTMLProps<eventTarget> {
  align?: Trackable<'left' | 'center' | 'right' | 'justify' | 'char' | undefined>
  colspan?: Trackable<number | undefined>
  colSpan?: Trackable<number | undefined>
  headers?: Trackable<string | undefined>
  rowspan?: Trackable<number | undefined>
  rowSpan?: Trackable<number | undefined>
  scope?: Trackable<string | undefined>
  abbr?: Trackable<string | undefined>
}

export interface TimeHTMLProps<eventTarget extends EventTarget = HTMLTimeElement>
  extends HTMLProps<eventTarget> {
  datetime?: Trackable<string | undefined>
  dateTime?: Trackable<string | undefined>
}

export interface TitleHTMLProps<eventTarget extends EventTarget = HTMLTitleElement>
  extends HTMLProps<eventTarget> {
  role?: never
}

export interface TrackHTMLProps<eventTarget extends EventTarget = HTMLTrackElement>
  extends MediaHTMLProps<eventTarget> {
  default?: Trackable<boolean | undefined>
  kind?: Trackable<string | undefined>
  label?: Trackable<string | undefined>
  role?: never
  srclang?: Trackable<string | undefined>
  srcLang?: Trackable<string | undefined>
}

export interface UlHTMLProps<eventTarget extends EventTarget = HTMLUListElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<
    | 'list'
    | 'group'
    | 'listbox'
    | 'menu'
    | 'menubar'
    | 'none'
    | 'presentation'
    | 'radiogroup'
    | 'tablist'
    | 'toolbar'
    | 'tree'
    | undefined
  >
}

export interface VideoHTMLProps<eventTarget extends EventTarget = HTMLVideoElement>
  extends MediaHTMLProps<eventTarget> {
  disablePictureInPicture?: Trackable<boolean | undefined>
  height?: Trackable<number | string | undefined>
  playsinline?: Trackable<boolean | undefined>
  playsInline?: Trackable<boolean | undefined>
  poster?: Trackable<string | undefined>
  width?: Trackable<number | string | undefined>
  role?: Trackable<'application' | undefined>
}

export interface WbrHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  role?: Trackable<'none' | 'presentation' | undefined>
}

export type DetailedHTMLProps<
  HA extends HTMLProps<RefType>,
  RefType extends EventTarget = EventTarget,
> = HA

export interface MathMLProps<eventTarget extends EventTarget = MathMLElement>
  extends HTMLProps<eventTarget> {
  dir?: Trackable<'ltr' | 'rtl' | undefined>
  displaystyle?: Trackable<boolean | undefined>
  /** @deprecated This feature is non-standard. See https://developer.mozilla.org/en-US/docs/Web/MathML/Global_attributes/href  */
  href?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Global_attributes/mathbackground */
  mathbackground?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Global_attributes/mathcolor */
  mathcolor?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Global_attributes/mathsize */
  mathsize?: Trackable<string | undefined>
  nonce?: Trackable<string | undefined>
  scriptlevel?: Trackable<string | undefined>
}

export interface AnnotationMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  encoding?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/semantics#src */
  src?: Trackable<string | undefined>
}

export interface AnnotationXmlMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  encoding?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/semantics#src */
  src?: Trackable<string | undefined>
}

export interface MActionMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/maction#actiontype */
  actiontype?: Trackable<'statusline' | 'toggle' | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/maction#selection */
  selection?: Trackable<string | undefined>
}

export interface MathMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  display?: Trackable<'block' | 'inline' | undefined>
}

export interface MEncloseMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  notation?: Trackable<string | undefined>
}

export interface MErrorMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

export interface MFencedMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  close?: Trackable<string | undefined>
  open?: Trackable<string | undefined>
  separators?: Trackable<string | undefined>
}

export interface MFracMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mfrac#denomalign */
  denomalign?: Trackable<'center' | 'left' | 'right' | undefined>
  linethickness?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mfrac#numalign */
  numalign?: Trackable<'center' | 'left' | 'right' | undefined>
}

export interface MiMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /**
   * The only value allowed in the current specification is normal (case insensitive)
   * See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mi#mathvariant
   */
  mathvariant?: Trackable<
    | 'normal'
    | 'bold'
    | 'italic'
    | 'bold-italic'
    | 'double-struck'
    | 'bold-fraktur'
    | 'script'
    | 'bold-script'
    | 'fraktur'
    | 'sans-serif'
    | 'bold-sans-serif'
    | 'sans-serif-italic'
    | 'sans-serif-bold-italic'
    | 'monospace'
    | 'initial'
    | 'tailed'
    | 'looped'
    | 'stretched'
    | undefined
  >
}

export interface MmultiScriptsMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mmultiscripts#subscriptshift */
  subscriptshift?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mmultiscripts#superscriptshift */
  superscriptshift?: Trackable<string | undefined>
}

export interface MNMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {}

export interface MOMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mo#accent */
  accent?: Trackable<boolean | undefined>
  fence?: Trackable<boolean | undefined>
  largeop?: Trackable<boolean | undefined>
  lspace?: Trackable<string | undefined>
  maxsize?: Trackable<string | undefined>
  minsize?: Trackable<string | undefined>
  movablelimits?: Trackable<boolean | undefined>
  rspace?: Trackable<string | undefined>
  separator?: Trackable<boolean | undefined>
  stretchy?: Trackable<boolean | undefined>
  symmetric?: Trackable<boolean | undefined>
}

export interface MOverMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  accent?: Trackable<boolean | undefined>
}

export interface MPaddedMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  depth?: Trackable<string | undefined>
  height?: Trackable<string | undefined>
  lspace?: Trackable<string | undefined>
  voffset?: Trackable<string | undefined>
  width?: Trackable<string | undefined>
}

export interface MPhantomMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

export interface MPrescriptsMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

export interface MRootMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

export interface MRowMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

export interface MSMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/ms#browser_compatibility */
  lquote?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/ms#browser_compatibility */
  rquote?: Trackable<string | undefined>
}

export interface MSpaceMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  depth?: Trackable<string | undefined>
  height?: Trackable<string | undefined>
  width?: Trackable<string | undefined>
}

export interface MSqrtMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

export interface MStyleMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mstyle#background */
  background?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mstyle#color */
  color?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mstyle#fontsize */
  fontsize?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mstyle#fontstyle */
  fontstyle?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mstyle#fontweight */
  fontweight?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mstyle#scriptminsize */
  scriptminsize?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mstyle#scriptsizemultiplier */
  scriptsizemultiplier?: Trackable<string | undefined>
}

export interface MSubMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/msub#subscriptshift */
  subscriptshift?: Trackable<string | undefined>
}

export interface MSubsupMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/msubsup#subscriptshift */
  subscriptshift?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/msubsup#superscriptshift */
  superscriptshift?: Trackable<string | undefined>
}

export interface MSupMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/msup#superscriptshift */
  superscriptshift?: Trackable<string | undefined>
}

export interface MTableMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#align */
  align?: Trackable<'axis' | 'baseline' | 'bottom' | 'center' | 'top' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#columnalign */
  columnalign?: Trackable<'center' | 'left' | 'right' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#columnlines */
  columnlines?: Trackable<'dashed' | 'none' | 'solid' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#columnspacing */
  columnspacing?: Trackable<string | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#frame */
  frame?: Trackable<'dashed' | 'none' | 'solid' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#framespacing */
  framespacing?: Trackable<string | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#rowalign */
  rowalign?: Trackable<'axis' | 'baseline' | 'bottom' | 'center' | 'top' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#rowlines */
  rowlines?: Trackable<'dashed' | 'none' | 'solid' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#rowspacing */
  rowspacing?: Trackable<string | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtable#width */
  width?: Trackable<string | undefined>
}

export interface MTdMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  columnspan?: Trackable<number | undefined>
  rowspan?: Trackable<number | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtd#columnalign */
  columnalign?: Trackable<'center' | 'left' | 'right' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtd#rowalign */
  rowalign?: Trackable<'axis' | 'baseline' | 'bottom' | 'center' | 'top' | undefined>
}

export interface MTextMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

export interface MTrMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtr#columnalign */
  columnalign?: Trackable<'center' | 'left' | 'right' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtr#rowalign */
  rowalign?: Trackable<'axis' | 'baseline' | 'bottom' | 'center' | 'top' | undefined>
}

export interface MUnderMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  accentunder?: Trackable<boolean | undefined>
}

export interface MUnderoverMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  accent?: Trackable<boolean | undefined>
  accentunder?: Trackable<boolean | undefined>
}

export interface SemanticsMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}
