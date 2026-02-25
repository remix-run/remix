import type { MixinDescriptor } from '@remix-run/reconciler'
import type { CssInput } from './css-compile.ts'

let CSS_MIXIN_DESCRIPTOR_SYMBOL = Symbol.for('rmx.dom.css-mixin-descriptor')
export let CSS_MIXIN_STYLE_TAG_ATTR = 'data-rmx-css-mixin'
export let CSS_MIXIN_STYLE_TAG_ORIGIN_ATTR = 'data-rmx-css-origin'

type CssMixinDescriptor = MixinDescriptor<Element, [styles: CssInput | null | undefined], string> & {
  [CSS_MIXIN_DESCRIPTOR_SYMBOL]?: true
}

export function markCssMixinDescriptor(
  descriptor: MixinDescriptor<Element, [styles: CssInput | null | undefined], string>,
) {
  ;(descriptor as CssMixinDescriptor)[CSS_MIXIN_DESCRIPTOR_SYMBOL] = true
  return descriptor
}

export function isCssMixinDescriptor(
  value: unknown,
): value is MixinDescriptor<Element, [styles: CssInput | null | undefined], string> {
  if (!value || typeof value !== 'object') return false
  return (value as CssMixinDescriptor)[CSS_MIXIN_DESCRIPTOR_SYMBOL] === true
}
