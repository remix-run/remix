// images
declare module "*.(apng|avif|gif|ico|jfif|jpeg|jpg|pjp|pjpeg|png|svg|webp)" {
  let asset: string
  export default asset
}

// media
declare module "*.(aac|flac|mov|mp3|mp4|ogg|opus|wav|webm)" {
  let asset: string
  export default asset
}

// fonts
declare module '*.(eot|otf|ttf|woff|woff2)' {
  let asset: string
  export default asset
}

// other
declare module "*.(module.css)" {
  let styles: {
      readonly [key: string]: string;
  };
  export default styles;
}

declare module '*.(css|csv|fbx|glb|gltf|gql|graphql|hdr|pdf|psd|sql|txt|wasm|webmanifest|zip)' {
  let asset: string
  export default asset
}

declare module "*.(md|mdx)" {
  import "mdx";
  let attributes: any;
  let filename: string;
}