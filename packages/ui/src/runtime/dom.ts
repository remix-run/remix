import type { StyleProps } from '../style/style.ts'
import type { RemixNode } from './jsx.ts'
import type { MixInput } from './mixins/mixin.ts'

/**
 * Adapted from Preact:
 * - Source: https://github.com/preactjs/preact/blob/eee0c6ef834534498e433f0f7a3ef679efd24380/src/dom.d.ts
 * - License: MIT https://github.com/preactjs/preact/blob/eee0c6ef834534498e433f0f7a3ef679efd24380/LICENSE
 * - Copyright (c) 2015-present Jason Miller
 */
type Booleanish = boolean | 'true' | 'false'

/**
 * Layout animation configuration for FLIP-based position animations.
 * All properties are optional - defaults are applied when `true` or `{}` is used.
 */
export interface LayoutAnimationConfig {
  /** Animation duration in milliseconds (default: 200) */
  duration?: number
  /** CSS easing function (default: spring 'snappy' easing) */
  easing?: string
  /** Include scale projection for size changes (default: true) */
  size?: boolean
}

/**
 * Shared host-element props accepted by all built-in DOM element types.
 */
export interface HostProps<eventTarget extends EventTarget> {
  /** The reconciliation key for the element. */
  key?: any
  /** Child nodes to render inside the element. */
  children?: RemixNode
  /** Mixins to apply to the element. */
  mix?: MixInput<eventTarget>
  /**
   * Set the innerHTML of the element directly.
   * When provided, children are ignored.
   * Use with caution as this can expose XSS vulnerabilities if the content is not sanitized.
   */
  innerHTML?: string
}

/**
 * Value wrapper used by host prop types that participate in tracked updates.
 */
export type Trackable<T> = T

/**
 * Props accepted by SVG elements.
 */
