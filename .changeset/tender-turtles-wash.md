---
"remix": patch
"@remix-run/dev": patch
---

When running the dev server (current or `unstable_dev`), each rebuild wrote new files to `build/` and `public/build/`.
Since these files are not removed (unless the dev server crashes or is gracefully terminated),
thousands of files could accumulate as the dev server ran.
This causes performance issues and could be confusing.

Now, the dev server also cleans up the build directories whenever a rebuild starts.
