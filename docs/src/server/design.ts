export const theme = {
  space: {
    none: '0px',
    px: '1px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  fontFamily: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  fontSize: {
    xxxs: '10px',
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    xxl: '28px',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.45',
    relaxed: '1.65',
  },
  letterSpacing: {
    meta: '0.06em',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  control: {
    height: {
      sm: '28px',
    },
  },
  surface: {
    lvl0: 'light-dark(#ffffff, #1a1a1a)',
    lvl1: 'light-dark(#f8f8f8, #1f1f1f)',
    lvl2: 'light-dark(#f5f5f5, #232323)',
    lvl3: 'light-dark(#f3f3f3, #272727)',
    lvl4: 'light-dark(#efefef, #2c2c2c)',
  },
  colors: {
    text: {
      primary: 'light-dark(#151515, #ececec)',
      secondary: 'light-dark(#4f4f4f, #b3b3b3)',
      muted: 'light-dark(#6d6d6d, #b3b3b3)',
      link: 'light-dark(#1A72FF, #6eaaff)',
    },
    border: {
      subtle: 'light-dark(#e7e7e7, #333333)',
      default: 'light-dark(#d1d1d1, #444444)',
      strong: 'light-dark(#b0b0b0, #666666)',
    },
  },
} as const