export interface SVGProps<eventTarget extends EventTarget = SVGElement>
  extends HTMLProps<eventTarget> {
  /** The `accentHeight` SVG attribute. */
  accentHeight?: Trackable<number | string | undefined>
  /** The `accumulate` SVG attribute. */
  accumulate?: Trackable<'none' | 'sum' | undefined>
  /** The `additive` SVG attribute. */
  additive?: Trackable<'replace' | 'sum' | undefined>
  /** The `alignmentBaseline` SVG attribute. */
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
  /** The `alignment-baseline` SVG attribute. */
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
  /** The `allowReorder` SVG attribute. */
  allowReorder?: Trackable<'no' | 'yes' | undefined>
  /** The `allow-reorder` SVG attribute. */
  'allow-reorder'?: Trackable<'no' | 'yes' | undefined>
  /** The `alphabetic` SVG attribute. */
  alphabetic?: Trackable<number | string | undefined>
  /** The `amplitude` SVG attribute. */
  amplitude?: Trackable<number | string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/arabic-form */
  arabicForm?: Trackable<'initial' | 'medial' | 'terminal' | 'isolated' | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/arabic-form */
  'arabic-form'?: Trackable<'initial' | 'medial' | 'terminal' | 'isolated' | undefined>
  /** The `ascent` SVG attribute. */
  ascent?: Trackable<number | string | undefined>
  /** The `attributeName` SVG attribute. */
  attributeName?: Trackable<string | undefined>
  /** The `attributeType` SVG attribute. */
  attributeType?: Trackable<string | undefined>
  /** The `azimuth` SVG attribute. */
  azimuth?: Trackable<number | string | undefined>
  /** The `baseFrequency` SVG attribute. */
  baseFrequency?: Trackable<number | string | undefined>
  /** The `baselineShift` SVG attribute. */
  baselineShift?: Trackable<number | string | undefined>
  /** The `baseline-shift` SVG attribute. */
  'baseline-shift'?: Trackable<number | string | undefined>
  /** The `baseProfile` SVG attribute. */
  baseProfile?: Trackable<number | string | undefined>
  /** The `bbox` SVG attribute. */
  bbox?: Trackable<number | string | undefined>
  /** The `begin` SVG attribute. */
  begin?: Trackable<number | string | undefined>
  /** The `bias` SVG attribute. */
  bias?: Trackable<number | string | undefined>
  /** The `by` SVG attribute. */
  by?: Trackable<number | string | undefined>
  /** The `calcMode` SVG attribute. */
  calcMode?: Trackable<number | string | undefined>
  /** The `capHeight` SVG attribute. */
  capHeight?: Trackable<number | string | undefined>
  /** The `cap-height` SVG attribute. */
  'cap-height'?: Trackable<number | string | undefined>
  /** The `clip` SVG attribute. */
  clip?: Trackable<number | string | undefined>
  /** The `clipPath` SVG attribute. */
  clipPath?: Trackable<string | undefined>
  /** The `clip-path` SVG attribute. */
  'clip-path'?: Trackable<string | undefined>
  /** The `clipPathUnits` SVG attribute. */
  clipPathUnits?: Trackable<number | string | undefined>
  /** The `clipRule` SVG attribute. */
  clipRule?: Trackable<number | string | undefined>
  /** The `clip-rule` SVG attribute. */
  'clip-rule'?: Trackable<number | string | undefined>
  /** The `colorInterpolation` SVG attribute. */
  colorInterpolation?: Trackable<number | string | undefined>
  /** The `color-interpolation` SVG attribute. */
  'color-interpolation'?: Trackable<number | string | undefined>
  /** The `colorInterpolationFilters` SVG attribute. */
  colorInterpolationFilters?: Trackable<'auto' | 'sRGB' | 'linearRGB' | 'inherit' | undefined>
  /** The `color-interpolation-filters` SVG attribute. */
  'color-interpolation-filters'?: Trackable<'auto' | 'sRGB' | 'linearRGB' | 'inherit' | undefined>
  /** The `colorProfile` SVG attribute. */
  colorProfile?: Trackable<number | string | undefined>
  /** The `color-profile` SVG attribute. */
  'color-profile'?: Trackable<number | string | undefined>
  /** The `colorRendering` SVG attribute. */
  colorRendering?: Trackable<number | string | undefined>
  /** The `color-rendering` SVG attribute. */
  'color-rendering'?: Trackable<number | string | undefined>
  /** The `contentScriptType` SVG attribute. */
  contentScriptType?: Trackable<number | string | undefined>
  /** The `content-script-type` SVG attribute. */
  'content-script-type'?: Trackable<number | string | undefined>
  /** The `contentStyleType` SVG attribute. */
  contentStyleType?: Trackable<number | string | undefined>
  /** The `content-style-type` SVG attribute. */
  'content-style-type'?: Trackable<number | string | undefined>
  /** The `cursor` SVG attribute. */
  cursor?: Trackable<number | string | undefined>
  /** The `cx` SVG attribute. */
  cx?: Trackable<number | string | undefined>
  /** The `cy` SVG attribute. */
  cy?: Trackable<number | string | undefined>
  /** The `d` SVG attribute. */
  d?: Trackable<string | undefined>
  /** The `decelerate` SVG attribute. */
  decelerate?: Trackable<number | string | undefined>
  /** The `descent` SVG attribute. */
  descent?: Trackable<number | string | undefined>
  /** The `diffuseConstant` SVG attribute. */
  diffuseConstant?: Trackable<number | string | undefined>
  /** The `direction` SVG attribute. */
  direction?: Trackable<number | string | undefined>
  /** The `display` SVG attribute. */
  display?: Trackable<number | string | undefined>
  /** The `divisor` SVG attribute. */
  divisor?: Trackable<number | string | undefined>
  /** The `dominantBaseline` SVG attribute. */
  dominantBaseline?: Trackable<number | string | undefined>
  /** The `dominant-baseline` SVG attribute. */
  'dominant-baseline'?: Trackable<number | string | undefined>
  /** The `dur` SVG attribute. */
  dur?: Trackable<number | string | undefined>
  /** The `dx` SVG attribute. */
  dx?: Trackable<number | string | undefined>
  /** The `dy` SVG attribute. */
  dy?: Trackable<number | string | undefined>
  /** The `edgeMode` SVG attribute. */
  edgeMode?: Trackable<number | string | undefined>
  /** The `elevation` SVG attribute. */
  elevation?: Trackable<number | string | undefined>
  /** The `enableBackground` SVG attribute. */
  enableBackground?: Trackable<number | string | undefined>
  /** The `enable-background` SVG attribute. */
  'enable-background'?: Trackable<number | string | undefined>
  /** The `end` SVG attribute. */
  end?: Trackable<number | string | undefined>
  /** The `exponent` SVG attribute. */
  exponent?: Trackable<number | string | undefined>
  /** The `externalResourcesRequired` SVG attribute. */
  externalResourcesRequired?: Trackable<number | string | undefined>
  /** The `fill` SVG attribute. */
  fill?: Trackable<string | undefined>
  /** The `fillOpacity` SVG attribute. */
  fillOpacity?: Trackable<number | string | undefined>
  /** The `fill-opacity` SVG attribute. */
  'fill-opacity'?: Trackable<number | string | undefined>
  /** The `fillRule` SVG attribute. */
  fillRule?: Trackable<'nonzero' | 'evenodd' | 'inherit' | undefined>
  /** The `fill-rule` SVG attribute. */
  'fill-rule'?: Trackable<'nonzero' | 'evenodd' | 'inherit' | undefined>
  /** The `filter` SVG attribute. */
  filter?: Trackable<string | undefined>
  /** The `filterRes` SVG attribute. */
  filterRes?: Trackable<number | string | undefined>
  /** The `filterUnits` SVG attribute. */
  filterUnits?: Trackable<number | string | undefined>
  /** The `floodColor` SVG attribute. */
  floodColor?: Trackable<number | string | undefined>
  /** The `flood-color` SVG attribute. */
  'flood-color'?: Trackable<number | string | undefined>
  /** The `floodOpacity` SVG attribute. */
  floodOpacity?: Trackable<number | string | undefined>
  /** The `flood-opacity` SVG attribute. */
  'flood-opacity'?: Trackable<number | string | undefined>
  /** The `focusable` SVG attribute. */
  focusable?: Trackable<number | string | undefined>
  /** The `fontFamily` SVG attribute. */
  fontFamily?: Trackable<string | undefined>
  /** The `font-family` SVG attribute. */
  'font-family'?: Trackable<string | undefined>
  /** The `fontSize` SVG attribute. */
  fontSize?: Trackable<number | string | undefined>
  /** The `font-size` SVG attribute. */
  'font-size'?: Trackable<number | string | undefined>
  /** The `fontSizeAdjust` SVG attribute. */
  fontSizeAdjust?: Trackable<number | string | undefined>
  /** The `font-size-adjust` SVG attribute. */
  'font-size-adjust'?: Trackable<number | string | undefined>
  /** The `fontStretch` SVG attribute. */
  fontStretch?: Trackable<number | string | undefined>
  /** The `font-stretch` SVG attribute. */
  'font-stretch'?: Trackable<number | string | undefined>
  /** The `fontStyle` SVG attribute. */
  fontStyle?: Trackable<number | string | undefined>
  /** The `font-style` SVG attribute. */
  'font-style'?: Trackable<number | string | undefined>
  /** The `fontVariant` SVG attribute. */
  fontVariant?: Trackable<number | string | undefined>
  /** The `font-variant` SVG attribute. */
  'font-variant'?: Trackable<number | string | undefined>
  /** The `fontWeight` SVG attribute. */
  fontWeight?: Trackable<number | string | undefined>
  /** The `font-weight` SVG attribute. */
  'font-weight'?: Trackable<number | string | undefined>
  /** The `format` SVG attribute. */
  format?: Trackable<number | string | undefined>
  /** The `from` SVG attribute. */
  from?: Trackable<number | string | undefined>
  /** The `fx` SVG attribute. */
  fx?: Trackable<number | string | undefined>
  /** The `fy` SVG attribute. */
  fy?: Trackable<number | string | undefined>
  /** The `g1` SVG attribute. */
  g1?: Trackable<number | string | undefined>
  /** The `g2` SVG attribute. */
  g2?: Trackable<number | string | undefined>
  /** The `glyphName` SVG attribute. */
  glyphName?: Trackable<number | string | undefined>
  /** The `glyph-name` SVG attribute. */
  'glyph-name'?: Trackable<number | string | undefined>
  /** The `glyphOrientationHorizontal` SVG attribute. */
  glyphOrientationHorizontal?: Trackable<number | string | undefined>
  /** The `glyph-orientation-horizontal` SVG attribute. */
  'glyph-orientation-horizontal'?: Trackable<number | string | undefined>
  /** The `glyphOrientationVertical` SVG attribute. */
  glyphOrientationVertical?: Trackable<number | string | undefined>
  /** The `glyph-orientation-vertical` SVG attribute. */
  'glyph-orientation-vertical'?: Trackable<number | string | undefined>
  /** The `glyphRef` SVG attribute. */
  glyphRef?: Trackable<number | string | undefined>
  /** The `gradientTransform` SVG attribute. */
  gradientTransform?: Trackable<string | undefined>
  /** The `gradientUnits` SVG attribute. */
  gradientUnits?: Trackable<string | undefined>
  /** The `hanging` SVG attribute. */
  hanging?: Trackable<number | string | undefined>
  /** The `height` SVG attribute. */
  height?: Trackable<number | string | undefined>
  /** The `horizAdvX` SVG attribute. */
  horizAdvX?: Trackable<number | string | undefined>
  /** The `horiz-adv-x` SVG attribute. */
  'horiz-adv-x'?: Trackable<number | string | undefined>
  /** The `horizOriginX` SVG attribute. */
  horizOriginX?: Trackable<number | string | undefined>
  /** The `horiz-origin-x` SVG attribute. */
  'horiz-origin-x'?: Trackable<number | string | undefined>
  /** The `href` SVG attribute. */
  href?: Trackable<string | undefined>
  /** The `hreflang` SVG attribute. */
  hreflang?: Trackable<string | undefined>
  /** The `hrefLang` SVG attribute. */
  hrefLang?: Trackable<string | undefined>
  /** The `ideographic` SVG attribute. */
  ideographic?: Trackable<number | string | undefined>
  /** The `imageRendering` SVG attribute. */
  imageRendering?: Trackable<number | string | undefined>
  /** The `image-rendering` SVG attribute. */
  'image-rendering'?: Trackable<number | string | undefined>
  /** The `in2` SVG attribute. */
  in2?: Trackable<number | string | undefined>
  /** The `in` SVG attribute. */
  in?: Trackable<string | undefined>
  /** The `intercept` SVG attribute. */
  intercept?: Trackable<number | string | undefined>
  /** The `k1` SVG attribute. */
  k1?: Trackable<number | string | undefined>
  /** The `k2` SVG attribute. */
  k2?: Trackable<number | string | undefined>
  /** The `k3` SVG attribute. */
  k3?: Trackable<number | string | undefined>
  /** The `k4` SVG attribute. */
  k4?: Trackable<number | string | undefined>
  /** The `k` SVG attribute. */
  k?: Trackable<number | string | undefined>
  /** The `kernelMatrix` SVG attribute. */
  kernelMatrix?: Trackable<number | string | undefined>
  /** The `kernelUnitLength` SVG attribute. */
  kernelUnitLength?: Trackable<number | string | undefined>
  /** The `kerning` SVG attribute. */
  kerning?: Trackable<number | string | undefined>
  /** The `keyPoints` SVG attribute. */
  keyPoints?: Trackable<number | string | undefined>
  /** The `keySplines` SVG attribute. */
  keySplines?: Trackable<number | string | undefined>
  /** The `keyTimes` SVG attribute. */
  keyTimes?: Trackable<number | string | undefined>
  /** The `lengthAdjust` SVG attribute. */
  lengthAdjust?: Trackable<number | string | undefined>
  /** The `letterSpacing` SVG attribute. */
  letterSpacing?: Trackable<number | string | undefined>
  /** The `letter-spacing` SVG attribute. */
  'letter-spacing'?: Trackable<number | string | undefined>
  /** The `lightingColor` SVG attribute. */
  lightingColor?: Trackable<number | string | undefined>
  /** The `lighting-color` SVG attribute. */
  'lighting-color'?: Trackable<number | string | undefined>
  /** The `limitingConeAngle` SVG attribute. */
  limitingConeAngle?: Trackable<number | string | undefined>
  /** The `local` SVG attribute. */
  local?: Trackable<number | string | undefined>
  /** The `markerEnd` SVG attribute. */
  markerEnd?: Trackable<string | undefined>
  /** The `marker-end` SVG attribute. */
  'marker-end'?: Trackable<string | undefined>
  /** The `markerHeight` SVG attribute. */
  markerHeight?: Trackable<number | string | undefined>
  /** The `markerMid` SVG attribute. */
  markerMid?: Trackable<string | undefined>
  /** The `marker-mid` SVG attribute. */
  'marker-mid'?: Trackable<string | undefined>
  /** The `markerStart` SVG attribute. */
  markerStart?: Trackable<string | undefined>
  /** The `marker-start` SVG attribute. */
  'marker-start'?: Trackable<string | undefined>
  /** The `markerUnits` SVG attribute. */
  markerUnits?: Trackable<number | string | undefined>
  /** The `markerWidth` SVG attribute. */
  markerWidth?: Trackable<number | string | undefined>
  /** The `mask` SVG attribute. */
  mask?: Trackable<string | undefined>
  /** The `maskContentUnits` SVG attribute. */
  maskContentUnits?: Trackable<number | string | undefined>
  /** The `maskUnits` SVG attribute. */
  maskUnits?: Trackable<number | string | undefined>
  /** The `mathematical` SVG attribute. */
  mathematical?: Trackable<number | string | undefined>
  /** The `mode` SVG attribute. */
  mode?: Trackable<number | string | undefined>
  /** The `numOctaves` SVG attribute. */
  numOctaves?: Trackable<number | string | undefined>
  /** The `offset` SVG attribute. */
  offset?: Trackable<number | string | undefined>
  /** The `opacity` SVG attribute. */
  opacity?: Trackable<number | string | undefined>
  /** The `operator` SVG attribute. */
  operator?: Trackable<number | string | undefined>
  /** The `order` SVG attribute. */
  order?: Trackable<number | string | undefined>
  /** The `orient` SVG attribute. */
  orient?: Trackable<number | string | undefined>
  /** The `orientation` SVG attribute. */
  orientation?: Trackable<number | string | undefined>
  /** The `origin` SVG attribute. */
  origin?: Trackable<number | string | undefined>
  /** The `overflow` SVG attribute. */
  overflow?: Trackable<number | string | undefined>
  /** The `overlinePosition` SVG attribute. */
  overlinePosition?: Trackable<number | string | undefined>
  /** The `overline-position` SVG attribute. */
  'overline-position'?: Trackable<number | string | undefined>
  /** The `overlineThickness` SVG attribute. */
  overlineThickness?: Trackable<number | string | undefined>
  /** The `overline-thickness` SVG attribute. */
  'overline-thickness'?: Trackable<number | string | undefined>
  /** The `paintOrder` SVG attribute. */
  paintOrder?: Trackable<number | string | undefined>
  /** The `paint-order` SVG attribute. */
  'paint-order'?: Trackable<number | string | undefined>
  /** The `panose1` SVG attribute. */
  panose1?: Trackable<number | string | undefined>
  /** The `panose-1` SVG attribute. */
  'panose-1'?: Trackable<number | string | undefined>
  /** The `pathLength` SVG attribute. */
  pathLength?: Trackable<number | string | undefined>
  /** The `patternContentUnits` SVG attribute. */
  patternContentUnits?: Trackable<string | undefined>
  /** The `patternTransform` SVG attribute. */
  patternTransform?: Trackable<number | string | undefined>
  /** The `patternUnits` SVG attribute. */
  patternUnits?: Trackable<string | undefined>
  /** The `pointerEvents` SVG attribute. */
  pointerEvents?: Trackable<number | string | undefined>
  /** The `pointer-events` SVG attribute. */
  'pointer-events'?: Trackable<number | string | undefined>
  /** The `points` SVG attribute. */
  points?: Trackable<string | undefined>
  /** The `pointsAtX` SVG attribute. */
  pointsAtX?: Trackable<number | string | undefined>
  /** The `pointsAtY` SVG attribute. */
  pointsAtY?: Trackable<number | string | undefined>
  /** The `pointsAtZ` SVG attribute. */
  pointsAtZ?: Trackable<number | string | undefined>
  /** The `preserveAlpha` SVG attribute. */
  preserveAlpha?: Trackable<number | string | undefined>
  /** The `preserveAspectRatio` SVG attribute. */
  preserveAspectRatio?: Trackable<string | undefined>
  /** The `primitiveUnits` SVG attribute. */
  primitiveUnits?: Trackable<number | string | undefined>
  /** The `r` SVG attribute. */
  r?: Trackable<number | string | undefined>
  /** The `radius` SVG attribute. */
  radius?: Trackable<number | string | undefined>
  /** The `refX` SVG attribute. */
  refX?: Trackable<number | string | undefined>
  /** The `refY` SVG attribute. */
  refY?: Trackable<number | string | undefined>
  /** The `renderingIntent` SVG attribute. */
  renderingIntent?: Trackable<number | string | undefined>
  /** The `rendering-intent` SVG attribute. */
  'rendering-intent'?: Trackable<number | string | undefined>
  /** The `repeatCount` SVG attribute. */
  repeatCount?: Trackable<number | string | undefined>
  /** The `repeat-count` SVG attribute. */
  'repeat-count'?: Trackable<number | string | undefined>
  /** The `repeatDur` SVG attribute. */
  repeatDur?: Trackable<number | string | undefined>
  /** The `repeat-dur` SVG attribute. */
  'repeat-dur'?: Trackable<number | string | undefined>
  /** The `requiredExtensions` SVG attribute. */
  requiredExtensions?: Trackable<number | string | undefined>
  /** The `requiredFeatures` SVG attribute. */
  requiredFeatures?: Trackable<number | string | undefined>
  /** The `restart` SVG attribute. */
  restart?: Trackable<number | string | undefined>
  /** The `result` SVG attribute. */
  result?: Trackable<string | undefined>
  /** The `rotate` SVG attribute. */
  rotate?: Trackable<number | string | undefined>
  /** The `rx` SVG attribute. */
  rx?: Trackable<number | string | undefined>
  /** The `ry` SVG attribute. */
  ry?: Trackable<number | string | undefined>
  /** The `scale` SVG attribute. */
  scale?: Trackable<number | string | undefined>
  /** The `seed` SVG attribute. */
  seed?: Trackable<number | string | undefined>
  /** The `shapeRendering` SVG attribute. */
  shapeRendering?: Trackable<number | string | undefined>
  /** The `shape-rendering` SVG attribute. */
  'shape-rendering'?: Trackable<number | string | undefined>
  /** The `slope` SVG attribute. */
  slope?: Trackable<number | string | undefined>
  /** The `spacing` SVG attribute. */
  spacing?: Trackable<number | string | undefined>
  /** The `specularConstant` SVG attribute. */
  specularConstant?: Trackable<number | string | undefined>
  /** The `specularExponent` SVG attribute. */
  specularExponent?: Trackable<number | string | undefined>
  /** The `speed` SVG attribute. */
  speed?: Trackable<number | string | undefined>
  /** The `spreadMethod` SVG attribute. */
  spreadMethod?: Trackable<string | undefined>
  /** The `startOffset` SVG attribute. */
  startOffset?: Trackable<number | string | undefined>
  /** The `stdDeviation` SVG attribute. */
  stdDeviation?: Trackable<number | string | undefined>
  /** The `stemh` SVG attribute. */
  stemh?: Trackable<number | string | undefined>
  /** The `stemv` SVG attribute. */
  stemv?: Trackable<number | string | undefined>
  /** The `stitchTiles` SVG attribute. */
  stitchTiles?: Trackable<number | string | undefined>
  /** The `stopColor` SVG attribute. */
  stopColor?: Trackable<string | undefined>
  /** The `stop-color` SVG attribute. */
  'stop-color'?: Trackable<string | undefined>
  /** The `stopOpacity` SVG attribute. */
  stopOpacity?: Trackable<number | string | undefined>
  /** The `stop-opacity` SVG attribute. */
  'stop-opacity'?: Trackable<number | string | undefined>
  /** The `strikethroughPosition` SVG attribute. */
  strikethroughPosition?: Trackable<number | string | undefined>
  /** The `strikethrough-position` SVG attribute. */
  'strikethrough-position'?: Trackable<number | string | undefined>
  /** The `strikethroughThickness` SVG attribute. */
  strikethroughThickness?: Trackable<number | string | undefined>
  /** The `strikethrough-thickness` SVG attribute. */
  'strikethrough-thickness'?: Trackable<number | string | undefined>
  /** The `string` SVG attribute. */
  string?: Trackable<number | string | undefined>
  /** The `stroke` SVG attribute. */
  stroke?: Trackable<string | undefined>
  /** The `strokeDasharray` SVG attribute. */
  strokeDasharray?: Trackable<string | number | undefined>
  /** The `stroke-dasharray` SVG attribute. */
  'stroke-dasharray'?: Trackable<string | number | undefined>
  /** The `strokeDashoffset` SVG attribute. */
  strokeDashoffset?: Trackable<string | number | undefined>
  /** The `stroke-dashoffset` SVG attribute. */
  'stroke-dashoffset'?: Trackable<string | number | undefined>
  /** The `strokeLinecap` SVG attribute. */
  strokeLinecap?: Trackable<'butt' | 'round' | 'square' | 'inherit' | undefined>
  /** The `stroke-linecap` SVG attribute. */
  'stroke-linecap'?: Trackable<'butt' | 'round' | 'square' | 'inherit' | undefined>
  /** The `strokeLinejoin` SVG attribute. */
  strokeLinejoin?: Trackable<'miter' | 'round' | 'bevel' | 'inherit' | undefined>
  /** The `stroke-linejoin` SVG attribute. */
  'stroke-linejoin'?: Trackable<'miter' | 'round' | 'bevel' | 'inherit' | undefined>
  /** The `strokeMiterlimit` SVG attribute. */
  strokeMiterlimit?: Trackable<string | number | undefined>
  /** The `stroke-miterlimit` SVG attribute. */
  'stroke-miterlimit'?: Trackable<string | number | undefined>
  /** The `strokeOpacity` SVG attribute. */
  strokeOpacity?: Trackable<number | string | undefined>
  /** The `stroke-opacity` SVG attribute. */
  'stroke-opacity'?: Trackable<number | string | undefined>
  /** The `strokeWidth` SVG attribute. */
  strokeWidth?: Trackable<number | string | undefined>
  /** The `stroke-width` SVG attribute. */
  'stroke-width'?: Trackable<number | string | undefined>
  /** The `surfaceScale` SVG attribute. */
  surfaceScale?: Trackable<number | string | undefined>
  /** The `systemLanguage` SVG attribute. */
  systemLanguage?: Trackable<number | string | undefined>
  /** The `tableValues` SVG attribute. */
  tableValues?: Trackable<number | string | undefined>
  /** The `targetX` SVG attribute. */
  targetX?: Trackable<number | string | undefined>
  /** The `targetY` SVG attribute. */
  targetY?: Trackable<number | string | undefined>
  /** The `textAnchor` SVG attribute. */
  textAnchor?: Trackable<string | undefined>
  /** The `text-anchor` SVG attribute. */
  'text-anchor'?: Trackable<string | undefined>
  /** The `textDecoration` SVG attribute. */
  textDecoration?: Trackable<number | string | undefined>
  /** The `text-decoration` SVG attribute. */
  'text-decoration'?: Trackable<number | string | undefined>
  /** The `textLength` SVG attribute. */
  textLength?: Trackable<number | string | undefined>
  /** The `textRendering` SVG attribute. */
  textRendering?: Trackable<number | string | undefined>
  /** The `text-rendering` SVG attribute. */
  'text-rendering'?: Trackable<number | string | undefined>
  /** The `to` SVG attribute. */
  to?: Trackable<number | string | undefined>
  /** The `transform` SVG attribute. */
  transform?: Trackable<string | undefined>
  /** The `transformOrigin` SVG attribute. */
  transformOrigin?: Trackable<string | undefined>
  /** The `transform-origin` SVG attribute. */
  'transform-origin'?: Trackable<string | undefined>
  /** The `type` SVG attribute. */
  type?: Trackable<string | undefined>
  /** The `u1` SVG attribute. */
  u1?: Trackable<number | string | undefined>
  /** The `u2` SVG attribute. */
  u2?: Trackable<number | string | undefined>
  /** The `underlinePosition` SVG attribute. */
  underlinePosition?: Trackable<number | string | undefined>
  /** The `underline-position` SVG attribute. */
  'underline-position'?: Trackable<number | string | undefined>
  /** The `underlineThickness` SVG attribute. */
  underlineThickness?: Trackable<number | string | undefined>
  /** The `underline-thickness` SVG attribute. */
  'underline-thickness'?: Trackable<number | string | undefined>
  /** The `unicode` SVG attribute. */
  unicode?: Trackable<number | string | undefined>
  /** The `unicodeBidi` SVG attribute. */
  unicodeBidi?: Trackable<number | string | undefined>
  /** The `unicode-bidi` SVG attribute. */
  'unicode-bidi'?: Trackable<number | string | undefined>
  /** The `unicodeRange` SVG attribute. */
  unicodeRange?: Trackable<number | string | undefined>
  /** The `unicode-range` SVG attribute. */
  'unicode-range'?: Trackable<number | string | undefined>
  /** The `unitsPerEm` SVG attribute. */
  unitsPerEm?: Trackable<number | string | undefined>
  /** The `units-per-em` SVG attribute. */
  'units-per-em'?: Trackable<number | string | undefined>
  /** The `vAlphabetic` SVG attribute. */
  vAlphabetic?: Trackable<number | string | undefined>
  /** The `v-alphabetic` SVG attribute. */
  'v-alphabetic'?: Trackable<number | string | undefined>
  /** The `values` SVG attribute. */
  values?: Trackable<string | undefined>
  /** The `vectorEffect` SVG attribute. */
  vectorEffect?: Trackable<number | string | undefined>
  /** The `vector-effect` SVG attribute. */
  'vector-effect'?: Trackable<number | string | undefined>
  /** The `version` SVG attribute. */
  version?: Trackable<string | undefined>
  /** The `vertAdvY` SVG attribute. */
  vertAdvY?: Trackable<number | string | undefined>
  /** The `vert-adv-y` SVG attribute. */
  'vert-adv-y'?: Trackable<number | string | undefined>
  /** The `vertOriginX` SVG attribute. */
  vertOriginX?: Trackable<number | string | undefined>
  /** The `vert-origin-x` SVG attribute. */
  'vert-origin-x'?: Trackable<number | string | undefined>
  /** The `vertOriginY` SVG attribute. */
  vertOriginY?: Trackable<number | string | undefined>
  /** The `vert-origin-y` SVG attribute. */
  'vert-origin-y'?: Trackable<number | string | undefined>
  /** The `vHanging` SVG attribute. */
  vHanging?: Trackable<number | string | undefined>
  /** The `v-hanging` SVG attribute. */
  'v-hanging'?: Trackable<number | string | undefined>
  /** The `vIdeographic` SVG attribute. */
  vIdeographic?: Trackable<number | string | undefined>
  /** The `v-ideographic` SVG attribute. */
  'v-ideographic'?: Trackable<number | string | undefined>
  /** The `viewBox` SVG attribute. */
  viewBox?: Trackable<string | undefined>
  /** The `viewTarget` SVG attribute. */
  viewTarget?: Trackable<number | string | undefined>
  /** The `visibility` SVG attribute. */
  visibility?: Trackable<number | string | undefined>
  /** The `vMathematical` SVG attribute. */
  vMathematical?: Trackable<number | string | undefined>
  /** The `v-mathematical` SVG attribute. */
  'v-mathematical'?: Trackable<number | string | undefined>
  /** The `width` SVG attribute. */
  width?: Trackable<number | string | undefined>
  /** The `wordSpacing` SVG attribute. */
  wordSpacing?: Trackable<number | string | undefined>
  /** The `word-spacing` SVG attribute. */
  'word-spacing'?: Trackable<number | string | undefined>
  /** The `writingMode` SVG attribute. */
  writingMode?: Trackable<number | string | undefined>
  /** The `writing-mode` SVG attribute. */
  'writing-mode'?: Trackable<number | string | undefined>
  /** The `x1` SVG attribute. */
  x1?: Trackable<number | string | undefined>
  /** The `x2` SVG attribute. */
  x2?: Trackable<number | string | undefined>
  /** The `x` SVG attribute. */
  x?: Trackable<number | string | undefined>
  /** The `xChannelSelector` SVG attribute. */
  xChannelSelector?: Trackable<string | undefined>
  /** The `xHeight` SVG attribute. */
  xHeight?: Trackable<number | string | undefined>
  /** The `x-height` SVG attribute. */
  'x-height'?: Trackable<number | string | undefined>
  /** The `xlinkActuate` SVG attribute. */
  xlinkActuate?: Trackable<string | undefined>
  /** The `xlink:actuate` SVG attribute. */
  'xlink:actuate'?: Trackable<SVGProps['xlinkActuate']>
  /** The `xlinkArcrole` SVG attribute. */
  xlinkArcrole?: Trackable<string | undefined>
  /** The `xlink:arcrole` SVG attribute. */
  'xlink:arcrole'?: Trackable<string | undefined>
  /** The `xlinkHref` SVG attribute. */
  xlinkHref?: Trackable<string | undefined>
  /** The `xlink:href` SVG attribute. */
  'xlink:href'?: Trackable<string | undefined>
  /** The `xlinkRole` SVG attribute. */
  xlinkRole?: Trackable<string | undefined>
  /** The `xlink:role` SVG attribute. */
  'xlink:role'?: Trackable<string | undefined>
  /** The `xlinkShow` SVG attribute. */
  xlinkShow?: Trackable<string | undefined>
  /** The `xlink:show` SVG attribute. */
  'xlink:show'?: Trackable<string | undefined>
  /** The `xlinkTitle` SVG attribute. */
  xlinkTitle?: Trackable<string | undefined>
  /** The `xlink:title` SVG attribute. */
  'xlink:title'?: Trackable<string | undefined>
  /** The `xlinkType` SVG attribute. */
  xlinkType?: Trackable<string | undefined>
  /** The `xlink:type` SVG attribute. */
  'xlink:type'?: Trackable<string | undefined>
  /** The `xmlBase` SVG attribute. */
  xmlBase?: Trackable<string | undefined>
  /** The `xml:base` SVG attribute. */
  'xml:base'?: Trackable<string | undefined>
  /** The `xmlLang` SVG attribute. */
  xmlLang?: Trackable<string | undefined>
  /** The `xml:lang` SVG attribute. */
  'xml:lang'?: Trackable<string | undefined>
  /** The `xmlns` SVG attribute. */
  xmlns?: Trackable<string | undefined>
  /** The `xmlnsXlink` SVG attribute. */
  xmlnsXlink?: Trackable<string | undefined>
  /** The `xmlSpace` SVG attribute. */
  xmlSpace?: Trackable<string | undefined>
  /** The `xml:space` SVG attribute. */
  'xml:space'?: Trackable<string | undefined>
  /** The `y1` SVG attribute. */
  y1?: Trackable<number | string | undefined>
  /** The `y2` SVG attribute. */
  y2?: Trackable<number | string | undefined>
  /** The `y` SVG attribute. */
  y?: Trackable<number | string | undefined>
  /** The `yChannelSelector` SVG attribute. */
  yChannelSelector?: Trackable<string | undefined>
  /** The `z` SVG attribute. */
  z?: Trackable<number | string | undefined>
  /** The `zoomAndPan` SVG attribute. */
  zoomAndPan?: Trackable<string | undefined>
}

