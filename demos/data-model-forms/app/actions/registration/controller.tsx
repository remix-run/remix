import { createController } from 'remix/router'

import { AssetEntry } from '../../middleware/asset-entry.ts'
import { routes } from '../../routes.ts'
import { DemoPage } from './page.tsx'

export default createController(routes.registration, {
  actions: {
    index({ get, render }) {
      return render(<DemoPage assetEntry={get(AssetEntry)} />)
    },
    action({ get, render }) {
      return render(<DemoPage assetEntry={get(AssetEntry)} />)
    },
  },
})
