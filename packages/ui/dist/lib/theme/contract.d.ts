import type { css, MixinDescriptor, RemixElement } from '@remix-run/component';
export interface ThemeVariableTree {
    [key: string]: string | ThemeVariableTree;
}
declare const themeVariableNames: {
    readonly space: {
        readonly none: "--rmx-space-none";
        readonly px: "--rmx-space-px";
        readonly xs: "--rmx-space-xs";
        readonly sm: "--rmx-space-sm";
        readonly md: "--rmx-space-md";
        readonly lg: "--rmx-space-lg";
        readonly xl: "--rmx-space-xl";
        readonly xxl: "--rmx-space-xxl";
    };
    readonly radius: {
        readonly none: "--rmx-radius-none";
        readonly sm: "--rmx-radius-sm";
        readonly md: "--rmx-radius-md";
        readonly lg: "--rmx-radius-lg";
        readonly xl: "--rmx-radius-xl";
        readonly full: "--rmx-radius-full";
    };
    readonly fontFamily: {
        readonly sans: "--rmx-font-family-sans";
        readonly mono: "--rmx-font-family-mono";
    };
    readonly fontSize: {
        readonly xxxs: "--rmx-font-size-xxxs";
        readonly xxs: "--rmx-font-size-xxs";
        readonly xs: "--rmx-font-size-xs";
        readonly sm: "--rmx-font-size-sm";
        readonly md: "--rmx-font-size-md";
        readonly lg: "--rmx-font-size-lg";
        readonly xl: "--rmx-font-size-xl";
        readonly xxl: "--rmx-font-size-xxl";
    };
    readonly lineHeight: {
        readonly tight: "--rmx-line-height-tight";
        readonly normal: "--rmx-line-height-normal";
        readonly relaxed: "--rmx-line-height-relaxed";
    };
    readonly letterSpacing: {
        readonly tight: "--rmx-letter-spacing-tight";
        readonly normal: "--rmx-letter-spacing-normal";
        readonly meta: "--rmx-letter-spacing-meta";
        readonly wide: "--rmx-letter-spacing-wide";
    };
    readonly fontWeight: {
        readonly normal: "--rmx-font-weight-normal";
        readonly medium: "--rmx-font-weight-medium";
        readonly semibold: "--rmx-font-weight-semibold";
        readonly bold: "--rmx-font-weight-bold";
    };
    readonly control: {
        readonly height: {
            readonly sm: "--rmx-control-height-sm";
            readonly md: "--rmx-control-height-md";
            readonly lg: "--rmx-control-height-lg";
        };
    };
    readonly surface: {
        readonly lvl0: "--rmx-surface-lvl0";
        readonly lvl1: "--rmx-surface-lvl1";
        readonly lvl2: "--rmx-surface-lvl2";
        readonly lvl3: "--rmx-surface-lvl3";
        readonly lvl4: "--rmx-surface-lvl4";
    };
    readonly shadow: {
        readonly xs: "--rmx-shadow-xs";
        readonly sm: "--rmx-shadow-sm";
        readonly md: "--rmx-shadow-md";
        readonly lg: "--rmx-shadow-lg";
        readonly xl: "--rmx-shadow-xl";
    };
    readonly colors: {
        readonly text: {
            readonly primary: "--rmx-color-text-primary";
            readonly secondary: "--rmx-color-text-secondary";
            readonly muted: "--rmx-color-text-muted";
            readonly link: "--rmx-color-text-link";
        };
        readonly border: {
            readonly subtle: "--rmx-color-border-subtle";
            readonly default: "--rmx-color-border-default";
            readonly strong: "--rmx-color-border-strong";
        };
        readonly focus: {
            readonly ring: "--rmx-color-focus-ring";
        };
        readonly overlay: {
            readonly scrim: "--rmx-color-overlay-scrim";
        };
        readonly action: {
            readonly primary: {
                readonly background: "--rmx-color-action-primary-background";
                readonly backgroundHover: "--rmx-color-action-primary-background-hover";
                readonly backgroundActive: "--rmx-color-action-primary-background-active";
                readonly foreground: "--rmx-color-action-primary-foreground";
                readonly border: "--rmx-color-action-primary-border";
            };
            readonly secondary: {
                readonly background: "--rmx-color-action-secondary-background";
                readonly backgroundHover: "--rmx-color-action-secondary-background-hover";
                readonly backgroundActive: "--rmx-color-action-secondary-background-active";
                readonly foreground: "--rmx-color-action-secondary-foreground";
                readonly border: "--rmx-color-action-secondary-border";
            };
            readonly danger: {
                readonly background: "--rmx-color-action-danger-background";
                readonly backgroundHover: "--rmx-color-action-danger-background-hover";
                readonly backgroundActive: "--rmx-color-action-danger-background-active";
                readonly foreground: "--rmx-color-action-danger-foreground";
                readonly border: "--rmx-color-action-danger-border";
            };
        };
    };
};
type MapLeaves<source, leaf> = source extends string ? leaf : {
    [key in keyof source]: MapLeaves<source[key], leaf>;
};
export type ThemeValue = string | number;
export type ThemeValues = MapLeaves<typeof themeVariableNames, ThemeValue>;
export type ThemeVars = Readonly<Record<string, string>>;
export type CreateThemeOptions = {
    selector?: string;
    reset?: boolean;
};
export type ThemeStyleProps = {
    nonce?: string;
};
type ThemeRenderer = () => (props?: ThemeStyleProps) => RemixElement;
export type ThemeComponent = ThemeRenderer & {
    Style: ThemeRenderer;
    cssText: string;
    selector: string;
    values: ThemeValues;
    vars: ThemeVars;
};
export declare const theme: {
    readonly space: {
        readonly none: string;
        readonly px: string;
        readonly xs: string;
        readonly sm: string;
        readonly md: string;
        readonly lg: string;
        readonly xl: string;
        readonly xxl: string;
    };
    readonly radius: {
        readonly none: string;
        readonly sm: string;
        readonly md: string;
        readonly lg: string;
        readonly xl: string;
        readonly full: string;
    };
    readonly fontFamily: {
        readonly sans: string;
        readonly mono: string;
    };
    readonly fontSize: {
        readonly xxxs: string;
        readonly xxs: string;
        readonly xs: string;
        readonly sm: string;
        readonly md: string;
        readonly lg: string;
        readonly xl: string;
        readonly xxl: string;
    };
    readonly lineHeight: {
        readonly tight: string;
        readonly normal: string;
        readonly relaxed: string;
    };
    readonly letterSpacing: {
        readonly tight: string;
        readonly normal: string;
        readonly meta: string;
        readonly wide: string;
    };
    readonly fontWeight: {
        readonly normal: string;
        readonly medium: string;
        readonly semibold: string;
        readonly bold: string;
    };
    readonly control: {
        readonly height: {
            readonly sm: string;
            readonly md: string;
            readonly lg: string;
        };
    };
    readonly surface: {
        readonly lvl0: string;
        readonly lvl1: string;
        readonly lvl2: string;
        readonly lvl3: string;
        readonly lvl4: string;
    };
    readonly shadow: {
        readonly xs: string;
        readonly sm: string;
        readonly md: string;
        readonly lg: string;
        readonly xl: string;
    };
    readonly colors: {
        readonly text: {
            readonly primary: string;
            readonly secondary: string;
            readonly muted: string;
            readonly link: string;
        };
        readonly border: {
            readonly subtle: string;
            readonly default: string;
            readonly strong: string;
        };
        readonly focus: {
            readonly ring: string;
        };
        readonly overlay: {
            readonly scrim: string;
        };
        readonly action: {
            readonly primary: {
                readonly background: string;
                readonly backgroundHover: string;
                readonly backgroundActive: string;
                readonly foreground: string;
                readonly border: string;
            };
            readonly secondary: {
                readonly background: string;
                readonly backgroundHover: string;
                readonly backgroundActive: string;
                readonly foreground: string;
                readonly border: string;
            };
            readonly danger: {
                readonly background: string;
                readonly backgroundHover: string;
                readonly backgroundActive: string;
                readonly foreground: string;
                readonly border: string;
            };
        };
    };
};
export type ThemeUtility = ReturnType<typeof css>;
type ThemeMixLeaf = MixinDescriptor<any, any, any>;
type PreviousThemeMixDepth = [0, 0, 1, 2, 3, 4];
type NestedThemeMix<value, depth extends number = 4> = depth extends 0 ? value | ReadonlyArray<value> : value | ReadonlyArray<NestedThemeMix<value, PreviousThemeMixDepth[depth]>>;
export type ThemeMix = NestedThemeMix<ThemeMixLeaf>;
export { themeVariableNames };