/**
 * Minimal props for SVG path data.
 */
export interface PathProps {
  /** The SVG path data string. */
  d: string
}

// All the WAI-ARIA 1.1 attributes from https://www.w3.org/TR/wai-aria-1.1/
/**
 * WAI-ARIA attributes accepted by host elements.
 */
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

/**
 * Comprehensive HTML attributes shared by specialized element prop interfaces.
 */
export interface AllHTMLProps<eventTarget extends EventTarget = EventTarget>
  extends HostProps<eventTarget>,
    AriaProps {
  // Standard HTML Attributes
  /** The `accept` HTML attribute. */
  accept?: Trackable<string | undefined>
  /** The `acceptCharset` HTML attribute. */
  acceptCharset?: Trackable<string | undefined>
  /** The `accept-charset` HTML attribute. */
  'accept-charset'?: Trackable<AllHTMLProps['acceptCharset']>
  /** The `accessKey` HTML attribute. */
  accessKey?: Trackable<string | undefined>
  /** The `accesskey` HTML attribute. */
  accesskey?: Trackable<AllHTMLProps['accessKey']>
  /** The `action` HTML attribute. */
  action?: Trackable<string | undefined>
  /** The `allow` HTML attribute. */
  allow?: Trackable<string | undefined>
  /** The `allowFullScreen` HTML attribute. */
  allowFullScreen?: Trackable<boolean | undefined>
  /** The `allowTransparency` HTML attribute. */
  allowTransparency?: Trackable<boolean | undefined>
  /** The `alt` HTML attribute. */
  alt?: Trackable<string | undefined>
  /** The `as` HTML attribute. */
  as?: Trackable<string | undefined>
  /** The `async` HTML attribute. */
  async?: Trackable<boolean | undefined>
  /** The `autocomplete` HTML attribute. */
  autocomplete?: Trackable<string | undefined>
  /** The `autoComplete` HTML attribute. */
  autoComplete?: Trackable<string | undefined>
  /** The `autocorrect` HTML attribute. */
  autocorrect?: Trackable<string | undefined>
  /** The `autoCorrect` HTML attribute. */
  autoCorrect?: Trackable<string | undefined>
  /** The `autofocus` HTML attribute. */
  autofocus?: Trackable<boolean | undefined>
  /** The `autoFocus` HTML attribute. */
  autoFocus?: Trackable<boolean | undefined>
  /** The `autoPlay` HTML attribute. */
  autoPlay?: Trackable<boolean | undefined>
  /** The `autoplay` HTML attribute. */
  autoplay?: Trackable<boolean | undefined>
  /** The `capture` HTML attribute. */
  capture?: Trackable<boolean | string | undefined>
  /** The `cellPadding` HTML attribute. */
  cellPadding?: Trackable<number | string | undefined>
  /** The `cellSpacing` HTML attribute. */
  cellSpacing?: Trackable<number | string | undefined>
  /** The `charSet` HTML attribute. */
  charSet?: Trackable<string | undefined>
  /** The `charset` HTML attribute. */
  charset?: Trackable<string | undefined>
  /** The `challenge` HTML attribute. */
  challenge?: Trackable<string | undefined>
  /** The `checked` HTML attribute. */
  checked?: Trackable<boolean | undefined>
  /** The `cite` HTML attribute. */
  cite?: Trackable<string | undefined>
  /** The `class` HTML attribute. */
  class?: Trackable<string | undefined>
  /** The `className` HTML attribute. */
  className?: Trackable<string | undefined>
  /** The `cols` HTML attribute. */
  cols?: Trackable<number | undefined>
  /** The `colSpan` HTML attribute. */
  colSpan?: Trackable<number | undefined>
  /** The `colspan` HTML attribute. */
  colspan?: Trackable<number | undefined>
  /** The `content` HTML attribute. */
  content?: Trackable<string | undefined>
  /** The `contentEditable` HTML attribute. */
  contentEditable?: Trackable<Booleanish | '' | 'plaintext-only' | 'inherit' | undefined>
  /** The `contenteditable` HTML attribute. */
  contenteditable?: Trackable<AllHTMLProps['contentEditable']>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contextmenu */
  contextMenu?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/contextmenu */
  contextmenu?: Trackable<string | undefined>
  /** The `controls` HTML attribute. */
  controls?: Trackable<boolean | undefined>
  /** The `controlslist` HTML attribute. */
  controlslist?: Trackable<string | undefined>
  /** The `controlsList` HTML attribute. */
  controlsList?: Trackable<string | undefined>
  /** The `coords` HTML attribute. */
  coords?: Trackable<string | undefined>
  /** The `crossOrigin` HTML attribute. */
  crossOrigin?: Trackable<string | undefined>
  /** The `crossorigin` HTML attribute. */
  crossorigin?: Trackable<string | undefined>
  /** The `currentTime` HTML attribute. */
  currentTime?: Trackable<number | undefined>
  /** The `data` HTML attribute. */
  data?: Trackable<string | undefined>
  /** The `dateTime` HTML attribute. */
  dateTime?: Trackable<string | undefined>
  /** The `datetime` HTML attribute. */
  datetime?: Trackable<string | undefined>
  /** The `default` HTML attribute. */
  default?: Trackable<boolean | undefined>
  /** The `defaultChecked` HTML attribute. */
  defaultChecked?: Trackable<boolean | undefined>
  /** The `defaultMuted` HTML attribute. */
  defaultMuted?: Trackable<boolean | undefined>
  /** The `defaultPlaybackRate` HTML attribute. */
  defaultPlaybackRate?: Trackable<number | undefined>
  /** The `defaultValue` HTML attribute. */
  defaultValue?: Trackable<string | undefined>
  /** The `defer` HTML attribute. */
  defer?: Trackable<boolean | undefined>
  /** The `dir` HTML attribute. */
  dir?: Trackable<'auto' | 'rtl' | 'ltr' | undefined>
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `disableremoteplayback` HTML attribute. */
  disableremoteplayback?: Trackable<boolean | undefined>
  /** The `disableRemotePlayback` HTML attribute. */
  disableRemotePlayback?: Trackable<boolean | undefined>
  /** The `download` HTML attribute. */
  download?: Trackable<any | undefined>
  /** The `decoding` HTML attribute. */
  decoding?: Trackable<'sync' | 'async' | 'auto' | undefined>
  /** The `draggable` HTML attribute. */
  draggable?: Trackable<boolean | undefined>
  /** The `encType` HTML attribute. */
  encType?: Trackable<string | undefined>
  /** The `enctype` HTML attribute. */
  enctype?: Trackable<string | undefined>
  /** The `enterkeyhint` HTML attribute. */
  enterkeyhint?: Trackable<
    'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  >
  /** The `elementTiming` HTML attribute. */
  elementTiming?: Trackable<string | undefined>
  /** The `elementtiming` HTML attribute. */
  elementtiming?: Trackable<AllHTMLProps['elementTiming']>
  /** The `exportparts` HTML attribute. */
  exportparts?: Trackable<string | undefined>
  /** The `for` HTML attribute. */
  for?: Trackable<string | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `formAction` HTML attribute. */
  formAction?: Trackable<string | undefined>
  /** The `formaction` HTML attribute. */
  formaction?: Trackable<string | undefined>
  /** The `formEncType` HTML attribute. */
  formEncType?: Trackable<string | undefined>
  /** The `formenctype` HTML attribute. */
  formenctype?: Trackable<string | undefined>
  /** The `formMethod` HTML attribute. */
  formMethod?: Trackable<string | undefined>
  /** The `formmethod` HTML attribute. */
  formmethod?: Trackable<string | undefined>
  /** The `formNoValidate` HTML attribute. */
  formNoValidate?: Trackable<boolean | undefined>
  /** The `formnovalidate` HTML attribute. */
  formnovalidate?: Trackable<boolean | undefined>
  /** The `formTarget` HTML attribute. */
  formTarget?: Trackable<string | undefined>
  /** The `formtarget` HTML attribute. */
  formtarget?: Trackable<string | undefined>
  /** The `frameBorder` HTML attribute. */
  frameBorder?: Trackable<number | string | undefined>
  /** The `frameborder` HTML attribute. */
  frameborder?: Trackable<number | string | undefined>
  /** The `headers` HTML attribute. */
  headers?: Trackable<string | undefined>
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `hidden` HTML attribute. */
  hidden?: Trackable<boolean | 'hidden' | 'until-found' | undefined>
  /** The `high` HTML attribute. */
  high?: Trackable<number | undefined>
  /** The `href` HTML attribute. */
  href?: Trackable<string | undefined>
  /** The `hrefLang` HTML attribute. */
  hrefLang?: Trackable<string | undefined>
  /** The `hreflang` HTML attribute. */
  hreflang?: Trackable<string | undefined>
  /** The `htmlFor` HTML attribute. */
  htmlFor?: Trackable<string | undefined>
  /** The `httpEquiv` HTML attribute. */
  httpEquiv?: Trackable<string | undefined>
  /** The `http-equiv` HTML attribute. */
  'http-equiv'?: Trackable<string | undefined>
  /** The `icon` HTML attribute. */
  icon?: Trackable<string | undefined>
  /** The `id` HTML attribute. */
  id?: Trackable<string | undefined>
  /** The `indeterminate` HTML attribute. */
  indeterminate?: Trackable<boolean | undefined>
  /** The `inert` HTML attribute. */
  inert?: Trackable<boolean | undefined>
  /** The `inputMode` HTML attribute. */
  inputMode?: Trackable<string | undefined>
  /** The `inputmode` HTML attribute. */
  inputmode?: Trackable<string | undefined>
  /** The `integrity` HTML attribute. */
  integrity?: Trackable<string | undefined>
  /** The `is` HTML attribute. */
  is?: Trackable<string | undefined>
  /** The `keyParams` HTML attribute. */
  keyParams?: Trackable<string | undefined>
  /** The `keyType` HTML attribute. */
  keyType?: Trackable<string | undefined>
  /** The `kind` HTML attribute. */
  kind?: Trackable<string | undefined>
  /** The `label` HTML attribute. */
  label?: Trackable<string | undefined>
  /** The `lang` HTML attribute. */
  lang?: Trackable<string | undefined>
  /** The `list` HTML attribute. */
  list?: Trackable<string | undefined>
  /** The `loading` HTML attribute. */
  loading?: Trackable<'eager' | 'lazy' | undefined>
  /** The `loop` HTML attribute. */
  loop?: Trackable<boolean | undefined>
  /** The `low` HTML attribute. */
  low?: Trackable<number | undefined>
  /** The `manifest` HTML attribute. */
  manifest?: Trackable<string | undefined>
  /** The `marginHeight` HTML attribute. */
  marginHeight?: Trackable<number | undefined>
  /** The `marginWidth` HTML attribute. */
  marginWidth?: Trackable<number | undefined>
  /** The `max` HTML attribute. */
  max?: Trackable<number | string | undefined>
  /** The `maxLength` HTML attribute. */
  maxLength?: Trackable<number | undefined>
  /** The `maxlength` HTML attribute. */
  maxlength?: Trackable<number | undefined>
  /** The `media` HTML attribute. */
  media?: Trackable<string | undefined>
  /** The `mediaGroup` HTML attribute. */
  mediaGroup?: Trackable<string | undefined>
  /** The `method` HTML attribute. */
  method?: Trackable<string | undefined>
  /** The `min` HTML attribute. */
  min?: Trackable<number | string | undefined>
  /** The `minLength` HTML attribute. */
  minLength?: Trackable<number | undefined>
  /** The `minlength` HTML attribute. */
  minlength?: Trackable<number | undefined>
  /** The `multiple` HTML attribute. */
  multiple?: Trackable<boolean | undefined>
  /** The `muted` HTML attribute. */
  muted?: Trackable<boolean | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `nomodule` HTML attribute. */
  nomodule?: Trackable<boolean | undefined>
  /** The `nonce` HTML attribute. */
  nonce?: Trackable<string | undefined>
  /** The `noValidate` HTML attribute. */
  noValidate?: Trackable<boolean | undefined>
  /** The `novalidate` HTML attribute. */
  novalidate?: Trackable<boolean | undefined>
  /** The `open` HTML attribute. */
  open?: Trackable<boolean | undefined>
  /** The `optimum` HTML attribute. */
  optimum?: Trackable<number | undefined>
  /** The `part` HTML attribute. */
  part?: Trackable<string | undefined>
  /** The `pattern` HTML attribute. */
  pattern?: Trackable<string | undefined>
  /** The `ping` HTML attribute. */
  ping?: Trackable<string | undefined>
  /** The `placeholder` HTML attribute. */
  placeholder?: Trackable<string | undefined>
  /** The `playsInline` HTML attribute. */
  playsInline?: Trackable<boolean | undefined>
  /** The `playsinline` HTML attribute. */
  playsinline?: Trackable<boolean | undefined>
  /** The `playbackRate` HTML attribute. */
  playbackRate?: Trackable<number | undefined>
  /** The `popover` HTML attribute. */
  popover?: Trackable<'auto' | 'hint' | 'manual' | boolean | undefined>
  /** The `popovertarget` HTML attribute. */
  popovertarget?: Trackable<string | undefined>
  /** The `popoverTarget` HTML attribute. */
  popoverTarget?: Trackable<string | undefined>
  /** The `popovertargetaction` HTML attribute. */
  popovertargetaction?: Trackable<'hide' | 'show' | 'toggle' | undefined>
  /** The `popoverTargetAction` HTML attribute. */
  popoverTargetAction?: Trackable<'hide' | 'show' | 'toggle' | undefined>
  /** The `poster` HTML attribute. */
  poster?: Trackable<string | undefined>
  /** The `preload` HTML attribute. */
  preload?: Trackable<'auto' | 'metadata' | 'none' | undefined>
  /** The `preservesPitch` HTML attribute. */
  preservesPitch?: Trackable<boolean | undefined>
  /** The `radioGroup` HTML attribute. */
  radioGroup?: Trackable<string | undefined>
  /** The `readonly` HTML attribute. */
  readonly?: Trackable<boolean | undefined>
  /** The `readOnly` HTML attribute. */
  readOnly?: Trackable<boolean | undefined>
  /** The `referrerpolicy` HTML attribute. */
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
  /** The `rel` HTML attribute. */
  rel?: Trackable<string | undefined>
  /** The `required` HTML attribute. */
  required?: Trackable<boolean | undefined>
  /** The `reversed` HTML attribute. */
  reversed?: Trackable<boolean | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<AriaRole | undefined>
  /** The `rows` HTML attribute. */
  rows?: Trackable<number | undefined>
  /** The `rowSpan` HTML attribute. */
  rowSpan?: Trackable<number | undefined>
  /** The `rowspan` HTML attribute. */
  rowspan?: Trackable<number | undefined>
  /** The `sandbox` HTML attribute. */
  sandbox?: Trackable<string | undefined>
  /** The `scope` HTML attribute. */
  scope?: Trackable<string | undefined>
  /** The `scoped` HTML attribute. */
  scoped?: Trackable<boolean | undefined>
  /** The `scrolling` HTML attribute. */
  scrolling?: Trackable<string | undefined>
  /** The `seamless` HTML attribute. */
  seamless?: Trackable<boolean | undefined>
  /** The `selected` HTML attribute. */
  selected?: Trackable<boolean | undefined>
  /** The `shape` HTML attribute. */
  shape?: Trackable<string | undefined>
  /** The `size` HTML attribute. */
  size?: Trackable<number | undefined>
  /** The `sizes` HTML attribute. */
  sizes?: Trackable<string | undefined>
  /** The `slot` HTML attribute. */
  slot?: Trackable<string | undefined>
  /** The `span` HTML attribute. */
  span?: Trackable<number | undefined>
  /** The `spellcheck` HTML attribute. */
  spellcheck?: Trackable<boolean | undefined>
  /** The `src` HTML attribute. */
  src?: Trackable<string | undefined>
  /** The `srcDoc` HTML attribute. */
  srcDoc?: Trackable<string | undefined>
  /** The `srcdoc` HTML attribute. */
  srcdoc?: Trackable<string | undefined>
  /** The `srcLang` HTML attribute. */
  srcLang?: Trackable<string | undefined>
  /** The `srclang` HTML attribute. */
  srclang?: Trackable<string | undefined>
  /** The `srcSet` HTML attribute. */
  srcSet?: Trackable<string | undefined>
  /** The `srcset` HTML attribute. */
  srcset?: Trackable<string | undefined>
  /** The `srcObject` HTML attribute. */
  srcObject?: Trackable<MediaStream | MediaSource | Blob | File | null>
  /** The `start` HTML attribute. */
  start?: Trackable<number | undefined>
  /** The `step` HTML attribute. */
  step?: Trackable<number | string | undefined>
  /** The `style` HTML attribute. */
  style?: Trackable<string | StyleProps | undefined>
  /** The `summary` HTML attribute. */
  summary?: Trackable<string | undefined>
  /** The `tabIndex` HTML attribute. */
  tabIndex?: Trackable<number | undefined>
  /** The `tabindex` HTML attribute. */
  tabindex?: Trackable<number | undefined>
  /** The `target` HTML attribute. */
  target?: Trackable<string | undefined>
  /** The `title` HTML attribute. */
  title?: Trackable<string | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
  /** The `useMap` HTML attribute. */
  useMap?: Trackable<string | undefined>
  /** The `usemap` HTML attribute. */
  usemap?: Trackable<string | undefined>
  /** The `value` HTML attribute. */
  value?: Trackable<string | string[] | number | undefined>
  /** The `volume` HTML attribute. */
  volume?: Trackable<string | number | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
  /** The `wmode` HTML attribute. */
  wmode?: Trackable<string | undefined>
  /** The `wrap` HTML attribute. */
  wrap?: Trackable<string | undefined>

  // Non-standard Attributes
  /** The `autocapitalize` HTML attribute. */
  autocapitalize?: Trackable<
    'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  >
  /** The `autoCapitalize` HTML attribute. */
  autoCapitalize?: Trackable<
    'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  >
  /** The `disablePictureInPicture` HTML attribute. */
  disablePictureInPicture?: Trackable<boolean | undefined>
  /** The `results` HTML attribute. */
  results?: Trackable<number | undefined>
  /** The `translate` HTML attribute. */
  translate?: Trackable<boolean | undefined>

  // RDFa Attributes
  /** The `about` HTML attribute. */
  about?: Trackable<string | undefined>
  /** The `datatype` HTML attribute. */
  datatype?: Trackable<string | undefined>
  /** The `inlist` HTML attribute. */
  inlist?: Trackable<any>
  /** The `prefix` HTML attribute. */
  prefix?: Trackable<string | undefined>
  /** The `property` HTML attribute. */
  property?: Trackable<string | undefined>
  /** The `resource` HTML attribute. */
  resource?: Trackable<string | undefined>
  /** The `typeof` HTML attribute. */
  typeof?: Trackable<string | undefined>
  /** The `vocab` HTML attribute. */
  vocab?: Trackable<string | undefined>

  // Microdata Attributes
  /** The `itemProp` HTML attribute. */
  itemProp?: Trackable<string | undefined>
  /** The `itemprop` HTML attribute. */
  itemprop?: Trackable<string | undefined>
  /** The `itemScope` HTML attribute. */
  itemScope?: Trackable<boolean | undefined>
  /** The `itemscope` HTML attribute. */
  itemscope?: Trackable<boolean | undefined>
  /** The `itemType` HTML attribute. */
  itemType?: Trackable<string | undefined>
  /** The `itemtype` HTML attribute. */
  itemtype?: Trackable<string | undefined>
  /** The `itemID` HTML attribute. */
  itemID?: Trackable<string | undefined>
  /** The `itemid` HTML attribute. */
  itemid?: Trackable<string | undefined>
  /** The `itemRef` HTML attribute. */
  itemRef?: Trackable<string | undefined>
  /** The `itemref` HTML attribute. */
  itemref?: Trackable<string | undefined>
}

