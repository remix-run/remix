export const theme = {
  space: {
    px: '1px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  fontFamily: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  fontSize: {
    xs: '12px',
    sm: '13px',
    xl: '20px',
    xxl: '28px',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.45',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
  },
  surface: {
    lvl0: '#ffffff',
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
