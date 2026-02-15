import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  plugins: [nitro()],
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          input: './server.ts',
        },
      },
    },
    client: {
      build: {
        rollupOptions: {
          input: './app/components/client.ts',
        },
      },
    },
  },
})