/**
 * Core global HTML attributes accepted by most host elements.
 */
export interface HTMLProps<eventTarget extends EventTarget = EventTarget>
  extends HostProps<eventTarget>,
    AriaProps {
  // Standard HTML Attributes
  /** The `accesskey` HTML attribute. */
  accesskey?: Trackable<string | undefined>
  /** The `accessKey` HTML attribute. */
  accessKey?: Trackable<string | undefined>
  /** The `autocapitalize` HTML attribute. */
  autocapitalize?: Trackable<
    'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  >
  /** The `autoCapitalize` HTML attribute. */
  autoCapitalize?: Trackable<
    'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters' | undefined
  >
  /** The `autocorrect` HTML attribute. */
  autocorrect?: Trackable<string | undefined>
  /** The `autoCorrect` HTML attribute. */
  autoCorrect?: Trackable<string | undefined>
  /** The `autofocus` HTML attribute. */
  autofocus?: Trackable<boolean | undefined>
  /** The `autoFocus` HTML attribute. */
  autoFocus?: Trackable<boolean | undefined>
  /** The `class` HTML attribute. */
  class?: Trackable<string | undefined>
  /** The `className` HTML attribute. */
  className?: Trackable<string | undefined>
  /** The `contenteditable` HTML attribute. */
  contenteditable?: Trackable<Booleanish | '' | 'plaintext-only' | 'inherit' | undefined>
  /** The `contentEditable` HTML attribute. */
  contentEditable?: Trackable<Booleanish | '' | 'plaintext-only' | 'inherit' | undefined>
  /** The `dir` HTML attribute. */
  dir?: Trackable<'auto' | 'rtl' | 'ltr' | undefined>
  /** The `draggable` HTML attribute. */
  draggable?: Trackable<boolean | undefined>
  /** The `enterkeyhint` HTML attribute. */
  enterkeyhint?: Trackable<
    'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  >
  /** The `exportparts` HTML attribute. */
  exportparts?: Trackable<string | undefined>
  /** The `hidden` HTML attribute. */
  hidden?: Trackable<boolean | 'hidden' | 'until-found' | undefined>
  /** The `id` HTML attribute. */
  id?: Trackable<string | undefined>
  /** The `inert` HTML attribute. */
  inert?: Trackable<boolean | undefined>
  /** The `inputmode` HTML attribute. */
  inputmode?: Trackable<string | undefined>
  /** The `inputMode` HTML attribute. */
  inputMode?: Trackable<string | undefined>
  /** The `is` HTML attribute. */
  is?: Trackable<string | undefined>
  /** The `lang` HTML attribute. */
  lang?: Trackable<string | undefined>
  /** The `nonce` HTML attribute. */
  nonce?: Trackable<string | undefined>
  /** The `part` HTML attribute. */
  part?: Trackable<string | undefined>
  /** The `popover` HTML attribute. */
  popover?: Trackable<'auto' | 'hint' | 'manual' | boolean | undefined>
  /** The `slot` HTML attribute. */
  slot?: Trackable<string | undefined>
  /** The `spellcheck` HTML attribute. */
  spellcheck?: Trackable<boolean | undefined>
  /** The `style` HTML attribute. */
  style?: Trackable<string | StyleProps | undefined>
  /** The `tabindex` HTML attribute. */
  tabindex?: Trackable<number | undefined>
  /** The `tabIndex` HTML attribute. */
  tabIndex?: Trackable<number | undefined>
  /** The `title` HTML attribute. */
  title?: Trackable<string | undefined>
  /** The `translate` HTML attribute. */
  translate?: Trackable<boolean | undefined>

  // WAI-ARIA Attributes
  // Most elements only allow a subset of roles and so this
  // is overwritten in many of the per-element interfaces below
  /** The `role` HTML attribute. */
  role?: Trackable<AriaRole | undefined>

  // Non-standard Attributes
  /** The `disablePictureInPicture` HTML attribute. */
  disablePictureInPicture?: Trackable<boolean | undefined>
  /** The `elementtiming` HTML attribute. */
  elementtiming?: Trackable<string | undefined>
  /** The `elementTiming` HTML attribute. */
  elementTiming?: Trackable<string | undefined>
  /** The `results` HTML attribute. */
  results?: Trackable<number | undefined>

  // RDFa Attributes
  /** The `about` HTML attribute. */
  about?: Trackable<string | undefined>
  /** The `datatype` HTML attribute. */
  datatype?: Trackable<string | undefined>
  /** The `inlist` HTML attribute. */
  inlist?: Trackable<any>
  /** The `prefix` HTML attribute. */
  prefix?: Trackable<string | undefined>
  /** The `property` HTML attribute. */
  property?: Trackable<string | undefined>
  /** The `resource` HTML attribute. */
  resource?: Trackable<string | undefined>
  /** The `typeof` HTML attribute. */
  typeof?: Trackable<string | undefined>
  /** The `vocab` HTML attribute. */
  vocab?: Trackable<string | undefined>

  // Microdata Attributes
  /** The `itemid` HTML attribute. */
  itemid?: Trackable<string | undefined>
  /** The `itemID` HTML attribute. */
  itemID?: Trackable<string | undefined>
  /** The `itemprop` HTML attribute. */
  itemprop?: Trackable<string | undefined>
  /** The `itemProp` HTML attribute. */
  itemProp?: Trackable<string | undefined>
  /** The `itemref` HTML attribute. */
  itemref?: Trackable<string | undefined>
  /** The `itemRef` HTML attribute. */
  itemRef?: Trackable<string | undefined>
  /** The `itemscope` HTML attribute. */
  itemscope?: Trackable<boolean | undefined>
  /** The `itemScope` HTML attribute. */
  itemScope?: Trackable<boolean | undefined>
  /** The `itemtype` HTML attribute. */
  itemtype?: Trackable<string | undefined>
  /** The `itemType` HTML attribute. */
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

/**
 * Props accepted by `<anchor>` elements.
 */
export interface PartialAnchorHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  /** The `download` HTML attribute. */
  download?: Trackable<any>
  /** The `hreflang` HTML attribute. */
  hreflang?: Trackable<string | undefined>
  /** The `hrefLang` HTML attribute. */
  hrefLang?: Trackable<string | undefined>
  /** The `media` HTML attribute. */
  media?: Trackable<string | undefined>
  /** The `ping` HTML attribute. */
  ping?: Trackable<string | undefined>
  /** The `rel` HTML attribute. */
  rel?: Trackable<string | undefined>
  /** The `target` HTML attribute. */
  target?: Trackable<HTMLAttributeAnchorTarget | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
  /** The `referrerpolicy` HTML attribute. */
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `referrerPolicy` HTML attribute. */
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>

  // Non-standard Attributes
  /** The `rmx-target` HTML attribute. */
  'rmx-target'?: Trackable<string | undefined>
  /** The `rmx-src` HTML attribute. */
  'rmx-src'?: Trackable<string | undefined>
  /** The `rmx-reset-scroll` HTML attribute. */
  'rmx-reset-scroll'?: Trackable<string | undefined>
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

/**
 * Props accepted by `<anchor>` elements.
 */
export type AccessibleAnchorHTMLProps<eventTarget extends EventTarget = HTMLAnchorElement> = Omit<
  PartialAnchorHTMLProps<eventTarget>,
  'role'
> &
  AnchorAriaRoles

/**
 * Props accepted by `<anchor>` elements.
 */
export interface AnchorHTMLProps<eventTarget extends EventTarget = HTMLAnchorElement>
  extends PartialAnchorHTMLProps<eventTarget> {
  /** The `href` HTML attribute. */
  href?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<AriaRole | undefined>
}

/**
 * Props accepted by `<area>` elements.
 */
export interface PartialAreaHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  /** The `alt` HTML attribute. */
  alt?: Trackable<string | undefined>
  /** The `coords` HTML attribute. */
  coords?: Trackable<string | undefined>
  /** The `download` HTML attribute. */
  download?: Trackable<any>
  /** The `hreflang` HTML attribute. */
  hreflang?: Trackable<string | undefined>
  /** The `hrefLang` HTML attribute. */
  hrefLang?: Trackable<string | undefined>
  /** The `media` HTML attribute. */
  media?: Trackable<string | undefined>
  /** The `referrerpolicy` HTML attribute. */
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `referrerPolicy` HTML attribute. */
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `rel` HTML attribute. */
  rel?: Trackable<string | undefined>
  /** The `shape` HTML attribute. */
  shape?: Trackable<string | undefined>
  /** The `target` HTML attribute. */
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

/**
 * Props accepted by `<area>` elements.
 */
export type AccessibleAreaHTMLProps<eventTarget extends EventTarget = HTMLAreaElement> = Omit<
  PartialAreaHTMLProps<eventTarget>,
  'role'
> &
  AreaAriaRoles

/**
 * Props accepted by `<area>` elements.
 */
export interface AreaHTMLProps<eventTarget extends EventTarget = HTMLAreaElement>
  extends PartialAreaHTMLProps<eventTarget> {
  /** The `href` HTML attribute. */
  href?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'button' | 'link' | undefined>
}

/**
 * Props accepted by `<article>` elements.
 */
export interface ArticleHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
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

/**
 * Props accepted by `<aside>` elements.
 */
export interface AsideHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
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

/**
 * Props accepted by `<audio>` elements.
 */
export interface AudioHTMLProps<eventTarget extends EventTarget = HTMLAudioElement>
  extends MediaHTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'application' | undefined>
}

