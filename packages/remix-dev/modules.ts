declare module "*.aac" {
  const asset: string;
  export default asset;
}

// TODO: This isn't working right now because CSS modules still match `*.css`
// and I haven't yet figured out how to match all *except* for modules.
// See https://github.com/microsoft/TypeScript/issues/38638
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module "*.css" {
  const asset: string;
  export default asset;
}
declare module "*.eot" {
  const asset: string;
  export default asset;
}
declare module "*.flac" {
  const asset: string;
  export default asset;
}
declare module "*.gif" {
  const asset: string;
  export default asset;
}
declare module "*.jpeg" {
  const asset: string;
  export default asset;
}
declare module "*.jpg" {
  const asset: string;
  export default asset;
}
declare module "*.md" {
  import type { ComponentType as MdComponentType } from "react";
  export const attributes: any;
  export const filename: string;
  const Component: MdComponentType;
  export default Component;
}
declare module "*.mdx" {
  import type { ComponentType as MdxComponentType } from "react";
  export const attributes: any;
  export const filename: string;
  const Component: MdxComponentType;
  export default Component;
}
declare module "*.mp3" {
  const asset: string;
  export default asset;
}
declare module "*.mp4" {
  const asset: string;
  export default asset;
}
declare module "*.ogg" {
  const asset: string;
  export default asset;
}
declare module "*.otf" {
  const asset: string;
  export default asset;
}
declare module "*.png" {
  const asset: string;
  export default asset;
}
declare module "*.svg" {
  const asset: string;
  export default asset;
}
declare module "*.ttf" {
  const asset: string;
  export default asset;
}
declare module "*.wav" {
  const asset: string;
  export default asset;
}
declare module "*.webm" {
  const asset: string;
  export default asset;
}
declare module "*.webp" {
  const asset: string;
  export default asset;
}
declare module "*.woff" {
  const asset: string;
  export default asset;
}
declare module "*.woff2" {
  const asset: string;
  export default asset;
}
