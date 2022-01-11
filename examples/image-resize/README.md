# Image Resize

It uses the excellent [https://sharp.pixelplumbing.com/](sharp) npm package

### Note

It requires a Node.js environment because sharp is a "native" package.

## Preview

Open this example on [CodeSandbox](https://codesandbox.com):

[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/s/github/remix-run/remix/tree/main/examples/image-resize)

## Example

From your terminal:

```sh
npm run dev
```

Visit
http://localhost:3000/ to view the resized images

## Image Component

The `Image` component is a simple wrapper which creates the resize url for our `/assets/resize/$.ts` route

```
http://localhost:3000/assets/resize/dog-1.jpg?w=600&h=600&fit=cover
```

- **/assets/resize** points to the routes/assets/resize/$.ts handler
- **/dog-1.jpg** points to an asset, it could also point to a nested path
- **w=600** the width you want the resized image to have
- **h=600** the height you want the resized image to have
- **fit=cover** one of the sharp fit options https://sharp.pixelplumbing.com/api-resize#resize

## More information

Since most of our images are served via a CDN, we don't have to save the resized images.
Instead we set cache headers for them and let the cdn cache them for us.

sharp uses a highly performant native package called libvips.
it's written in C and is extremely fast.

The implementation of the demo uses a stream based approach where the image is never stored in memory.
This means it's very good at handling images of any size, and is extremely performant.

Further improvements could be done by implementing

- [ETags](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag)
- [Srcset](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
- [Other image formats](https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types)

but that is out of scope for this demo.
