// Mobile-first breakpoints. Keep in sync with the media queries in the docs CSS files.
export const media = {
  sm: '@media (width >= 640px)',
  md: '@media (width >= 900px)',
  // Short desktop viewports compact the sidebar.
  mdShort: '@media (width >= 900px) and (height <= 780px)',
} as const