/**
 * Props accepted by `<base>` elements.
 */
export interface BaseHTMLProps<eventTarget extends EventTarget = HTMLBaseElement>
  extends HTMLProps<eventTarget> {
  /** The `href` HTML attribute. */
  href?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
  /** The `target` HTML attribute. */
  target?: Trackable<HTMLAttributeAnchorTarget | undefined>
}

/**
 * Props accepted by `<blockquote>` elements.
 */
export interface BlockquoteHTMLProps<eventTarget extends EventTarget = HTMLQuoteElement>
  extends HTMLProps<eventTarget> {
  /** The `cite` HTML attribute. */
  cite?: Trackable<string | undefined>
}

/**
 * Props accepted by `<br>` elements.
 */
export interface BrHTMLProps<eventTarget extends EventTarget = HTMLBRElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'none' | 'presentation' | undefined>
}

/**
 * Props accepted by `<button>` elements.
 */
export interface ButtonHTMLProps<eventTarget extends EventTarget = HTMLButtonElement>
  extends HTMLProps<eventTarget> {
  /** The `command` HTML attribute. */
  command?: Trackable<string | undefined>
  /** The `commandfor` HTML attribute. */
  commandfor?: Trackable<string | undefined>
  /** The `commandFor` HTML attribute. */
  commandFor?: Trackable<string | undefined>
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `formaction` HTML attribute. */
  formaction?: Trackable<string | undefined>
  /** The `formAction` HTML attribute. */
  formAction?: Trackable<string | undefined>
  /** The `formenctype` HTML attribute. */
  formenctype?: Trackable<string | undefined>
  /** The `formEncType` HTML attribute. */
  formEncType?: Trackable<string | undefined>
  /** The `formmethod` HTML attribute. */
  formmethod?: Trackable<string | undefined>
  /** The `formMethod` HTML attribute. */
  formMethod?: Trackable<string | undefined>
  /** The `formnovalidate` HTML attribute. */
  formnovalidate?: Trackable<boolean | undefined>
  /** The `formNoValidate` HTML attribute. */
  formNoValidate?: Trackable<boolean | undefined>
  /** The `formtarget` HTML attribute. */
  formtarget?: Trackable<string | undefined>
  /** The `formTarget` HTML attribute. */
  formTarget?: Trackable<string | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `popovertarget` HTML attribute. */
  popovertarget?: Trackable<string | undefined>
  /** The `popoverTarget` HTML attribute. */
  popoverTarget?: Trackable<string | undefined>
  /** The `popovertargetaction` HTML attribute. */
  popovertargetaction?: Trackable<'hide' | 'show' | 'toggle' | undefined>
  /** The `popoverTargetAction` HTML attribute. */
  popoverTargetAction?: Trackable<'hide' | 'show' | 'toggle' | undefined>
  /** The `role` HTML attribute. */
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
  /** The `type` HTML attribute. */
  type?: Trackable<'submit' | 'reset' | 'button' | undefined>
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
}

/**
 * Props accepted by `<canvas>` elements.
 */
export interface CanvasHTMLProps<eventTarget extends EventTarget = HTMLCanvasElement>
  extends HTMLProps<eventTarget> {
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
}

/**
 * Props accepted by `<caption>` elements.
 */
export interface CaptionHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: 'caption'
}

/**
 * Props accepted by `<col>` elements.
 */
export interface ColHTMLProps<eventTarget extends EventTarget = HTMLTableColElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
  /** The `span` HTML attribute. */
  span?: Trackable<number | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
}

/**
 * Props accepted by `<colgroup>` elements.
 */
export interface ColgroupHTMLProps<eventTarget extends EventTarget = HTMLTableColElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
  /** The `span` HTML attribute. */
  span?: Trackable<number | undefined>
}

/**
 * Props accepted by `<data>` elements.
 */
export interface DataHTMLProps<eventTarget extends EventTarget = HTMLDataElement>
  extends HTMLProps<eventTarget> {
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
}

/**
 * Props accepted by `<datalist>` elements.
 */
export interface DataListHTMLProps<eventTarget extends EventTarget = HTMLDataListElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'listbox' | undefined>
}

/**
 * Props accepted by `<dd>` elements.
 */
