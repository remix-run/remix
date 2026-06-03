import type { css, Handle, MixinDescriptor, RemixElement } from '@remix-run/ui';
export interface ThemeVariableTree {
    [key: string]: string | ThemeVariableTree;
}
type ThemeVariableGroup<key extends string> = Readonly<Record<key, string>>;
type ThemeActionVariableGroup = ThemeVariableGroup<'background' | 'backgroundHover' | 'backgroundActive' | 'foreground' | 'border'>;
type ThemeVariableNames = {
    readonly space: ThemeVariableGroup<'none' | 'px' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'>;
    readonly radius: ThemeVariableGroup<'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'>;
    readonly fontFamily: ThemeVariableGroup<'sans' | 'mono'>;
    readonly fontSize: ThemeVariableGroup<'xxxs' | 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'>;
    readonly lineHeight: ThemeVariableGroup<'tight' | 'normal' | 'relaxed'>;
    readonly letterSpacing: ThemeVariableGroup<'tight' | 'normal' | 'meta' | 'wide'>;
    readonly fontWeight: ThemeVariableGroup<'normal' | 'medium' | 'semibold' | 'bold'>;
    readonly control: {
        readonly height: ThemeVariableGroup<'sm' | 'md' | 'lg'>;
    };
    readonly surface: ThemeVariableGroup<'lvl0' | 'lvl1' | 'lvl2' | 'lvl3' | 'lvl4'>;
    readonly shadow: ThemeVariableGroup<'xs' | 'sm' | 'md' | 'lg' | 'xl'>;
    readonly colors: {
        readonly text: ThemeVariableGroup<'primary' | 'secondary' | 'muted' | 'link'>;
        readonly border: ThemeVariableGroup<'subtle' | 'default' | 'strong'>;
        readonly focus: ThemeVariableGroup<'ring'>;
        readonly overlay: ThemeVariableGroup<'scrim'>;
        readonly action: {
            readonly primary: ThemeActionVariableGroup;
            readonly secondary: ThemeActionVariableGroup;
            readonly danger: ThemeActionVariableGroup;
        };
    };
};
export declare const themeVariableNames: ThemeVariableNames;
type MapLeaves<source, leaf> = source extends string ? leaf : {
    [key in keyof source]: MapLeaves<source[key], leaf>;
};
export type ThemeValue = string | number;
export type ThemeContract = MapLeaves<ThemeVariableNames, string>;
export type ThemeValues = MapLeaves<typeof themeVariableNames, ThemeValue>;
export type ThemeVars = Readonly<Record<string, string>>;
export type CreateThemeOptions = {
    selector?: string;
    reset?: boolean;
};
export type ThemeStyleProps = {
    nonce?: string;
};
type ThemeRenderer = (handle: Handle<ThemeStyleProps>) => () => RemixElement;
export type ThemeComponent = ThemeRenderer & {
    Style: ThemeRenderer;
    cssText: string;
    selector: string;
    values: ThemeValues;
    vars: ThemeVars;
};
export declare const theme: ThemeContract;
export type ThemeUtility = ReturnType<typeof css>;
type ThemeMixLeaf = MixinDescriptor<any, any, any>;
type PreviousThemeMixDepth = [0, 0, 1, 2, 3, 4];
type NestedThemeMix<value, depth extends number = 4> = depth extends 0 ? value | ReadonlyArray<value> : value | ReadonlyArray<NestedThemeMix<value, PreviousThemeMixDepth[depth]>>;
export type ThemeMix = NestedThemeMix<ThemeMixLeaf>;
export {};
