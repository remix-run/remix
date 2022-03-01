declare module "*.aac" {
  const asset: string;
  export default asset;
}

declare module "*.css" {
  // This needs to be any because TS cannot differentiate between *.css &
  // *.module.css. In an ideal world we could make it an object for modules and
  // a string for regular CSS, but in practice I don't think the typing provides
  // much value in either scenario. For users to get TS benefits w/ modules
  // they'd need a declaration file for individual CSS module files. Would be
  // nice if we could generate that for them.
  //
  // See https://github.com/microsoft/TypeScript/issues/38638 for TS limitations
  // with wildcard matching.
  const asset: any;
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
