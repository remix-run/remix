---
"remix": patch
"@remix-run/dev": patch
---

add CSS plugin to `esbuild` so that any assets in css files are also copied (and hashed) to the `assetsBuildDirectory`

currently if you import a css file that has `background: url('./relative.png');` the `relative.png` file is not copied to the build directory, which is a problem when dealing with npm packages that have css files with font files in them like fontsource
