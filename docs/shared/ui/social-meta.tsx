import type { Handle } from 'remix/component'

export interface DocsSocialMetaProps {
  /** Site name shown above the title in link previews, e.g. "Remix Docs". */
  siteName: string
  /** Absolute URL of the page. */
  url: string
  title: string
  description?: string
  /** Absolute URL of a 1200x630 preview image. */
  image: string
  imageAlt: string
}

/**
 * Canonical, Open Graph and Twitter card tags for link previews. Every tag is keyed so
 * client-side navigation updates them in place.
 */
export function DocsSocialMeta(handle: Handle<DocsSocialMetaProps>) {
  return () => {
    let { siteName, url, title, description, image, imageAlt } = handle.props

    return [
      <link key="canonical" data-rmx-key="docs-canonical" rel="canonical" href={url} />,
      <meta key="og:type" data-rmx-key="docs-og-type" property="og:type" content="website" />,
      <meta
        key="og:site_name"
        data-rmx-key="docs-og-site-name"
        property="og:site_name"
        content={siteName}
      />,
      <meta key="og:title" data-rmx-key="docs-og-title" property="og:title" content={title} />,
      description ? (
        <meta
          key="og:description"
          data-rmx-key="docs-og-description"
          property="og:description"
          content={description}
        />
      ) : null,
      <meta key="og:url" data-rmx-key="docs-og-url" property="og:url" content={url} />,
      <meta key="og:image" data-rmx-key="docs-og-image" property="og:image" content={image} />,
      <meta
        key="og:image:width"
        data-rmx-key="docs-og-image-width"
        property="og:image:width"
        content="1200"
      />,
      <meta
        key="og:image:height"
        data-rmx-key="docs-og-image-height"
        property="og:image:height"
        content="630"
      />,
      <meta
        key="og:image:alt"
        data-rmx-key="docs-og-image-alt"
        property="og:image:alt"
        content={imageAlt}
      />,
      <meta
        key="twitter:card"
        data-rmx-key="docs-twitter-card"
        name="twitter:card"
        content="summary_large_image"
      />,
      <meta
        key="twitter:site"
        data-rmx-key="docs-twitter-site"
        name="twitter:site"
        content="@remix_run"
      />,
    ]
  }
}
