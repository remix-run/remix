import type { HtmlMetaDescriptor } from '@remix-run/react'
export const LOADERS_DATA_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=30, stale-while-revalidate',
}

export const SECURITY_HEADERS: HeadersInit = {
  'X-DNS-Prefetch-Control': 'on',
  'Referrer-Policy': 'origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
}

const DEFAULT_META_TAGS = {
  title: 'Remix with Xata',
  description:
    'the minimal template to a Remix project connected to a Xata database',
  image:
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000/og.jpg'
      : 'https://remix-with-xata.netlify.app/og.jpg',
}

export const metatags = (params = {}): HtmlMetaDescriptor => {
  const meta = { ...DEFAULT_META_TAGS, ...params }

  return {
    title: meta.title,
    description: meta.description,
    'og:title': meta.title,
    'og:description': meta.description,
    'og:image': meta.image,
    'og:type': 'website',
    'twitter:card': 'summary_large_image',
    'twitter:title': meta.title,
    'twitter:description': meta.description,
    'twitter:image': meta.image,
    'theme-color': '#000000',
  }
}

export const LINKS = [
  {
    description: 'Everything you need to know about Xata APIs and tools.',
    title: 'Xata Docs',
    url: 'https://docs.xata.io',
  },
  {
    description: 'In case you need to check some Remix specifics.',
    title: 'Remix Docs',
    url: 'https://remix.run/docs',
  },
  {
    description:
      'Maintain your flow by managing your Xata Workspace without ever leaving VS Code.',
    title: 'Xata VS Code Extension',
    url: 'https://marketplace.visualstudio.com/items?itemName=xata.xata',
  },
  {
    description: 'Get help. Offer help. Show us what you built!',
    title: 'Xata Discord',
    url: 'https://xata.io/discord',
  },
]
