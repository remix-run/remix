BREAKING CHANGE: Shared compiler options are now provided at the top level of `createAssetServer()`. Use `sourceMaps`, `sourceMapSourcePaths`, and `minify` directly on the asset server options instead of being nested under `scripts`. This allows these options to also be used for styles as well as scripts.

To migrate existing configuration, move `scripts.minify`, `scripts.sourceMaps`, `scripts.sourceMapSourcePaths` to the top-level asset server options.
