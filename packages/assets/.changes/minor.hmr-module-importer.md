Browser HMR can now use a custom module importer when dynamically importing updated JavaScript modules. Set `hmr.moduleImporter` to a module specifier resolved relative to the asset server's root directory. The browser module must export `importModule(specifier, parentUrl)`.

HMR appends mappings for updated modules to the document in additional `<script type="importmap">` elements. Use `remix/multiple-import-maps-polyfill` when these updates must work in browsers without native support for multiple import maps:

```ts
import { createAssetServer } from 'remix/assets'
import { createBrowserHmrChannel } from 'remix/node-hmr/runtime'

let assets = createAssetServer({
  hmr: {
    channel: createBrowserHmrChannel,
    moduleImporter: 'remix/multiple-import-maps-polyfill',
  },
  watch: true,
})
```
