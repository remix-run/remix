import { clientEntry } from 'remix/ui'
import { createController } from 'remix/router'

import { render } from '../../config/render.tsx'
import { routes } from '../../config/routes.ts'
import { discoverDemoFiles, findDemoFile, loadDemoModule } from './discovery.ts'
import { DemoDocument, DemoIndexDocument } from './view.tsx'

const demosController = createController(routes.demos, {
  actions: {
    index(context) {
      return render(context, <DemoIndexDocument demos={discoverDemoFiles()} />, {
        headers: {
          'Cache-Control': 'no-store',
        },
      })
    },

    async show(context) {
      let demo = findDemoFile(context.params.filename)
      if (!demo) {
        return new Response('Demo not found', {
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
            'Content-Type': 'text/plain; charset=utf-8',
          },
        })
      }

      let serverComponent = demo.ssr ? await loadDemoModule(demo) : () => () => null
      let DemoComponent = clientEntry(`${demo.assetHref}#default`, serverComponent)

      return render(context, <DemoDocument DemoComponent={DemoComponent} demo={demo} />, {
        headers: {
          'Cache-Control': 'no-store',
        },
      })
    },
  },
})

export default demosController