export interface DdHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<del>` elements.
 */
export interface DelHTMLProps<eventTarget extends EventTarget = HTMLModElement>
  extends HTMLProps<eventTarget> {
  /** The `cite` HTML attribute. */
  cite?: Trackable<string | undefined>
  /** The `datetime` HTML attribute. */
  datetime?: Trackable<string | undefined>
  /** The `dateTime` HTML attribute. */
  dateTime?: Trackable<string | undefined>
}

/**
 * Props accepted by `<details>` elements.
 */
export interface DetailsHTMLProps<eventTarget extends EventTarget = HTMLDetailsElement>
  extends HTMLProps<eventTarget> {
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `open` HTML attribute. */
  open?: Trackable<boolean | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'group' | undefined>
}

/**
 * Props accepted by `<dialog>` elements.
 */
export interface DialogHTMLProps<eventTarget extends EventTarget = HTMLDialogElement>
  extends HTMLProps<eventTarget> {
  /** The `open` HTML attribute. */
  open?: Trackable<boolean | undefined>
  /** The `closedby` HTML attribute. */
  closedby?: Trackable<'none' | 'closerequest' | 'any' | undefined>
  /** The `closedBy` HTML attribute. */
  closedBy?: Trackable<'none' | 'closerequest' | 'any' | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'dialog' | 'alertdialog' | undefined>
}

/**
 * Props accepted by `<dl>` elements.
 */
export interface DlHTMLProps<eventTarget extends EventTarget = HTMLDListElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'group' | 'list' | 'none' | 'presentation' | undefined>
}

/**
 * Props accepted by `<dt>` elements.
 */
export interface DtHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'listitem' | undefined>
}

/**
 * Props accepted by `<embed>` elements.
 */
export interface EmbedHTMLProps<eventTarget extends EventTarget = HTMLEmbedElement>
  extends HTMLProps<eventTarget> {
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'application' | 'document' | 'img' | 'none' | 'presentation' | undefined>
  /** The `src` HTML attribute. */
  src?: Trackable<string | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
}

/**
 * Props accepted by `<fieldset>` elements.
 */
export interface FieldsetHTMLProps<eventTarget extends EventTarget = HTMLFieldSetElement>
  extends HTMLProps<eventTarget> {
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'group' | 'none' | 'presentation' | 'radiogroup' | undefined>
}

/**
 * Props accepted by `<figcaption>` elements.
 */
export interface FigcaptionHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'group' | 'none' | 'presentation' | undefined>
}

/**
 * Props accepted by `<footer>` elements.
 */
export interface FooterHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'contentinfo' | 'group' | 'none' | 'presentation' | 'doc-footnote' | undefined>
}

/**
 * Props accepted by `<form>` elements.
 */
export interface FormHTMLProps<eventTarget extends EventTarget = HTMLFormElement>
  extends HTMLProps<eventTarget> {
  /** The `accept-charset` HTML attribute. */
  'accept-charset'?: Trackable<string | undefined>
  /** The `acceptCharset` HTML attribute. */
  acceptCharset?: Trackable<string | undefined>
  /** The `action` HTML attribute. */
  action?: Trackable<string | undefined>
  /** The `autocomplete` HTML attribute. */
  autocomplete?: Trackable<string | undefined>
  /** The `autoComplete` HTML attribute. */
  autoComplete?: Trackable<string | undefined>
  /** The `enctype` HTML attribute. */
  enctype?: Trackable<string | undefined>
  /** The `encType` HTML attribute. */
  encType?: Trackable<string | undefined>
  /** The `method` HTML attribute. */
  method?: Trackable<string | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `novalidate` HTML attribute. */
  novalidate?: Trackable<boolean | undefined>
  /** The `noValidate` HTML attribute. */
  noValidate?: Trackable<boolean | undefined>
  /** The `rel` HTML attribute. */
  rel?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'form' | 'none' | 'presentation' | 'search' | undefined>
  /** The `target` HTML attribute. */
  target?: Trackable<string | undefined>
}

/**
 * Props accepted by `<heading>` elements.
 */
export interface HeadingHTMLProps<eventTarget extends EventTarget = HTMLHeadingElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'heading' | 'none' | 'presentation' | 'tab' | 'doc-subtitle' | undefined>
}

/**
 * Props accepted by `<head>` elements.
 */
export interface HeadHTMLProps<eventTarget extends EventTarget = HTMLHeadElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<header>` elements.
 */
export interface HeaderHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'banner' | 'group' | 'none' | 'presentation' | undefined>
}

/**
 * Props accepted by `<hr>` elements.
 */
export interface HrHTMLProps<eventTarget extends EventTarget = HTMLHRElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'separator' | 'none' | 'presentation' | 'doc-pagebreak' | undefined>
}

/**
 * Props accepted by `<html>` elements.
 */
export interface HtmlHTMLProps<eventTarget extends EventTarget = HTMLHtmlElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'document' | undefined>
}

/**
 * Props accepted by `<iframe>` elements.
 */
export interface IframeHTMLProps<eventTarget extends EventTarget = HTMLIFrameElement>
  extends HTMLProps<eventTarget> {
  /** The `allow` HTML attribute. */
  allow?: Trackable<string | undefined>
  /** The `allowFullScreen` HTML attribute. */
  allowFullScreen?: Trackable<boolean | undefined>
  /** The `allowTransparency` HTML attribute. */
  allowTransparency?: Trackable<boolean | undefined>
  /** @deprecated */
  frameborder?: Trackable<number | string | undefined>
  /** @deprecated */
  frameBorder?: Trackable<number | string | undefined>
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `loading` HTML attribute. */
  loading?: Trackable<'eager' | 'lazy' | undefined>
  /** @deprecated */
  marginHeight?: Trackable<number | undefined>
  /** @deprecated */
  marginWidth?: Trackable<number | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `referrerpolicy` HTML attribute. */
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `referrerPolicy` HTML attribute. */
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'application' | 'document' | 'img' | 'none' | 'presentation' | undefined>
  /** The `sandbox` HTML attribute. */
  sandbox?: Trackable<string | undefined>
  /** @deprecated */
  scrolling?: Trackable<string | undefined>
  /** The `seamless` HTML attribute. */
  seamless?: Trackable<boolean | undefined>
  /** The `src` HTML attribute. */
  src?: Trackable<string | undefined>
  /** The `srcdoc` HTML attribute. */
  srcdoc?: Trackable<string | undefined>
  /** The `srcDoc` HTML attribute. */
  srcDoc?: Trackable<string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
}

export type HTMLAttributeCrossOrigin = 'anonymous' | 'use-credentials'

/**
 * Props accepted by `<img>` elements.
 */
export interface PartialImgHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  /** The `crossorigin` HTML attribute. */
  crossorigin?: Trackable<HTMLAttributeCrossOrigin>
  /** The `crossOrigin` HTML attribute. */
  crossOrigin?: Trackable<HTMLAttributeCrossOrigin>
  /** The `decoding` HTML attribute. */
  decoding?: Trackable<'async' | 'auto' | 'sync' | undefined>
  /** The `fetchpriority` HTML attribute. */
  fetchpriority?: Trackable<'high' | 'auto' | 'low' | undefined>
  /** The `fetchPriority` HTML attribute. */
  fetchPriority?: Trackable<'high' | 'auto' | 'low' | undefined>
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `loading` HTML attribute. */
  loading?: Trackable<'eager' | 'lazy' | undefined>
  /** The `referrerpolicy` HTML attribute. */
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `referrerPolicy` HTML attribute. */
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `sizes` HTML attribute. */
  sizes?: Trackable<string | undefined>
  /** The `src` HTML attribute. */
  src?: Trackable<string | undefined>
  /** The `srcset` HTML attribute. */
  srcset?: Trackable<string | undefined>
  /** The `srcSet` HTML attribute. */
  srcSet?: Trackable<string | undefined>
  /** The `usemap` HTML attribute. */
  usemap?: Trackable<string | undefined>
  /** The `useMap` HTML attribute. */
  useMap?: Trackable<string | undefined>
  /** The `width` HTML attribute. */
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

/**
 * Props accepted by `<img>` elements.
 */
export type AccessibleImgHTMLProps<eventTarget extends EventTarget = HTMLImageElement> = Omit<
  PartialImgHTMLProps<eventTarget>,
  'role' | 'aria-label' | 'aria-labelledby' | 'title'
> &
  ImgAriaRoles

/**
 * Props accepted by `<img>` elements.
 */
