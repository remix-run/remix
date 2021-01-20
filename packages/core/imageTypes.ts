declare module "img:*" {
  const asset: ImageAsset;
  export default asset;
}

/**
 * Image urls and metadata for images imported into applications.
 */
interface ImageAsset {
  /**
   * The url of the image. When using srcset, it's the last size defined.
   */
  src: string;

  /**
   * The width of the image. When using srcset, it's the last size defined.
   */
  width: number;

  /**
   * The height of the image. When using srcset, it's the last size defined.
   */
  height: number;

  /**
   * The string to be passed do `<img srcSet />` for responsive images. Sizes
   * defined by the asset import `srcset=...sizes` query string param, like
   * `./file.jpg?srcset=720,1080`.
   */
  srcset: string;

  /**
   * Base64 string that can be inlined for immediate render and scaled up. Typically set as the background
   * of an image:
   *
   * ```jsx
   * <img
   *   src={img.src}
   *   style={{
   *     backgroundImage: `url(${img.placeholder})`,
   *     backgroundSize: "cover"
   *   }}
   * />
   * ```
   */
  placeholder: string;

  /**
   * The image format.
   */
  format: "jpeg" | "png" | "webp" | "avif";
}
