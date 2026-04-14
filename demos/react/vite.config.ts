import react from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'
import { defineConfig } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'

import { reactServerFrame } from 'react-server-frame/vite/plugin'

export default defineConfig({
  plugins: [reactServerFrame(), react(), rsc(), devtoolsJson()],
})
