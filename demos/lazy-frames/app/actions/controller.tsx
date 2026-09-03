import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { demoLatencyContext, serializeDemoLatency } from '../middleware/demo-latency.ts'
import { themeContext } from '../middleware/theme.ts'
import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'
import { HomePage } from './home.tsx'

export default createController(routes, {
  actions: {
    async assets({ request }) {
      let response = await assets.fetch(request)
      return response ?? new Response('Not found', { status: 404 })
    },

    home({ get, render }) {
      return render(<HomePage latency={get(demoLatencyContext)} theme={get(themeContext)} />)
    },

    async latency({ request }) {
      let formData = await request.formData()
      let enabled = formData.get('enabled')
      if (enabled !== 'true' && enabled !== 'false') {
        return new Response('Expected enabled to be true or false', { status: 400 })
      }

      return redirect(routes.home.href(), {
        status: 303,
        headers: { 'Set-Cookie': await serializeDemoLatency(enabled === 'true') },
      })
    },
  },
})
