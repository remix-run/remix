import { forwardRef } from "react";
import type { FitEnum } from "sharp";

export interface ImageProps extends React.ComponentPropsWithRef<"img"> {
  src: string; // a path within the assets/images directory, can be a nested path
  width?: number; // either width or height is required
  height?: number;
  fit?: keyof FitEnum; // contain is default
  alt: string;
}
const Image = forwardRef<HTMLImageElement, ImageProps>(
  ({ children, width, height, fit, src, alt = "", ...other }, forwardedRef) => {
    const query = new URLSearchParams();
    if (width) {
      query.set("w", width.toString());
    }
    if (height) {
      query.set("h", height.toString());
    }
    if (fit) {
      query.set("fit", fit);
    }
    return (
      <img
        ref={forwardedRef}
        alt={alt}
        src={`/assets/resize/${src}?${query.toString()}`}
        {...{ width, height, ...other }}
      />
    );
  }
);

Image.displayName = "Image";
