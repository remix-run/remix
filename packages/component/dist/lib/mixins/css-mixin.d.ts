import type { ElementProps } from '../jsx.ts';
import type { CSSProps } from '../style/lib/style.ts';
/**
 * Applies generated class names for CSS object styles.
 */
export declare const css: <boundNode extends Element = Element>(styles: CSSProps) => import("../mixin.ts").MixinDescriptor<boundNode, [styles: CSSProps], ElementProps>;
