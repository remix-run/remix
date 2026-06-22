import { readdir, stat } from 'node:fs/promises'

const devRefreshVersion = Date.now().toString(36)
const docsChaptersUrl = new URL('./controllers/docs/chapters/', import.meta.url)

// Temporary guides-only refresh hook. Delete this when first-class HMR lands.
export async function devRefreshHandler() {
  return new Response(JSON.stringify({ version: await getDevRefreshVersion() }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

async function getDevRefreshVersion() {
  let latestMarkdownUpdate = 0

  for (let entry of await readdir(docsChaptersUrl, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue
    }

    let stats = await stat(new URL(entry.name, docsChaptersUrl))
    latestMarkdownUpdate = Math.max(latestMarkdownUpdate, stats.mtimeMs)
  }

  return `${devRefreshVersion}:${latestMarkdownUpdate}`
}
