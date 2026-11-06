import { css, type Handle } from 'remix/component'

export interface ProductImageSource {
  src: string
  srcset?: string
  /** Width and height in CSS pixels. Product photos are square. */
  size: number
}

export interface ProductImageProps {
  image: ProductImageSource
  /** Leave empty when a visible label next to the image already names the product. */
  alt?: string
  loading?: 'eager' | 'lazy'
  fetchpriority?: 'high' | 'low' | 'auto'
}

/**
 * Renders a product photo with explicit dimensions so the layout never shifts while it loads.
 */
export function ProductImage(handle: Handle<ProductImageProps>) {
  return () => {
    let { image, alt = '', loading = 'lazy', fetchpriority } = handle.props

    return (
      <img
        src={image.src}
        srcset={image.srcset}
        width={image.size}
        height={image.size}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchpriority={fetchpriority}
        mix={imageStyle}
      />
    )
  }
}

// Multiply blends the photos' near-white studio backgrounds into whatever surface they sit on.
const imageStyle = css({
  display: 'block',
  flexShrink: 0,
  objectFit: 'contain',
  mixBlendMode: 'multiply',
})
