let tokens = {
  color: {
    white: '#ffffff',
    blue050: '#eff6ff',
    blue100: '#e0e7ff',
    blue600: '#2563eb',
    blue700: '#1d4ed8',
    gray050: '#f9fafb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray900: '#111827',
  },
  space: {
    xs: '0.5rem',
    sm: '0.625rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    xxl: '2rem',
    fieldInset: '2.5rem',
  },
  size: {
    icon: '1.25rem',
    cardMaxWidth: '28rem',
  },
  radius: {
    md: '0.5rem',
  },
  border: {
    width: '1px',
  },
  shadow: {
    card: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  motion: {
    fast: '0.2s',
  },
  typography: {
    family: {
      sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    },
    size: {
      sm: '0.875rem',
      md: '1rem',
      title: '1.875rem',
    },
    weight: {
      medium: 500,
      semibold: 600,
    },
    lineHeight: {
      heading: 1.2,
    },
  },
}

let theme = {
  surface: {
    pageBackground: `linear-gradient(to bottom right, ${tokens.color.blue050}, ${tokens.color.blue100})`,
    card: tokens.color.white,
    subtleHover: tokens.color.gray050,
  },
  text: {
    heading: tokens.color.gray900,
    body: tokens.color.gray600,
    label: tokens.color.gray700,
    muted: tokens.color.gray500,
    inverse: tokens.color.white,
  },
  border: {
    subtle: `${tokens.border.width} solid ${tokens.color.gray300}`,
  },
  icon: {
    subtle: tokens.color.gray400,
  },
  action: {
    link: tokens.color.blue600,
    primaryBackground: tokens.color.blue600,
    primaryBackgroundHover: tokens.color.blue700,
    focusRing: `0 0 0 2px ${tokens.color.blue600}`,
  },
  motion: {
    allFast: `all ${tokens.motion.fast}`,
    backgroundFast: `background-color ${tokens.motion.fast}`,
  },
}

export let designSystem = {
  tokens,
  theme,
}
