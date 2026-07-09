type ComponentActionColors = {
    readonly background: string;
    readonly backgroundHover: string;
    readonly backgroundActive: string;
    readonly foreground: string;
    readonly border: string;
};
type ComponentStyleValues = {
    readonly space: {
        readonly none: string;
        readonly xs: string;
        readonly sm: string;
        readonly md: string;
        readonly lg: string;
    };
    readonly radius: {
        readonly md: string;
        readonly lg: string;
        readonly xl: string;
        readonly full: string;
    };
    readonly fontFamily: {
        readonly sans: string;
    };
    readonly fontSize: {
        readonly xs: string;
        readonly sm: string;
        readonly md: string;
    };
    readonly lineHeight: {
        readonly normal: string;
        readonly relaxed: string;
    };
    readonly fontWeight: {
        readonly normal: string;
        readonly medium: string;
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
    };
    readonly colors: {
        readonly text: {
            readonly primary: string;
            readonly secondary: string;
            readonly muted: string;
        };
        readonly border: {
            readonly subtle: string;
            readonly default: string;
        };
        readonly focus: {
            readonly ring: string;
        };
        readonly action: {
            readonly primary: ComponentActionColors;
            readonly secondary: ComponentActionColors;
            readonly danger: ComponentActionColors;
        };
    };
};
export declare const componentStyleValues: ComponentStyleValues;
export {};
