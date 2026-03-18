import { type ElementProps } from '@remix-run/component';
type FilterTextOptions = {
    timeout?: number;
};
export declare let filterText: <boundNode extends HTMLElement = HTMLElement>(onText: (text: string) => void, options?: FilterTextOptions | undefined) => import("@remix-run/component").MixinDescriptor<boundNode, [onText: (text: string) => void, options?: FilterTextOptions | undefined], ElementProps>;
export {};