export interface ImgHTMLProps<eventTarget extends EventTarget = HTMLImageElement>
  extends PartialImgHTMLProps<eventTarget> {
  /** The `alt` HTML attribute. */
  alt?: Trackable<string | undefined>
  /** The `aria-label` HTML attribute. */
  'aria-label'?: Trackable<string | undefined>
  /** The `aria-labelledby` HTML attribute. */
  'aria-labelledby'?: Trackable<string | undefined>
  /** The `href` HTML attribute. */
  href?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: ImgAriaRolesAccessibleName | Trackable<'img' | 'none' | 'presentation' | undefined>
  /** The `title` HTML attribute. */
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

/**
 * Props accepted by `<input>` elements.
 */
export interface PartialInputHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  /** The `accept` HTML attribute. */
  accept?: Trackable<string | undefined>
  /** The `alt` HTML attribute. */
  alt?: Trackable<string | undefined>
  /** The `autocomplete` HTML attribute. */
  autocomplete?: Trackable<string | undefined>
  /** The `autoComplete` HTML attribute. */
  autoComplete?: Trackable<string | undefined>
  /** The `capture` HTML attribute. */
  capture?: Trackable<'user' | 'environment' | undefined> // https://www.w3.org/TR/html-media-capture/#the-capture-attribute
  /** The `checked` HTML attribute. */
  checked?: Trackable<boolean | undefined>
  /** The `defaultChecked` HTML attribute. */
  defaultChecked?: Trackable<boolean | undefined>
  /** The `defaultValue` HTML attribute. */
  defaultValue?: Trackable<string | number | undefined>
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `enterKeyHint` HTML attribute. */
  enterKeyHint?: Trackable<
    'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined
  >
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `formaction` HTML attribute. */
  formaction?: Trackable<string | undefined>
  /** The `formAction` HTML attribute. */
  formAction?: Trackable<string | undefined>
  /** The `formenctype` HTML attribute. */
  formenctype?: Trackable<string | undefined>
  /** The `formEncType` HTML attribute. */
  formEncType?: Trackable<string | undefined>
  /** The `formmethod` HTML attribute. */
  formmethod?: Trackable<string | undefined>
  /** The `formMethod` HTML attribute. */
  formMethod?: Trackable<string | undefined>
  /** The `formnovalidate` HTML attribute. */
  formnovalidate?: Trackable<boolean | undefined>
  /** The `formNoValidate` HTML attribute. */
  formNoValidate?: Trackable<boolean | undefined>
  /** The `formtarget` HTML attribute. */
  formtarget?: Trackable<string | undefined>
  /** The `formTarget` HTML attribute. */
  formTarget?: Trackable<string | undefined>
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `indeterminate` HTML attribute. */
  indeterminate?: Trackable<boolean | undefined>
  /** The `max` HTML attribute. */
  max?: Trackable<number | string | undefined>
  /** The `maxlength` HTML attribute. */
  maxlength?: Trackable<number | undefined>
  /** The `maxLength` HTML attribute. */
  maxLength?: Trackable<number | undefined>
  /** The `min` HTML attribute. */
  min?: Trackable<number | string | undefined>
  /** The `minlength` HTML attribute. */
  minlength?: Trackable<number | undefined>
  /** The `minLength` HTML attribute. */
  minLength?: Trackable<number | undefined>
  /** The `multiple` HTML attribute. */
  multiple?: Trackable<boolean | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `pattern` HTML attribute. */
  pattern?: Trackable<string | undefined>
  /** The `placeholder` HTML attribute. */
  placeholder?: Trackable<string | undefined>
  /** The `readonly` HTML attribute. */
  readonly?: Trackable<boolean | undefined>
  /** The `readOnly` HTML attribute. */
  readOnly?: Trackable<boolean | undefined>
  /** The `required` HTML attribute. */
  required?: Trackable<boolean | undefined>
  /** The `size` HTML attribute. */
  size?: Trackable<number | undefined>
  /** The `src` HTML attribute. */
  src?: Trackable<string | undefined>
  /** The `step` HTML attribute. */
  step?: Trackable<number | string | undefined>
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
  /** The `width` HTML attribute. */
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

/**
 * Props accepted by `<input>` elements.
 */
export type AccessibleInputHTMLProps<eventTarget extends EventTarget = HTMLInputElement> = Omit<
  PartialInputHTMLProps<eventTarget>,
  'role'
> &
  InputAriaRoles

/**
 * Props accepted by `<input>` elements.
 */
export interface InputHTMLProps<eventTarget extends EventTarget = HTMLInputElement>
  extends PartialInputHTMLProps<eventTarget> {
  /** The `type` HTML attribute. */
  type?: Trackable<HTMLInputTypeAttribute | undefined>
  /** The `role` HTML attribute. */
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

/**
 * Props accepted by `<ins>` elements.
 */
export interface InsHTMLProps<eventTarget extends EventTarget = HTMLModElement>
  extends HTMLProps<eventTarget> {
  /** The `cite` HTML attribute. */
  cite?: Trackable<string | undefined>
  /** The `datetime` HTML attribute. */
  datetime?: Trackable<string | undefined>
  /** The `dateTime` HTML attribute. */
  dateTime?: Trackable<string | undefined>
}

/**
 * Props accepted by `<keygen>` elements.
 */
export interface KeygenHTMLProps<eventTarget extends EventTarget = HTMLUnknownElement>
  extends HTMLProps<eventTarget> {
  /** The `challenge` HTML attribute. */
  challenge?: Trackable<string | undefined>
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `keyType` HTML attribute. */
  keyType?: Trackable<string | undefined>
  /** The `keyParams` HTML attribute. */
  keyParams?: Trackable<string | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
}

/**
 * Props accepted by `<label>` elements.
 */
export interface LabelHTMLProps<eventTarget extends EventTarget = HTMLLabelElement>
  extends HTMLProps<eventTarget> {
  /** The `for` HTML attribute. */
  for?: Trackable<string | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `htmlFor` HTML attribute. */
  htmlFor?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<legend>` elements.
 */
export interface LegendHTMLProps<eventTarget extends EventTarget = HTMLLegendElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<li>` elements.
 */
export interface LiHTMLProps<eventTarget extends EventTarget = HTMLLIElement>
  extends HTMLProps<eventTarget> {
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
}

/**
 * Props accepted by `<link>` elements.
 */
export interface LinkHTMLProps<eventTarget extends EventTarget = HTMLLinkElement>
  extends HTMLProps<eventTarget> {
  /** The `as` HTML attribute. */
  as?: Trackable<string | undefined>
  /** The `crossorigin` HTML attribute. */
  crossorigin?: Trackable<HTMLAttributeCrossOrigin>
  /** The `crossOrigin` HTML attribute. */
  crossOrigin?: Trackable<HTMLAttributeCrossOrigin>
  /** The `fetchpriority` HTML attribute. */
  fetchpriority?: Trackable<'high' | 'low' | 'auto' | undefined>
  /** The `fetchPriority` HTML attribute. */
  fetchPriority?: Trackable<'high' | 'low' | 'auto' | undefined>
  /** The `href` HTML attribute. */
  href?: Trackable<string | undefined>
  /** The `hreflang` HTML attribute. */
  hreflang?: Trackable<string | undefined>
  /** The `hrefLang` HTML attribute. */
  hrefLang?: Trackable<string | undefined>
  /** The `integrity` HTML attribute. */
  integrity?: Trackable<string | undefined>
  /** The `media` HTML attribute. */
  media?: Trackable<string | undefined>
  /** The `imageSrcSet` HTML attribute. */
  imageSrcSet?: Trackable<string | undefined>
  /** The `referrerpolicy` HTML attribute. */
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `referrerPolicy` HTML attribute. */
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `rel` HTML attribute. */
  rel?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
  /** The `sizes` HTML attribute. */
  sizes?: Trackable<string | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
  /** The `charset` HTML attribute. */
  charset?: Trackable<string | undefined>
  /** The `charSet` HTML attribute. */
  charSet?: Trackable<string | undefined>
}

/**
 * Props accepted by `<main>` elements.
 */
export interface MainHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'main' | undefined>
}

/**
 * Props accepted by `<map>` elements.
 */
export interface MapHTMLProps<eventTarget extends EventTarget = HTMLMapElement>
  extends HTMLProps<eventTarget> {
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<marquee>` elements.
 */
export interface MarqueeHTMLProps<eventTarget extends EventTarget = HTMLMarqueeElement>
  extends HTMLProps<eventTarget> {
  /** The `behavior` HTML attribute. */
  behavior?: Trackable<'scroll' | 'slide' | 'alternate' | undefined>
  /** The `bgColor` HTML attribute. */
  bgColor?: Trackable<string | undefined>
  /** The `direction` HTML attribute. */
  direction?: Trackable<'left' | 'right' | 'up' | 'down' | undefined>
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `hspace` HTML attribute. */
  hspace?: Trackable<number | string | undefined>
  /** The `loop` HTML attribute. */
  loop?: Trackable<number | string | undefined>
  /** The `scrollAmount` HTML attribute. */
  scrollAmount?: Trackable<number | string | undefined>
  /** The `scrollDelay` HTML attribute. */
  scrollDelay?: Trackable<number | string | undefined>
  /** The `trueSpeed` HTML attribute. */
  trueSpeed?: Trackable<boolean | undefined>
  /** The `vspace` HTML attribute. */
  vspace?: Trackable<number | string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
}

/**
 * Props accepted by `<media>` elements.
 */
export interface MediaHTMLProps<eventTarget extends EventTarget = HTMLMediaElement>
  extends HTMLProps<eventTarget> {
  /** The `autoplay` HTML attribute. */
  autoplay?: Trackable<boolean | undefined>
  /** The `autoPlay` HTML attribute. */
  autoPlay?: Trackable<boolean | undefined>
  /** The `controls` HTML attribute. */
  controls?: Trackable<boolean | undefined>
  /** The `controlslist` HTML attribute. */
  controlslist?: Trackable<string | undefined>
  /** The `controlsList` HTML attribute. */
  controlsList?: Trackable<string | undefined>
  /** The `crossorigin` HTML attribute. */
  crossorigin?: Trackable<HTMLAttributeCrossOrigin>
  /** The `crossOrigin` HTML attribute. */
  crossOrigin?: Trackable<HTMLAttributeCrossOrigin>
  /** The `currentTime` HTML attribute. */
  currentTime?: Trackable<number | undefined>
  /** The `defaultMuted` HTML attribute. */
  defaultMuted?: Trackable<boolean | undefined>
  /** The `defaultPlaybackRate` HTML attribute. */
  defaultPlaybackRate?: Trackable<number | undefined>
  /** The `disableremoteplayback` HTML attribute. */
  disableremoteplayback?: Trackable<boolean | undefined>
  /** The `disableRemotePlayback` HTML attribute. */
  disableRemotePlayback?: Trackable<boolean | undefined>
  /** The `loop` HTML attribute. */
  loop?: Trackable<boolean | undefined>
  /** The `mediaGroup` HTML attribute. */
  mediaGroup?: Trackable<string | undefined>
  /** The `muted` HTML attribute. */
  muted?: Trackable<boolean | undefined>
  /** The `playbackRate` HTML attribute. */
  playbackRate?: Trackable<number | undefined>
  /** The `preload` HTML attribute. */
  preload?: Trackable<'auto' | 'metadata' | 'none' | undefined>
  /** The `preservesPitch` HTML attribute. */
  preservesPitch?: Trackable<boolean | undefined>
  /** The `src` HTML attribute. */
  src?: Trackable<string | undefined>
  /** The `srcObject` HTML attribute. */
  srcObject?: Trackable<MediaStream | MediaSource | Blob | File | null>
  /** The `volume` HTML attribute. */
  volume?: Trackable<string | number | undefined>
}

/**
 * Props accepted by `<menu>` elements.
 */
export interface MenuHTMLProps<eventTarget extends EventTarget = HTMLMenuElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
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
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
}

/**
 * Props accepted by `<meta>` elements.
 */
export interface MetaHTMLProps<eventTarget extends EventTarget = HTMLMetaElement>
  extends HTMLProps<eventTarget> {
  /** The `charset` HTML attribute. */
  charset?: Trackable<string | undefined>
  /** The `charSet` HTML attribute. */
  charSet?: Trackable<string | undefined>
  /** The `content` HTML attribute. */
  content?: Trackable<string | undefined>
  /** The `http-equiv` HTML attribute. */
  'http-equiv'?: Trackable<string | undefined>
  /** The `httpEquiv` HTML attribute. */
  httpEquiv?: Trackable<string | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `media` HTML attribute. */
  media?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<meter>` elements.
 */
export interface MeterHTMLProps<eventTarget extends EventTarget = HTMLMeterElement>
  extends HTMLProps<eventTarget> {
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `high` HTML attribute. */
  high?: Trackable<number | undefined>
  /** The `low` HTML attribute. */
  low?: Trackable<number | undefined>
  /** The `max` HTML attribute. */
  max?: Trackable<number | string | undefined>
  /** The `min` HTML attribute. */
  min?: Trackable<number | string | undefined>
  /** The `optimum` HTML attribute. */
  optimum?: Trackable<number | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'meter' | undefined>
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
}

/**
 * Props accepted by `<nav>` elements.
 */
export interface NavHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<
    'navigation' | 'menu' | 'menubar' | 'none' | 'presentation' | 'tablist' | undefined
  >
}

/**
 * Props accepted by `<noscript>` elements.
 */
export interface NoScriptHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<object>` elements.
 */
export interface ObjectHTMLProps<eventTarget extends EventTarget = HTMLObjectElement>
  extends HTMLProps<eventTarget> {
  /** The `classID` HTML attribute. */
  classID?: Trackable<string | undefined>
  /** The `data` HTML attribute. */
  data?: Trackable<string | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'application' | 'document' | 'img' | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
  /** The `usemap` HTML attribute. */
  usemap?: Trackable<string | undefined>
  /** The `useMap` HTML attribute. */
  useMap?: Trackable<string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
  /** The `wmode` HTML attribute. */
  wmode?: Trackable<string | undefined>
}

/**
 * Props accepted by `<ol>` elements.
 */
export interface OlHTMLProps<eventTarget extends EventTarget = HTMLOListElement>
  extends HTMLProps<eventTarget> {
  /** The `reversed` HTML attribute. */
  reversed?: Trackable<boolean | undefined>
  /** The `role` HTML attribute. */
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
  /** The `start` HTML attribute. */
  start?: Trackable<number | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<'1' | 'a' | 'A' | 'i' | 'I' | undefined>
}

/**
 * Props accepted by `<optgroup>` elements.
 */
export interface OptgroupHTMLProps<eventTarget extends EventTarget = HTMLOptGroupElement>
  extends HTMLProps<eventTarget> {
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `label` HTML attribute. */
  label?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'group' | undefined>
}

/**
 * Props accepted by `<option>` elements.
 */
export interface OptionHTMLProps<eventTarget extends EventTarget = HTMLOptionElement>
  extends HTMLProps<eventTarget> {
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `label` HTML attribute. */
  label?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'option' | undefined>
  /** The `selected` HTML attribute. */
  selected?: Trackable<boolean | undefined>
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
}

/**
 * Props accepted by `<output>` elements.
 */
export interface OutputHTMLProps<eventTarget extends EventTarget = HTMLOutputElement>
  extends HTMLProps<eventTarget> {
  /** The `for` HTML attribute. */
  for?: Trackable<string | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `htmlFor` HTML attribute. */
  htmlFor?: Trackable<string | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
}

/**
 * Props accepted by `<param>` elements.
 */
export interface ParamHTMLProps<eventTarget extends EventTarget = HTMLParamElement>
  extends HTMLProps<eventTarget> {
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
}

/**
 * Props accepted by `<picture>` elements.
 */
export interface PictureHTMLProps<eventTarget extends EventTarget = HTMLPictureElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<progress>` elements.
 */
export interface ProgressHTMLProps<eventTarget extends EventTarget = HTMLProgressElement>
  extends HTMLProps<eventTarget> {
  /** The `max` HTML attribute. */
  max?: Trackable<number | string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'progressbar' | undefined>
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
}

/**
 * Props accepted by `<quote>` elements.
 */
export interface QuoteHTMLProps<eventTarget extends EventTarget = HTMLQuoteElement>
  extends HTMLProps<eventTarget> {
  /** The `cite` HTML attribute. */
  cite?: Trackable<string | undefined>
}

/**
 * Props accepted by `<script>` elements.
 */
export interface ScriptHTMLProps<eventTarget extends EventTarget = HTMLScriptElement>
  extends HTMLProps<eventTarget> {
  /** The `async` HTML attribute. */
  async?: Trackable<boolean | undefined>
  /** @deprecated */
  charset?: Trackable<string | undefined>
  /** @deprecated */
  charSet?: Trackable<string | undefined>
  /** The `crossorigin` HTML attribute. */
  crossorigin?: Trackable<HTMLAttributeCrossOrigin>
  /** The `crossOrigin` HTML attribute. */
  crossOrigin?: Trackable<HTMLAttributeCrossOrigin>
  /** The `defer` HTML attribute. */
  defer?: Trackable<boolean | undefined>
  /** The `integrity` HTML attribute. */
  integrity?: Trackable<string | undefined>
  /** The `nomodule` HTML attribute. */
  nomodule?: Trackable<boolean | undefined>
  /** The `noModule` HTML attribute. */
  noModule?: Trackable<boolean | undefined>
  /** The `referrerpolicy` HTML attribute. */
  referrerpolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `referrerPolicy` HTML attribute. */
  referrerPolicy?: Trackable<HTMLAttributeReferrerPolicy | undefined>
  /** The `role` HTML attribute. */
  role?: never
  /** The `src` HTML attribute. */
  src?: Trackable<string | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
}

/**
 * Props accepted by `<search>` elements.
 */
export interface SearchHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'search' | 'form' | 'group' | 'none' | 'presentation' | 'region' | undefined>
}

/**
 * Props accepted by `<select>` elements.
 */
export interface PartialSelectHTMLProps<eventTarget extends EventTarget>
  extends HTMLProps<eventTarget> {
  /** The `autocomplete` HTML attribute. */
  autocomplete?: Trackable<string | undefined>
  /** The `autoComplete` HTML attribute. */
  autoComplete?: Trackable<string | undefined>
  /** The `defaultValue` HTML attribute. */
  defaultValue?: Trackable<string | number | undefined>
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `required` HTML attribute. */
  required?: Trackable<boolean | undefined>
  /** The `size` HTML attribute. */
  size?: Trackable<number | undefined>
  /** The `value` HTML attribute. */
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

/**
 * Props accepted by `<select>` elements.
 */
export type AccessibleSelectHTMLProps<eventTarget extends EventTarget = HTMLSelectElement> = Omit<
  PartialSelectHTMLProps<eventTarget>,
  'role'
> &
  SelectAriaRoles

/**
 * Props accepted by `<select>` elements.
 */
export interface SelectHTMLProps<eventTarget extends EventTarget = HTMLSelectElement>
  extends PartialSelectHTMLProps<eventTarget> {
  /** The `multiple` HTML attribute. */
  multiple?: Trackable<boolean | undefined>
  /** The `size` HTML attribute. */
  size?: Trackable<number | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<HTMLInputTypeAttribute | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'combobox' | 'listbox' | 'menu' | undefined>
}

/**
 * Props accepted by `<slot>` elements.
 */
export interface SlotHTMLProps<eventTarget extends EventTarget = HTMLSlotElement>
  extends HTMLProps<eventTarget> {
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<source>` elements.
 */
export interface SourceHTMLProps<eventTarget extends EventTarget = HTMLSourceElement>
  extends HTMLProps<eventTarget> {
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `media` HTML attribute. */
  media?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
  /** The `sizes` HTML attribute. */
  sizes?: Trackable<string | undefined>
  /** The `src` HTML attribute. */
  src?: Trackable<string | undefined>
  /** The `srcset` HTML attribute. */
  srcset?: Trackable<string | undefined>
  /** The `srcSet` HTML attribute. */
  srcSet?: Trackable<string | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
}

/**
 * Props accepted by `<style>` elements.
 */
export interface StyleHTMLProps<eventTarget extends EventTarget = HTMLStyleElement>
  extends HTMLProps<eventTarget> {
  /** The `media` HTML attribute. */
  media?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
  /** The `scoped` HTML attribute. */
  scoped?: Trackable<boolean | undefined>
  /** The `type` HTML attribute. */
  type?: Trackable<string | undefined>
}

/**
 * Props accepted by `<table>` elements.
 */
export interface TableHTMLProps<eventTarget extends EventTarget = HTMLTableElement>
  extends HTMLProps<eventTarget> {
  /** The `cellPadding` HTML attribute. */
  cellPadding?: Trackable<string | undefined>
  /** The `cellSpacing` HTML attribute. */
  cellSpacing?: Trackable<string | undefined>
  /** The `summary` HTML attribute. */
  summary?: Trackable<string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
}

/**
 * Props accepted by `<td>` elements.
 */
export interface TdHTMLProps<eventTarget extends EventTarget = HTMLTableCellElement>
  extends HTMLProps<eventTarget> {
  /** The `align` HTML attribute. */
  align?: Trackable<'left' | 'center' | 'right' | 'justify' | 'char' | undefined>
  /** The `colspan` HTML attribute. */
  colspan?: Trackable<number | undefined>
  /** The `colSpan` HTML attribute. */
  colSpan?: Trackable<number | undefined>
  /** The `headers` HTML attribute. */
  headers?: Trackable<string | undefined>
  /** The `rowspan` HTML attribute. */
  rowspan?: Trackable<number | undefined>
  /** The `rowSpan` HTML attribute. */
  rowSpan?: Trackable<number | undefined>
  /** The `scope` HTML attribute. */
  scope?: Trackable<string | undefined>
  /** The `abbr` HTML attribute. */
  abbr?: Trackable<string | undefined>
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
  /** The `valign` HTML attribute. */
  valign?: Trackable<'top' | 'middle' | 'bottom' | 'baseline' | undefined>
}

/**
 * Props accepted by `<template>` elements.
 */
export interface TemplateHTMLProps<eventTarget extends EventTarget = HTMLTemplateElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<textarea>` elements.
 */
export interface TextareaHTMLProps<eventTarget extends EventTarget = HTMLTextAreaElement>
  extends HTMLProps<eventTarget> {
  /** Textarea content comes from `value` or `defaultValue`. */
  children?: never
  /** Textarea content comes from `value` or `defaultValue`. */
  innerHTML?: never
  /** The `autocomplete` HTML attribute. */
  autocomplete?: Trackable<string | undefined>
  /** The `autoComplete` HTML attribute. */
  autoComplete?: Trackable<string | undefined>
  /** The `cols` HTML attribute. */
  cols?: Trackable<number | undefined>
  /** The `defaultValue` HTML attribute. */
  defaultValue?: Trackable<string | number | undefined>
  /** The `dirName` HTML attribute. */
  dirName?: Trackable<string | undefined>
  /** The `disabled` HTML attribute. */
  disabled?: Trackable<boolean | undefined>
  /** The `form` HTML attribute. */
  form?: Trackable<string | undefined>
  /** The `maxlength` HTML attribute. */
  maxlength?: Trackable<number | undefined>
  /** The `maxLength` HTML attribute. */
  maxLength?: Trackable<number | undefined>
  /** The `minlength` HTML attribute. */
  minlength?: Trackable<number | undefined>
  /** The `minLength` HTML attribute. */
  minLength?: Trackable<number | undefined>
  /** The `name` HTML attribute. */
  name?: Trackable<string | undefined>
  /** The `placeholder` HTML attribute. */
  placeholder?: Trackable<string | undefined>
  /** The `readOnly` HTML attribute. */
  readOnly?: Trackable<boolean | undefined>
  /** The `required` HTML attribute. */
  required?: Trackable<boolean | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'textbox' | undefined>
  /** The `rows` HTML attribute. */
  rows?: Trackable<number | undefined>
  /** The `value` HTML attribute. */
  value?: Trackable<string | number | undefined>
  /** The `wrap` HTML attribute. */
  wrap?: Trackable<string | undefined>
}

/**
 * Props accepted by `<th>` elements.
 */
export interface ThHTMLProps<eventTarget extends EventTarget = HTMLTableCellElement>
  extends HTMLProps<eventTarget> {
  /** The `align` HTML attribute. */
  align?: Trackable<'left' | 'center' | 'right' | 'justify' | 'char' | undefined>
  /** The `colspan` HTML attribute. */
  colspan?: Trackable<number | undefined>
  /** The `colSpan` HTML attribute. */
  colSpan?: Trackable<number | undefined>
  /** The `headers` HTML attribute. */
  headers?: Trackable<string | undefined>
  /** The `rowspan` HTML attribute. */
  rowspan?: Trackable<number | undefined>
  /** The `rowSpan` HTML attribute. */
  rowSpan?: Trackable<number | undefined>
  /** The `scope` HTML attribute. */
  scope?: Trackable<string | undefined>
  /** The `abbr` HTML attribute. */
  abbr?: Trackable<string | undefined>
}

/**
 * Props accepted by `<time>` elements.
 */
export interface TimeHTMLProps<eventTarget extends EventTarget = HTMLTimeElement>
  extends HTMLProps<eventTarget> {
  /** The `datetime` HTML attribute. */
  datetime?: Trackable<string | undefined>
  /** The `dateTime` HTML attribute. */
  dateTime?: Trackable<string | undefined>
}

/**
 * Props accepted by `<title>` elements.
 */
export interface TitleHTMLProps<eventTarget extends EventTarget = HTMLTitleElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: never
}

/**
 * Props accepted by `<track>` elements.
 */
export interface TrackHTMLProps<eventTarget extends EventTarget = HTMLTrackElement>
  extends MediaHTMLProps<eventTarget> {
  /** The `default` HTML attribute. */
  default?: Trackable<boolean | undefined>
  /** The `kind` HTML attribute. */
  kind?: Trackable<string | undefined>
  /** The `label` HTML attribute. */
  label?: Trackable<string | undefined>
  /** The `role` HTML attribute. */
  role?: never
  /** The `srclang` HTML attribute. */
  srclang?: Trackable<string | undefined>
  /** The `srcLang` HTML attribute. */
  srcLang?: Trackable<string | undefined>
}

/**
 * Props accepted by `<ul>` elements.
 */
export interface UlHTMLProps<eventTarget extends EventTarget = HTMLUListElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
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

/**
 * Props accepted by `<video>` elements.
 */
export interface VideoHTMLProps<eventTarget extends EventTarget = HTMLVideoElement>
  extends MediaHTMLProps<eventTarget> {
  /** The `disablePictureInPicture` HTML attribute. */
  disablePictureInPicture?: Trackable<boolean | undefined>
  /** The `height` HTML attribute. */
  height?: Trackable<number | string | undefined>
  /** The `playsinline` HTML attribute. */
  playsinline?: Trackable<boolean | undefined>
  /** The `playsInline` HTML attribute. */
  playsInline?: Trackable<boolean | undefined>
  /** The `poster` HTML attribute. */
  poster?: Trackable<string | undefined>
  /** The `width` HTML attribute. */
  width?: Trackable<number | string | undefined>
  /** The `role` HTML attribute. */
  role?: Trackable<'application' | undefined>
}

/**
 * Props accepted by `<wbr>` elements.
 */
export interface WbrHTMLProps<eventTarget extends EventTarget = HTMLElement>
  extends HTMLProps<eventTarget> {
  /** The `role` HTML attribute. */
  role?: Trackable<'none' | 'presentation' | undefined>
}

/**
 * Props accepted by `<detailed>` elements.
 */
export type DetailedHTMLProps<
  HA extends HTMLProps<RefType>,
  RefType extends EventTarget = EventTarget,
> = HA

/**
 * Props accepted by MathML elements.
 */
export interface MathMLProps<eventTarget extends EventTarget = MathMLElement>
  extends HTMLProps<eventTarget> {
  /** The `dir` MathML attribute. */
  dir?: Trackable<'ltr' | 'rtl' | undefined>
  /** The `displaystyle` MathML attribute. */
  displaystyle?: Trackable<boolean | undefined>
  /** @deprecated This feature is non-standard. See https://developer.mozilla.org/en-US/docs/Web/MathML/Global_attributes/href  */
  href?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Global_attributes/mathbackground */
  mathbackground?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Global_attributes/mathcolor */
  mathcolor?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Global_attributes/mathsize */
  mathsize?: Trackable<string | undefined>
  /** The `nonce` MathML attribute. */
  nonce?: Trackable<string | undefined>
  /** The `scriptlevel` MathML attribute. */
  scriptlevel?: Trackable<string | undefined>
}

/**
 * Props accepted by `<annotation>` MathML elements.
 */
export interface AnnotationMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `encoding` MathML attribute. */
  encoding?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/semantics#src */
  src?: Trackable<string | undefined>
}

/**
 * Props accepted by `<annotation-xml>` MathML elements.
 */
export interface AnnotationXmlMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `encoding` MathML attribute. */
  encoding?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/semantics#src */
  src?: Trackable<string | undefined>
}

