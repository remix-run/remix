import type { CSSMixinDescriptor, ElementProps, Props, RemixNode } from '@remix-run/component';
export declare const baseStyle: readonly [import("@remix-run/component").MixinDescriptor<Element, [], ElementProps>, CSSMixinDescriptor];
export declare const iconStyle: readonly [import("@remix-run/component").MixinDescriptor<Element, [Partial<ElementProps>], ElementProps>, CSSMixinDescriptor];
export declare const labelStyle: CSSMixinDescriptor;
export declare const primaryStyle: CSSMixinDescriptor;
export declare const secondaryStyle: CSSMixinDescriptor;
export declare const ghostStyle: CSSMixinDescriptor;
export declare const dangerStyle: CSSMixinDescriptor;
declare const toneStyleByTone: {
    readonly primary: CSSMixinDescriptor;
    readonly secondary: CSSMixinDescriptor;
    readonly ghost: CSSMixinDescriptor;
    readonly danger: CSSMixinDescriptor;
};
export type ButtonTone = keyof typeof toneStyleByTone;
export type ButtonProps = Omit<Props<'button'>, 'children'> & {
    readonly children?: RemixNode;
    readonly endIcon?: RemixNode;
    readonly startIcon?: RemixNode;
    readonly tone?: ButtonTone;
};
export declare function Button(): (props: ButtonProps) => import("@remix-run/component").RemixElement;
export {};
