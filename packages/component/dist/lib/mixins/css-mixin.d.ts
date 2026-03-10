import type { ElementProps } from '../jsx.ts';
import type { CSSProps } from '../style/lib/style.ts';
export declare let css: <boundNode extends Element = Element>(styles: CSSProps) => import("../mixin.ts").MixinDescriptor<boundNode, [styles: CSSProps], ElementProps>;
