import { css } from '@remix-run/component';
import type { RemixElement } from '@remix-run/component';
import type { MixinDescriptor } from '@remix-run/component';
type ThemeScale = Record<string, string>;
declare let themeVariableNames: {
    readonly space: {
        readonly 0: "--rmx-space-0";
        readonly px: "--rmx-space-px";
        readonly xs: "--rmx-space-xs";
        readonly sm: "--rmx-space-sm";
        readonly md: "--rmx-space-md";
        readonly lg: "--rmx-space-lg";
        readonly xl: "--rmx-space-xl";
        readonly '2xl': "--rmx-space-2xl";
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
        readonly '3xs': "--rmx-font-size-3xs";
        readonly xxs: "--rmx-font-size-xxs";
        readonly xs: "--rmx-font-size-xs";
        readonly sm: "--rmx-font-size-sm";
        readonly md: "--rmx-font-size-md";
        readonly lg: "--rmx-font-size-lg";
        readonly xl: "--rmx-font-size-xl";
        readonly '2xl': "--rmx-font-size-2xl";
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
    readonly shadow: {
        readonly xs: "--rmx-shadow-xs";
        readonly sm: "--rmx-shadow-sm";
        readonly md: "--rmx-shadow-md";
        readonly lg: "--rmx-shadow-lg";
        readonly xl: "--rmx-shadow-xl";
    };
    readonly duration: {
        readonly fast: "--rmx-duration-fast";
        readonly normal: "--rmx-duration-normal";
        readonly slow: "--rmx-duration-slow";
        readonly spin: "--rmx-duration-spin";
    };
    readonly easing: {
        readonly standard: "--rmx-easing-standard";
        readonly emphasized: "--rmx-easing-emphasized";
    };
    readonly zIndex: {
        readonly dropdown: "--rmx-z-index-dropdown";
        readonly popover: "--rmx-z-index-popover";
        readonly sticky: "--rmx-z-index-sticky";
        readonly overlay: "--rmx-z-index-overlay";
        readonly modal: "--rmx-z-index-modal";
        readonly toast: "--rmx-z-index-toast";
        readonly tooltip: "--rmx-z-index-tooltip";
    };
    readonly colors: {
        readonly text: {
            readonly primary: "--rmx-color-text-primary";
            readonly secondary: "--rmx-color-text-secondary";
            readonly muted: "--rmx-color-text-muted";
            readonly inverse: "--rmx-color-text-inverse";
            readonly link: "--rmx-color-text-link";
        };
        readonly background: {
            readonly canvas: "--rmx-color-background-canvas";
            readonly surface: "--rmx-color-background-surface";
            readonly surfaceSecondary: "--rmx-color-background-surface-secondary";
            readonly surfaceElevated: "--rmx-color-background-surface-elevated";
            readonly inset: "--rmx-color-background-inset";
            readonly inverse: "--rmx-color-background-inverse";
        };
        readonly border: {
            readonly subtle: "--rmx-color-border-subtle";
            readonly default: "--rmx-color-border-default";
            readonly strong: "--rmx-color-border-strong";
            readonly inverse: "--rmx-color-border-inverse";
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
        readonly status: {
            readonly info: {
                readonly background: "--rmx-color-status-info-background";
                readonly foreground: "--rmx-color-status-info-foreground";
                readonly border: "--rmx-color-status-info-border";
            };
            readonly success: {
                readonly background: "--rmx-color-status-success-background";
                readonly foreground: "--rmx-color-status-success-foreground";
                readonly border: "--rmx-color-status-success-border";
            };
            readonly warning: {
                readonly background: "--rmx-color-status-warning-background";
                readonly foreground: "--rmx-color-status-warning-foreground";
                readonly border: "--rmx-color-status-warning-border";
            };
            readonly danger: {
                readonly background: "--rmx-color-status-danger-background";
                readonly foreground: "--rmx-color-status-danger-foreground";
                readonly border: "--rmx-color-status-danger-border";
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
        readonly 0: string;
        readonly px: string;
        readonly xs: string;
        readonly sm: string;
        readonly md: string;
        readonly lg: string;
        readonly xl: string;
        readonly '2xl': string;
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
        readonly '3xs': string;
        readonly xxs: string;
        readonly xs: string;
        readonly sm: string;
        readonly md: string;
        readonly lg: string;
        readonly xl: string;
        readonly '2xl': string;
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
    readonly shadow: {
        readonly xs: string;
        readonly sm: string;
        readonly md: string;
        readonly lg: string;
        readonly xl: string;
    };
    readonly duration: {
        readonly fast: string;
        readonly normal: string;
        readonly slow: string;
        readonly spin: string;
    };
    readonly easing: {
        readonly standard: string;
        readonly emphasized: string;
    };
    readonly zIndex: {
        readonly dropdown: string;
        readonly popover: string;
        readonly sticky: string;
        readonly overlay: string;
        readonly modal: string;
        readonly toast: string;
        readonly tooltip: string;
    };
    readonly colors: {
        readonly text: {
            readonly primary: string;
            readonly secondary: string;
            readonly muted: string;
            readonly inverse: string;
            readonly link: string;
        };
        readonly background: {
            readonly canvas: string;
            readonly surface: string;
            readonly surfaceSecondary: string;
            readonly surfaceElevated: string;
            readonly inset: string;
            readonly inverse: string;
        };
        readonly border: {
            readonly subtle: string;
            readonly default: string;
            readonly strong: string;
            readonly inverse: string;
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
        readonly status: {
            readonly info: {
                readonly background: string;
                readonly foreground: string;
                readonly border: string;
            };
            readonly success: {
                readonly background: string;
                readonly foreground: string;
                readonly border: string;
            };
            readonly warning: {
                readonly background: string;
                readonly foreground: string;
                readonly border: string;
            };
            readonly danger: {
                readonly background: string;
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
type ThemeUtilityScale<scale extends ThemeScale> = {
    [key in keyof scale]: ThemeUtility;
};
type ThemeAxisUtility = ThemeUtility & {
    start: ThemeUtility;
    center: ThemeUtility;
    end: ThemeUtility;
    between: ThemeUtility;
    wrap: ThemeUtility;
};
export type ThemeUi = {
    p: ThemeUtilityScale<typeof theme.space>;
    px: ThemeUtilityScale<typeof theme.space>;
    py: ThemeUtilityScale<typeof theme.space>;
    m: ThemeUtilityScale<typeof theme.space>;
    mx: ThemeUtilityScale<typeof theme.space>;
    my: ThemeUtilityScale<typeof theme.space>;
    mt: ThemeUtilityScale<typeof theme.space>;
    mr: ThemeUtilityScale<typeof theme.space>;
    mb: ThemeUtilityScale<typeof theme.space>;
    ml: ThemeUtilityScale<typeof theme.space>;
    gap: ThemeUtilityScale<typeof theme.space>;
    rounded: ThemeUtilityScale<typeof theme.radius>;
    textSize: ThemeUtilityScale<typeof theme.fontSize>;
    fontWeight: ThemeUtilityScale<typeof theme.fontWeight>;
    textColor: ThemeUtilityScale<typeof theme.colors.text>;
    bg: ThemeUtilityScale<typeof theme.colors.background>;
    borderColor: ThemeUtilityScale<typeof theme.colors.border>;
    shadow: ThemeUtilityScale<typeof theme.shadow>;
    icon: {
        sm: ThemeUtility;
        md: ThemeUtility;
        lg: ThemeUtility;
    };
    animation: {
        spin: ThemeUtility;
    };
    text: {
        body: ThemeUtility;
        bodySm: ThemeUtility;
        label: ThemeUtility;
        eyebrow: ThemeUtility;
        caption: ThemeUtility;
        code: ThemeUtility;
        supporting: ThemeUtility;
        title: ThemeUtility;
        display: ThemeUtility;
    };
    surfaceText: {
        eyebrow: ThemeUtility;
        title: ThemeUtility;
        body: ThemeUtility;
        supporting: ThemeUtility;
    };
    ring: {
        focus: ThemeUtility;
    };
    control: {
        base: ThemeUtility;
        quiet: ThemeUtility;
    };
    field: {
        base: ThemeUtility;
    };
    fieldText: {
        label: ThemeUtility;
        help: ThemeUtility;
    };
    sidebar: {
        panel: ThemeUtility;
        section: ThemeUtility;
        heading: ThemeUtility;
    };
    row: ThemeAxisUtility;
    stack: ThemeAxisUtility;
    nav: {
        list: ThemeUtility;
        item: ThemeUtility;
        itemActive: ThemeMix;
        itemMuted: ThemeMix;
    };
    card: {
        base: ThemeMix;
        secondary: ThemeMix;
        elevated: ThemeMix;
        inset: ThemeMix;
        stack: ThemeUtility;
        header: ThemeUtility;
        headerWithAction: ThemeUtility;
        body: ThemeUtility;
        footer: ThemeUtility;
        eyebrow: ThemeUtility;
        title: ThemeUtility;
        description: ThemeUtility;
        action: ThemeUtility;
    };
    item: {
        base: ThemeUtility;
        selected: ThemeMix;
        danger: ThemeMix;
    };
    surface: {
        base: ThemeUtility;
        secondary: ThemeUtility;
        elevated: ThemeUtility;
        inset: ThemeUtility;
    };
    status: {
        info: ThemeUtility;
        success: ThemeUtility;
        warning: ThemeUtility;
        danger: ThemeUtility;
    };
    button: {
        base: ThemeMix;
        label: ThemeUtility;
        icon: ThemeMix;
        sm: ThemeUtility;
        md: ThemeUtility;
        lg: ThemeUtility;
        iconOnly: ThemeUtility;
        tone: {
            primary: ThemeUtility;
            secondary: ThemeUtility;
            ghost: ThemeUtility;
            danger: ThemeUtility;
        };
        primary: ThemeMix;
        secondary: ThemeMix;
        ghost: ThemeMix;
        danger: ThemeMix;
    };
    accordion: {
        root: ThemeUtility;
        item: ThemeMix;
        trigger: ThemeUtility;
        indicator: ThemeUtility;
        panel: ThemeUtility;
        body: ThemeUtility;
    };
    popover: {
        base: ThemeMix;
        surface: ThemeMix;
    };
    listbox: {
        trigger: ThemeMix;
        value: ThemeMix;
        indicator: ThemeMix;
        popup: ThemeMix;
        list: ThemeMix;
        itemIndicator: ThemeMix;
        itemLabel: ThemeMix;
        item: ThemeMix;
    };
};
export declare const ui: ThemeUi;
export declare const RMX_01_VALUES: ThemeValues;
export declare const RMX_01: ThemeComponent;
export declare function createTheme(values: ThemeValues, options?: CreateThemeOptions): ThemeComponent;
export {};
