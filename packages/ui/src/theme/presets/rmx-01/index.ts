import { createGlyphSheet } from '../../../components/glyph/glyph.tsx'
import { createTheme } from '../../runtime.ts'

import { glyphValues } from './glyphs.tsx'

export const RMX_01 = createTheme({
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
    none: '0px',
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
  },
  fontSize: {
    xxxs: '10px',
    xxs: '11px',
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '16px',
    xl: '20px',
    xxl: '28px',
  },
  fontFamily: {
    sans: '"Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.45',
    relaxed: '1.65',
  },
  letterSpacing: {
    tight: '-0.03em',
    normal: '0',
    meta: '0.06em',
    wide: '0.08em',
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
    lg: '0 16px 34px rgb(0 0 0 / 0.10)',
    xl: '0 24px 52px rgb(0 0 0 / 0.14)',
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
      default: '#d1d1d1',
      strong: '#b0b0b0',
    },
    focus: {
      ring: '#1A72FF',
    },
    overlay: {
      scrim: 'rgb(0 0 0 / 0.28)',
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
})

export const RMX_01_GLYPHS = createGlyphSheet(glyphValues)
