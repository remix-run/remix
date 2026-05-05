import type { CSSMixinDescriptor, ElementProps, Handle, Props, RemixNode } from '@remix-run/ui';
/**
 * Base button styling with the default `type="button"` behavior for `<button>`
 * hosts. Compose with a tone style (e.g. {@link primaryStyle}) when applying
 * button styling without using the {@link Button} component.
 *
 * @category mixin
 */
export declare const baseStyle: readonly [import("@remix-run/ui").MixinDescriptor<Element, [], ElementProps>, CSSMixinDescriptor];
/**
 * Icon slot sizing and `aria-hidden` defaults for decorative icons rendered
 * inside a button.
 *
 * @category mixin
 */
export declare const iconStyle: readonly [import("@remix-run/ui").MixinDescriptor<Element, [Partial<ElementProps>], ElementProps>, CSSMixinDescriptor];
/**
 * Inline label slot with the standard button label spacing.
 *
 * @category mixin
 */
export declare const labelStyle: CSSMixinDescriptor;
/**
 * Primary visual treatment for buttons. Combine with {@link baseStyle} when
 * styling a non-`Button` host element.
 *
 * @category mixin
 */
export declare const primaryStyle: CSSMixinDescriptor;
/**
 * Secondary visual treatment for buttons. Combine with {@link baseStyle} when
 * styling a non-`Button` host element.
 *
 * @category mixin
 */
export declare const secondaryStyle: CSSMixinDescriptor;
/**
 * Ghost visual treatment for buttons — transparent background with a hover
 * surface. Combine with {@link baseStyle} when styling a non-`Button` host
 * element.
 *
 * @category mixin
 */
export declare const ghostStyle: CSSMixinDescriptor;
/**
 * Danger visual treatment for destructive actions. Combine with
 * {@link baseStyle} when styling a non-`Button` host element.
 *
 * @category mixin
 */
export declare const dangerStyle: CSSMixinDescriptor;
declare const toneStyleByTone: {
    readonly primary: CSSMixinDescriptor;
    readonly secondary: CSSMixinDescriptor;
    readonly ghost: CSSMixinDescriptor;
    readonly danger: CSSMixinDescriptor;
};
/**
 * Visual treatment supported by {@link Button} — `'primary'`, `'secondary'`,
 * `'ghost'`, or `'danger'`.
 */
export type ButtonTone = keyof typeof toneStyleByTone;
/**
 * Props accepted by the {@link Button} component.
 *
 * Extends the native `<button>` element props with optional icon slots and a
 * tone variant
 */
export type ButtonProps = Omit<Props<'button'>, 'children'> & {
    /**
     * Content rendered inside the button's label slot.
     */
    readonly children?: RemixNode;
    /**
     * Decorative icon rendered after the label, inside the icon slot.
     */
    readonly endIcon?: RemixNode;
    /**
     * Decorative icon rendered before the label, inside the icon slot.
     */
    readonly startIcon?: RemixNode;
    /**
     * Visual treatment to apply to the button (default `'secondary'`).
     */
    readonly tone?: ButtonTone;
};
/**
 * Renders a `<button>` with `baseStyle` and the resolved tone style, along with
 * optional start and end icons.
 *
 * @param handle Component handle providing the runtime API and the resolved {@link ButtonProps}.
 * @returns A render function for the button element.
 *
 * @example
 * ```tsx
 * import { Button } from '@remix-run/ui/button'
 * import { Glyph } from '@remix-run/ui/glyph'
 *
 * <Button startIcon={<Glyph name="add" />} tone="primary">
 *   Create project
 * </Button>
 * ```
 */
export declare function Button(handle: Handle<ButtonProps>): () => import("@remix-run/ui").RemixElement;
export {};
