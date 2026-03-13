import type { ElementProps } from '../jsx.ts';
import type { NavigationOptions } from '../navigation.ts';
type LinkCurrentProps = ElementProps & {
    disabled?: boolean;
    role?: string;
    tabIndex?: number;
    tabindex?: number;
    type?: string;
    contentEditable?: boolean | string;
    contenteditable?: boolean | string;
    'aria-disabled'?: boolean | 'true' | 'false';
};
export declare let link: <boundNode extends HTMLElement = HTMLElement>(href: string, options?: NavigationOptions | undefined) => import("../mixin.ts").MixinDescriptor<boundNode, [href: string, options?: NavigationOptions | undefined], LinkCurrentProps>;
export {};
