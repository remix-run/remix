const themeVariableNames = {
    space: {
        none: '--rmx-space-none',
        px: '--rmx-space-px',
        xs: '--rmx-space-xs',
        sm: '--rmx-space-sm',
        md: '--rmx-space-md',
        lg: '--rmx-space-lg',
        xl: '--rmx-space-xl',
        xxl: '--rmx-space-xxl',
    },
    radius: {
        none: '--rmx-radius-none',
        sm: '--rmx-radius-sm',
        md: '--rmx-radius-md',
        lg: '--rmx-radius-lg',
        xl: '--rmx-radius-xl',
        full: '--rmx-radius-full',
    },
    fontFamily: {
        sans: '--rmx-font-family-sans',
        mono: '--rmx-font-family-mono',
    },
    fontSize: {
        xxxs: '--rmx-font-size-xxxs',
        xxs: '--rmx-font-size-xxs',
        xs: '--rmx-font-size-xs',
        sm: '--rmx-font-size-sm',
        md: '--rmx-font-size-md',
        lg: '--rmx-font-size-lg',
        xl: '--rmx-font-size-xl',
        xxl: '--rmx-font-size-xxl',
    },
    lineHeight: {
        tight: '--rmx-line-height-tight',
        normal: '--rmx-line-height-normal',
        relaxed: '--rmx-line-height-relaxed',
    },
    letterSpacing: {
        tight: '--rmx-letter-spacing-tight',
        normal: '--rmx-letter-spacing-normal',
        meta: '--rmx-letter-spacing-meta',
        wide: '--rmx-letter-spacing-wide',
    },
    fontWeight: {
        normal: '--rmx-font-weight-normal',
        medium: '--rmx-font-weight-medium',
        semibold: '--rmx-font-weight-semibold',
        bold: '--rmx-font-weight-bold',
    },
    control: {
        height: {
            sm: '--rmx-control-height-sm',
            md: '--rmx-control-height-md',
            lg: '--rmx-control-height-lg',
        },
    },
    surface: {
        lvl0: '--rmx-surface-lvl0',
        lvl1: '--rmx-surface-lvl1',
        lvl2: '--rmx-surface-lvl2',
        lvl3: '--rmx-surface-lvl3',
        lvl4: '--rmx-surface-lvl4',
    },
    shadow: {
        xs: '--rmx-shadow-xs',
        sm: '--rmx-shadow-sm',
        md: '--rmx-shadow-md',
        lg: '--rmx-shadow-lg',
        xl: '--rmx-shadow-xl',
    },
    colors: {
        text: {
            primary: '--rmx-color-text-primary',
            secondary: '--rmx-color-text-secondary',
            muted: '--rmx-color-text-muted',
            link: '--rmx-color-text-link',
        },
        border: {
            subtle: '--rmx-color-border-subtle',
            default: '--rmx-color-border-default',
            strong: '--rmx-color-border-strong',
        },
        focus: {
            ring: '--rmx-color-focus-ring',
        },
        overlay: {
            scrim: '--rmx-color-overlay-scrim',
        },
        action: {
            primary: {
                background: '--rmx-color-action-primary-background',
                backgroundHover: '--rmx-color-action-primary-background-hover',
                backgroundActive: '--rmx-color-action-primary-background-active',
                foreground: '--rmx-color-action-primary-foreground',
                border: '--rmx-color-action-primary-border',
            },
            secondary: {
                background: '--rmx-color-action-secondary-background',
                backgroundHover: '--rmx-color-action-secondary-background-hover',
                backgroundActive: '--rmx-color-action-secondary-background-active',
                foreground: '--rmx-color-action-secondary-foreground',
                border: '--rmx-color-action-secondary-border',
            },
            danger: {
                background: '--rmx-color-action-danger-background',
                backgroundHover: '--rmx-color-action-danger-background-hover',
                backgroundActive: '--rmx-color-action-danger-background-active',
                foreground: '--rmx-color-action-danger-foreground',
                border: '--rmx-color-action-danger-border',
            },
        },
    },
};
export const theme = createThemeContract(themeVariableNames);
export { themeVariableNames };
function createThemeContract(tree) {
    return mapTreeLeaves(tree, (variableName) => `var(${variableName})`);
}
function mapTreeLeaves(tree, mapLeaf) {
    let output = {};
    for (let [key, value] of Object.entries(tree)) {
        if (typeof value === 'string') {
            output[key] = mapLeaf(value);
            continue;
        }
        output[key] = mapTreeLeaves(value, mapLeaf);
    }
    return output;
}
//# sourceMappingURL=contract.js.map