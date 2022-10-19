# `remix`

## 1.7.3-pre.0

### Patch Changes

- Add support for setting `moduleResolution` to `node`, `node16` or `nodenext` in `tsconfig.json`. ([#4034](https://github.com/remix-run/remix/pull/4034))
- Add resources imported only by resource routes to `assetsBuildDirectory` ([#3841](https://github.com/remix-run/remix/pull/3841))
- Ensure that any assets referenced in CSS files are hashed and copied to the `assetsBuildDirectory`. ([#4130](https://github.com/remix-run/remix/pull/4130))

  Before this change, a CSS declaration like `background: url('./relative-path/image.png');` that references the file `./relative-path/image.png` will not copy that file to the build directory. This can be a problem if you use a custom build directory, or when dealing with third-party stylesheets in `node_modules` that reference their own relative files.

- Ensure that `<Form />` respects the `formMethod` attribute set on the submitter element ([#4053](https://github.com/remix-run/remix/pull/4053))

  ```tsx
  <Form>
    <button type="submit">GET request</button>
    <button type="submit" formMethod="post">
      POST request
    </button>
  </Form>
  ```

- Fixed a bug that affected `.wav` and `.webm` audio file imports ([#4290](https://github.com/remix-run/remix/pull/4290))
- Updated the `@remix-run/web-fetch` dependency. This fixes issues with `{Request | Response}.clone()` throwing when body is `null`. This update also adds additional Node.js-specific types to `fetch()` to support the use of `agent` from `http` and `https`. ([#4277](https://github.com/remix-run/remix/pull/4277))

See the `CHANGELOG.md` in individual Remix packages for all changes.
