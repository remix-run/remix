declare module "*.aac" {
  let asset: string;
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
  let asset: any;
  export default asset;
}
declare module "*.eot" {
  let asset: string;
  export default asset;
}
declare module "*.flac" {
  let asset: string;
  export default asset;
}
declare module "*.gif" {
  let asset: string;
  export default asset;
}
declare module "*.jpeg" {
  let asset: string;
  export default asset;
}
declare module "*.jpg" {
  let asset: string;
  export default asset;
}
declare module "*.md" {
  import type { ComponentType as MdComponentType } from "react";
  export let attributes: any;
  export let filename: string;
  let Component: MdComponentType;
  export default Component;
}
declare module "*.mdx" {
  import type { ComponentType as MdxComponentType } from "react";
  export let attributes: any;
  export let filename: string;
  let Component: MdxComponentType;
  export default Component;
}
declare module "*.mp3" {
  let asset: string;
  export default asset;
}
declare module "*.mp4" {
  let asset: string;
  export default asset;
}
declare module "*.ogg" {
  let asset: string;
  export default asset;
}
declare module "*.otf" {
  let asset: string;
  export default asset;
}
declare module "*.png" {
  let asset: string;
  export default asset;
}
declare module "*.svg" {
  let asset: string;
  export default asset;
}
declare module "*.ttf" {
  let asset: string;
  export default asset;
}
declare module "*.wav" {
  let asset: string;
  export default asset;
}
declare module "*.webm" {
  let asset: string;
  export default asset;
}
declare module "*.webp" {
  let asset: string;
  export default asset;
}
declare module "*.woff" {
  let asset: string;
  export default asset;
}
declare module "*.woff2" {
  let asset: string;
  export default asset;
}
declare module "*.webmanifest" {
  let asset: string;
  export default asset;
}
