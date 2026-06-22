const devRefreshVersion = Date.now().toString(36)

// Temporary guides-only refresh hook. Delete this when first-class HMR lands.
export function devRefreshHandler() {
  return new Response(JSON.stringify({ version: devRefreshVersion }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}
