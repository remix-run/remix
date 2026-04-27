import type { MixinDescriptor } from '../mixin.ts';
import type { ElementProps } from '../jsx.ts';
import type { CSSProps } from '../style/lib/style.ts';
export type CSSMixinDescriptor = MixinDescriptor<Element, [styles: CSSProps], ElementProps>;
/**
 * Applies generated class names for CSS object styles.
 */
export declare const css: <boundNode extends Element = Element>(styles: CSSProps) => MixinDescriptor<boundNode, [styles: CSSProps], ElementProps>;
