import type { MixinDescriptor } from '../runtime/mixins/mixin.ts';
import type { ElementProps } from '../runtime/jsx.ts';
import type { CSSProps } from '../style/style.ts';
export type CSSMixinDescriptor = MixinDescriptor<Element, [styles: CSSProps], ElementProps>;
/**
 * Applies generated class names for CSS object styles.
 */
export declare const css: <boundNode extends Element = Element>(styles: CSSProps) => MixinDescriptor<boundNode, [styles: CSSProps], ElementProps>;
