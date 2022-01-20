import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string
      SUPABASE_SERVICE_KEY: string
      PUBLIC_SUPABASE_ANON_KEY: string
    }
  }
  interface Window {
    env: {
      SUPABASE_URL: string
      PUBLIC_SUPABASE_ANON_KEY: string
    }
  }
}

// Supabase options example (build your own :))
// https://supabase.com/docs/reference/javascript/initializing#with-additional-parameters

// const supabaseOptions = {
//   fetch, // see ⚠️ cloudflare
//   schema: "public",
//   persistSession: true,
//   autoRefreshToken: true,
//   detectSessionInUrl: true,
//   headers: { "x-application-name": "{my-site-name}" }
// };

// ⚠️ cloudflare needs you define fetch option : https://github.com/supabase/supabase-js#custom-fetch-implementation
// Use Remix fetch polyfill for node (See https://remix.run/docs/en/v1/other-api/node)
const isServer = typeof window === 'undefined'

function createSupabase() {
  if (isServer) {
    if (!process.env.SUPABASE_URL)
      throw new Error('SUPABASE_URL is required')

    if (!process.env.SUPABASE_SERVICE_KEY)
      throw new Error('SUPABASE_SERVICE_KEY is required')

    return createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY,
    )
  }

  if (!window.env.SUPABASE_URL)
    throw new Error('SUPABASE_URL is required')

  if (!window.env.PUBLIC_SUPABASE_ANON_KEY)
    throw new Error('PUBLIC_SUPABASE_ANON_KEY is required')

  // Browser environment will use anon key
  return createClient(
    window.env.SUPABASE_URL,
    window.env.PUBLIC_SUPABASE_ANON_KEY,
  )
}

export const supabaseClient = createSupabase()

export { Session }