/**
 * Props accepted by `<maction>` MathML elements.
 */
export interface MActionMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/maction#actiontype */
  actiontype?: Trackable<'statusline' | 'toggle' | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/maction#selection */
  selection?: Trackable<string | undefined>
}

/**
 * Props accepted by `<math>` MathML elements.
 */
export interface MathMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** The `display` MathML attribute. */
  display?: Trackable<'block' | 'inline' | undefined>
}

/**
 * Props accepted by `<menclose>` MathML elements.
 */
export interface MEncloseMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `notation` MathML attribute. */
  notation?: Trackable<string | undefined>
}

/**
 * Props accepted by `<merror>` MathML elements.
 */
export interface MErrorMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

/**
 * Props accepted by `<mfenced>` MathML elements.
 */
export interface MFencedMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `close` MathML attribute. */
  close?: Trackable<string | undefined>
  /** The `open` MathML attribute. */
  open?: Trackable<string | undefined>
  /** The `separators` MathML attribute. */
  separators?: Trackable<string | undefined>
}

/**
 * Props accepted by `<mfrac>` MathML elements.
 */
export interface MFracMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mfrac#denomalign */
  denomalign?: Trackable<'center' | 'left' | 'right' | undefined>
  /** The `linethickness` MathML attribute. */
  linethickness?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mfrac#numalign */
  numalign?: Trackable<'center' | 'left' | 'right' | undefined>
}

/**
 * Props accepted by `<mi>` MathML elements.
 */
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

/**
 * Props accepted by `<mmultiscripts>` MathML elements.
 */
export interface MmultiScriptsMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mmultiscripts#subscriptshift */
  subscriptshift?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mmultiscripts#superscriptshift */
  superscriptshift?: Trackable<string | undefined>
}

/**
 * Props accepted by `<mn>` MathML elements.
 */
export interface MNMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {}

/**
 * Props accepted by `<mo>` MathML elements.
 */
export interface MOMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mo#accent */
  accent?: Trackable<boolean | undefined>
  /** The `fence` MathML attribute. */
  fence?: Trackable<boolean | undefined>
  /** The `largeop` MathML attribute. */
  largeop?: Trackable<boolean | undefined>
  /** The `lspace` MathML attribute. */
  lspace?: Trackable<string | undefined>
  /** The `maxsize` MathML attribute. */
  maxsize?: Trackable<string | undefined>
  /** The `minsize` MathML attribute. */
  minsize?: Trackable<string | undefined>
  /** The `movablelimits` MathML attribute. */
  movablelimits?: Trackable<boolean | undefined>
  /** The `rspace` MathML attribute. */
  rspace?: Trackable<string | undefined>
  /** The `separator` MathML attribute. */
  separator?: Trackable<boolean | undefined>
  /** The `stretchy` MathML attribute. */
  stretchy?: Trackable<boolean | undefined>
  /** The `symmetric` MathML attribute. */
  symmetric?: Trackable<boolean | undefined>
}

/**
 * Props accepted by `<mover>` MathML elements.
 */
export interface MOverMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `accent` MathML attribute. */
  accent?: Trackable<boolean | undefined>
}

/**
 * Props accepted by `<mpadded>` MathML elements.
 */
export interface MPaddedMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `depth` MathML attribute. */
  depth?: Trackable<string | undefined>
  /** The `height` MathML attribute. */
  height?: Trackable<string | undefined>
  /** The `lspace` MathML attribute. */
  lspace?: Trackable<string | undefined>
  /** The `voffset` MathML attribute. */
  voffset?: Trackable<string | undefined>
  /** The `width` MathML attribute. */
  width?: Trackable<string | undefined>
}

/**
 * Props accepted by `<mphantom>` MathML elements.
 */
export interface MPhantomMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

/**
 * Props accepted by `<mprescripts>` MathML elements.
 */
export interface MPrescriptsMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

/**
 * Props accepted by `<mroot>` MathML elements.
 */
export interface MRootMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

/**
 * Props accepted by `<mrow>` MathML elements.
 */
export interface MRowMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

/**
 * Props accepted by `<ms>` MathML elements.
 */
export interface MSMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/ms#browser_compatibility */
  lquote?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/ms#browser_compatibility */
  rquote?: Trackable<string | undefined>
}

/**
 * Props accepted by `<mspace>` MathML elements.
 */
export interface MSpaceMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `depth` MathML attribute. */
  depth?: Trackable<string | undefined>
  /** The `height` MathML attribute. */
  height?: Trackable<string | undefined>
  /** The `width` MathML attribute. */
  width?: Trackable<string | undefined>
}

/**
 * Props accepted by `<msqrt>` MathML elements.
 */
export interface MSqrtMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

/**
 * Props accepted by `<mstyle>` MathML elements.
 */
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

/**
 * Props accepted by `<msub>` MathML elements.
 */
export interface MSubMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/msub#subscriptshift */
  subscriptshift?: Trackable<string | undefined>
}

/**
 * Props accepted by `<msubsup>` MathML elements.
 */
export interface MSubsupMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/msubsup#subscriptshift */
  subscriptshift?: Trackable<string | undefined>
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/msubsup#superscriptshift */
  superscriptshift?: Trackable<string | undefined>
}

/**
 * Props accepted by `<msup>` MathML elements.
 */
export interface MSupMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** @deprecated See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/msup#superscriptshift */
  superscriptshift?: Trackable<string | undefined>
}

/**
 * Props accepted by `<mtable>` MathML elements.
 */
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

/**
 * Props accepted by `<mtd>` MathML elements.
 */
export interface MTdMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** The `columnspan` MathML attribute. */
  columnspan?: Trackable<number | undefined>
  /** The `rowspan` MathML attribute. */
  rowspan?: Trackable<number | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtd#columnalign */
  columnalign?: Trackable<'center' | 'left' | 'right' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtd#rowalign */
  rowalign?: Trackable<'axis' | 'baseline' | 'bottom' | 'center' | 'top' | undefined>
}

/**
 * Props accepted by `<mtext>` MathML elements.
 */
export interface MTextMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}

/**
 * Props accepted by `<mtr>` MathML elements.
 */
export interface MTrMathMLProps<eventTarget extends EventTarget> extends MathMLProps<eventTarget> {
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtr#columnalign */
  columnalign?: Trackable<'center' | 'left' | 'right' | undefined>
  /** Non-standard attribute See https://developer.mozilla.org/en-US/docs/Web/MathML/Element/mtr#rowalign */
  rowalign?: Trackable<'axis' | 'baseline' | 'bottom' | 'center' | 'top' | undefined>
}

/**
 * Props accepted by `<munder>` MathML elements.
 */
export interface MUnderMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `accentunder` MathML attribute. */
  accentunder?: Trackable<boolean | undefined>
}

/**
 * Props accepted by `<munderover>` MathML elements.
 */
export interface MUnderoverMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {
  /** The `accent` MathML attribute. */
  accent?: Trackable<boolean | undefined>
  /** The `accentunder` MathML attribute. */
  accentunder?: Trackable<boolean | undefined>
}

/**
 * Props accepted by `<semantics>` MathML elements.
 */
export interface SemanticsMathMLProps<eventTarget extends EventTarget>
  extends MathMLProps<eventTarget> {}
