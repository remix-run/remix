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
    lvl0: '#ffffff',
    lvl3: '#f3f3f3',
    lvl4: '#efefef',
  },
  colors: {
    text: {
      primary: '#151515',
      secondary: '#4f4f4f',
      muted: '#6d6d6d',
      link: '#1A72FF',
    },
    border: {
      subtle: '#e7e7e7',
    },
  },
} as const
