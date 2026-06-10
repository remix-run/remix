type ComponentActionColors = {
  readonly background: string
  readonly backgroundHover: string
  readonly backgroundActive: string
  readonly foreground: string
  readonly border: string
}

type ComponentStyleValues = {
  readonly space: {
    readonly none: string
    readonly xs: string
    readonly sm: string
    readonly md: string
    readonly lg: string
  }
  readonly radius: {
    readonly md: string
    readonly lg: string
    readonly xl: string
    readonly full: string
  }
  readonly fontFamily: {
    readonly sans: string
  }
  readonly fontSize: {
    readonly xs: string
    readonly sm: string
    readonly md: string
  }
  readonly lineHeight: {
    readonly normal: string
    readonly relaxed: string
  }
  readonly fontWeight: {
    readonly normal: string
    readonly medium: string
  }
  readonly control: {
    readonly height: {
      readonly sm: string
      readonly md: string
      readonly lg: string
    }
  }
  readonly surface: {
    readonly lvl0: string
    readonly lvl1: string
    readonly lvl2: string
    readonly lvl3: string
    readonly lvl4: string
  }
  readonly shadow: {
    readonly xs: string
    readonly sm: string
    readonly md: string
  }
  readonly colors: {
    readonly text: {
      readonly primary: string
      readonly secondary: string
      readonly muted: string
    }
    readonly border: {
      readonly subtle: string
      readonly default: string
    }
    readonly focus: {
      readonly ring: string
    }
    readonly action: {
      readonly primary: ComponentActionColors
      readonly secondary: ComponentActionColors
      readonly danger: ComponentActionColors
    }
  }
}

export const componentStyleValues: ComponentStyleValues = {
  space: {
    none: '0px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
  },
  radius: {
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  fontSize: {
    xs: '12px',
    sm: '13px',
    md: '14px',
  },
  fontFamily: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  lineHeight: {
    normal: '1.45',
    relaxed: '1.65',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
  },
  control: {
    height: {
      sm: '28px',
      md: '32px',
      lg: '36px',
    },
  },
  surface: {
    lvl0: '#ffffff',
    lvl1: '#f8f8f8',
    lvl2: '#f5f5f5',
    lvl3: '#f3f3f3',
    lvl4: '#efefef',
  },
  shadow: {
    xs: '0 1px 1px rgb(0 0 0 / 0.05)',
    sm: '0 1px 2px rgb(0 0 0 / 0.07)',
    md: '0 6px 18px rgb(0 0 0 / 0.08)',
  },
  colors: {
    text: {
      primary: '#151515',
      secondary: '#4f4f4f',
      muted: '#6d6d6d',
    },
    border: {
      subtle: '#e7e7e7',
      default: '#d1d1d1',
    },
    focus: {
      ring: '#1A72FF',
    },
    action: {
      primary: {
        background: '#1A72FF',
        backgroundHover: '#1463e0',
        backgroundActive: '#0f55c9',
        foreground: 'rgb(255 255 255 / 0.92)',
        border: '#1A72FF',
      },
      secondary: {
        background: '#ffffff',
        backgroundHover: '#fbfbfb',
        backgroundActive: '#f3f3f3',
        foreground: '#202020',
        border: '#d1d1d1',
      },
      danger: {
        background: '#FF3000',
        backgroundHover: '#e12b00',
        backgroundActive: '#c52600',
        foreground: 'rgb(255 255 255 / 0.92)',
        border: '#FF3000',
      },
    },
  },
}
