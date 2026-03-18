import { type ElementProps } from '@remix-run/component';
import { type AnchorOptions } from './anchor.ts';
export declare let popover: <boundNode extends HTMLElement = HTMLElement>(options?: AnchorOptions | undefined) => import("@remix-run/component").MixinDescriptor<boundNode, [options?: AnchorOptions | undefined], ElementProps>;
