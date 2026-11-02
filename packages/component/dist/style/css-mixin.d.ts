import type { MixinFactory } from '../runtime/mixins/mixin.ts';
import type { MixinDescriptor } from '../runtime/mixins/mixin.ts';
import type { ElementProps } from '../runtime/jsx.ts';
import type { CSSProps } from '../style/style.ts';
/**
 * Descriptor produced by `css(...)` for composing generated styles with other host mixins.
 */
export type CSSMixinDescriptor = MixinDescriptor<Element, [styles: CSSProps], ElementProps>;
/**
 * Applies generated class names for CSS object styles.
 */
export declare const css: MixinFactory<Element, [styles: CSSProps], ElementProps>;
