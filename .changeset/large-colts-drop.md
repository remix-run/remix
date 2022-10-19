---
"remix": patch
"@remix-run/dev": patch
---

Ensure that any assets referenced in CSS files are hashed and copied to the `assetsBuildDirectory`.

Before this change, a CSS declaration like `background: url('./relative-path/image.png');` that references the file `./relative-path/image.png` will not copy that file to the build directory. This can be a problem if you use a custom build directory, or when dealing with third-party stylesheets in `node_modules` that reference their own relative files.
