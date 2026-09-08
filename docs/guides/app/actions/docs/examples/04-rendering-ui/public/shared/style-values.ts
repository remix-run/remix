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

export const componentStyleValues: ComponentStyleValues = {
  space: {
    none: "var(--rmx-space-none)",
    xs: "var(--rmx-space-xs)",
    sm: "var(--rmx-space-sm)",
    md: "var(--rmx-space-md)",
    lg: "var(--rmx-space-lg)",
  },
  radius: {
    md: "var(--rmx-radius-md)",
    lg: "var(--rmx-radius-lg)",
    xl: "var(--rmx-radius-xl)",
    full: "var(--rmx-radius-full)",
  },
  fontSize: {
    xs: "var(--rmx-font-size-xs)",
    sm: "var(--rmx-font-size-sm)",
    md: "var(--rmx-font-size-md)",
  },
  fontFamily: {
    sans: "var(--rmx-font-family-sans)",
  },
  lineHeight: {
    normal: "var(--rmx-line-height-normal)",
    relaxed: "var(--rmx-line-height-relaxed)",
  },
  fontWeight: {
    normal: "var(--rmx-font-weight-normal)",
    medium: "var(--rmx-font-weight-medium)",
  },
  control: {
    height: {
      sm: "var(--rmx-control-height-sm)",
      md: "var(--rmx-control-height-md)",
      lg: "var(--rmx-control-height-lg)",
    },
  },
  surface: {
    lvl0: "var(--rmx-surface-lvl0)",
    lvl1: "var(--rmx-surface-lvl1)",
    lvl2: "var(--rmx-surface-lvl2)",
    lvl3: "var(--rmx-surface-lvl3)",
    lvl4: "var(--rmx-surface-lvl4)",
  },
  shadow: {
    xs: "var(--rmx-shadow-xs)",
    sm: "var(--rmx-shadow-sm)",
    md: "var(--rmx-shadow-md)",
  },
  colors: {
    text: {
      primary: "var(--rmx-color-text-primary)",
      secondary: "var(--rmx-color-text-secondary)",
      muted: "var(--rmx-color-text-muted)",
    },
    border: {
      subtle: "var(--rmx-color-border-subtle)",
      default: "var(--rmx-color-border-default)",
    },
    focus: {
      ring: "var(--rmx-color-focus-ring)",
    },
    action: {
      primary: {
        background: "var(--rmx-color-action-primary-background)",
        backgroundHover: "var(--rmx-color-action-primary-background-hover)",
        backgroundActive: "var(--rmx-color-action-primary-background-active)",
        foreground: "var(--rmx-color-action-primary-foreground)",
        border: "var(--rmx-color-action-primary-border)",
      },
      secondary: {
        background: "var(--rmx-color-action-secondary-background)",
        backgroundHover: "var(--rmx-color-action-secondary-background-hover)",
        backgroundActive: "var(--rmx-color-action-secondary-background-active)",
        foreground: "var(--rmx-color-action-secondary-foreground)",
        border: "var(--rmx-color-action-secondary-border)",
      },
      danger: {
        background: "var(--rmx-color-action-danger-background)",
        backgroundHover: "var(--rmx-color-action-danger-background-hover)",
        backgroundActive: "var(--rmx-color-action-danger-background-active)",
        foreground: "var(--rmx-color-action-danger-foreground)",
        border: "var(--rmx-color-action-danger-border)",
      },
    },
  },
};
