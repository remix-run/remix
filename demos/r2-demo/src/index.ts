import { R2FileStorage } from '@remix-run/file-storage/r2'

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url)
    const storage = new R2FileStorage(env.r2_demo)

    if (request.method === 'GET' && url.pathname === '/') {
      const styles = `
        :root { color-scheme: light dark; }
        body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 840px; margin: 40px auto; padding: 20px; }
        header { display: flex; align-items: center; justify-content: space-between; }
        h1 { font-size: 1.4rem; margin: 0 0 10px; }
        .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
        .card { border: 1px solid #ddd; border-radius: 10px; padding: 16px; }
        label { font-weight: 600; font-size: .9rem; display: block; }
        input[type="text"], input[type="file"], input[type="number"] { width: 100%; padding: 10px; margin: 8px 0 14px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 8px; }
        button { background: #0b62d6; color: #fff; padding: 10px 14px; border: 0; border-radius: 8px; cursor: pointer; width: 100%; }
        button:hover { filter: brightness(0.95); }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .9rem; white-space: pre-wrap; }
        .row { display: flex; gap: 8px; align-items: center; }
        .row input[type="text"] { flex: 1; margin: 0; }
        .row button { width: auto; }
        small { color: #666; }
        .options { margin: 20px 0; padding: 14px; background: #0b62d6; border-radius: 8px; border: 1px solid #e5e5e5; }
        .options-title { font-weight: 600; font-size: .85rem; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        ul { list-style: none; padding: 0; margin: 0; }
        li { margin-bottom: 10px; }
        li:last-child { margin-bottom: 0; }
        li label { font-size: .85rem; }
        li input[type="text"] { margin: 6px 0 0; font-size: .9rem; }
        .range-nested { margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 6px; }
        .range-nested li { margin-bottom: 8px; }
        .range-nested li:last-child { margin-bottom: 0; }
        .range-nested label { font-size: .8rem; opacity: 0.9; }
        .range-nested input[type="text"] { padding: 8px; font-size: .85rem; }
      `
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>R2 Demo — One Page</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${styles}</style>
</head>
<body>
  <header>
    <h1>R2 Demo</h1>
    <small>All-in-one page</small>
  </header>

  <div class="grid">
    <section class="card">
      <h2>Upload</h2>
      <form id="uploadForm">
        <label>Key</label>
        <input type="text" id="up-key" placeholder="images/cat.jpg" required />
        <label>File</label>
        <input type="file" id="up-file" required />
        <button>Upload</button>
      </form>
      <small class="mono" id="uploadMsg"></small>
    </section>

    <section class="card">
      <h2>Get / View</h2>
      <form id="getForm">
        <label>Key</label>
        <input type="text" id="get-key" placeholder="images/cat.jpg" required />
        <div class="options">
          <div class="options-title">Optional Parameters</div>
          <ul>
            <li>
              <label>Only If</label>
              <ul class="range-nested">
                <li>
                  <label>ETag Match</label>
                  <input type="text" id="etag-match" placeholder="abc123..." />
                </li>
                <li>
                  <label>ETag Does Not Match</label>
                  <input type="text" id="etag-none-match" placeholder="xyz789..." />
                </li>
                <li>
                  <label>Uploaded Before</label>
                  <input type="text" id="uploaded-before" placeholder="2025-11-01T00:00:00Z" />
                </li>
                <li>
                  <label>Uploaded After</label>
                  <input type="text" id="uploaded-after" placeholder="2025-01-01T00:00:00Z" />
                </li>
              </ul>
            </li>
            <li>
              <label>Range</label>
              <ul class="range-nested">
                <li>
                  <label>Offset</label>
                  <input type="text" id="range-offset" placeholder="0" />
                </li>
                <li>
                  <label>Length</label>
                  <input type="text" id="range-length" placeholder="1024" />
                </li>
                <li>
                  <label>Suffix</label>
                  <input type="text" id="range-suffix" placeholder="100" />
                </li>
              </ul>
            </li>
            <li>
              <label>SSEC Key</label>
              <input type="text" id="ssec-key" placeholder="encryption key" />
            </li>
          </ul>
        </div>
        <button>Open in New Tab</button>
      </form>
      <small>Opens file in a new tab.</small>
    </section>

    <section class="card">
      <h2>Delete</h2>
      <form id="delForm" class="row">
        <input type="text" id="del-key" placeholder="images/cat.jpg" required />
        <button>Delete</button>
      </form>
      <small class="mono" id="delMsg"></small>
    </section>

    <section class="card">
      <h2>Has</h2>
      <form id="hasForm" class="row">
        <input type="text" id="has-key" placeholder="images/cat.jpg" required />
        <button>Check</button>
      </form>
      <small class="mono" id="hasMsg"></small>
    </section>

    <section class="card">
      <h2>List</h2>
      <form id="listForm">
        <label>Prefix</label>
        <input type="text" id="list-prefix" placeholder="images/" />
        <label>Limit</label>
        <input type="number" id="list-limit" min="1" max="1000" value="10" />
        <label>Cursor</label>
        <input type="text" id="list-cursor" placeholder="(optional)" />
        <button>List</button>
      </form>
      <pre class="mono" id="listOut"></pre>
    </section>
  </div>

  <script>
    const $ = (id) => document.getElementById(id)

    // Upload -> PUT /put
    $('uploadForm').addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData()
      fd.append('key', $('up-key').value)
      fd.append('file', $('up-file').files[0])
      const res = await fetch('/put', { method: 'PUT', body: fd })
      $('uploadMsg').textContent = res.ok ? 'Uploaded ✔︎' : await res.text()
      if (res.ok) e.target.reset()
    })

    // Get / View -> open /{key} with options
    $('getForm').addEventListener('submit', (e) => {
      e.preventDefault()
      const key = $('get-key').value.trim()
      if (!key) return
      const params = new URLSearchParams()
      const etagMatch = $('etag-match').value.trim()
      const etagNoneMatch = $('etag-none-match').value.trim()
      const uploadedBefore = $('uploaded-before').value.trim()
      const uploadedAfter = $('uploaded-after').value.trim()
      const rangeOffset = $('range-offset').value.trim()
      const rangeLength = $('range-length').value.trim()
      const rangeSuffix = $('range-suffix').value.trim()
      const ssecKey = $('ssec-key').value.trim()
      if (etagMatch) params.set('etag-match', etagMatch)
      if (etagNoneMatch) params.set('etag-none-match', etagNoneMatch)
      if (uploadedBefore) params.set('uploaded-before', uploadedBefore)
      if (uploadedAfter) params.set('uploaded-after', uploadedAfter)
      if (rangeOffset) params.set('range-offset', rangeOffset)
      if (rangeLength) params.set('range-length', rangeLength)
      if (rangeSuffix) params.set('range-suffix', rangeSuffix)
      if (ssecKey) params.set('ssec-key', ssecKey)
      const queryString = params.toString()
      const url = '/' + encodeURIComponent(key) + (queryString ? '?' + queryString : '')
      window.open(url, '_blank')
    })

    // Delete -> DELETE /remove?key=
    $('delForm').addEventListener('submit', async (e) => {
      e.preventDefault()
      const key = $('del-key').value.trim()
      const res = await fetch('/remove?key=' + encodeURIComponent(key), { method: 'DELETE' })
      $('delMsg').textContent = res.ok ? 'Deleted ✔︎' : await res.text()
      if (res.ok) e.target.reset()
    })

    // Has -> GET /has?key=
    $('hasForm').addEventListener('submit', async (e) => {
      e.preventDefault()
      const key = $('has-key').value.trim()
      const res = await fetch('/has?key=' + encodeURIComponent(key))
      $('hasMsg').textContent = res.ok ? 'Exists ✔︎' : 'Not found'
    })

    // List -> GET /list?prefix=&limit=&cursor=
    $('listForm').addEventListener('submit', async (e) => {
      e.preventDefault()
      const params = new URLSearchParams()
      const prefix = $('list-prefix').value.trim()
      const limit = $('list-limit').value
      const cursor = $('list-cursor').value.trim()
      if (prefix) params.set('prefix', prefix)
      if (limit) params.set('limit', limit)
      if (cursor) params.set('cursor', cursor)
      const res = await fetch('/list?' + params.toString())
      $('listOut').textContent = await res.text()
    })
  </script>
</body>
</html>`
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // Upload
    if (url.pathname === '/put' && request.method === 'PUT') {
      const form = await request.formData()
      const key = form.get('key')?.toString()
      const file = form.get('file') as File | null
      if (!key || !file) return new Response('Missing key or file', { status: 400 })
      await storage.put(key, file)
      return new Response('ok')
    }

    // Delete 
    if (url.pathname === '/remove' && request.method === 'DELETE') {
      const key = url.searchParams.get('key')
      if (!key) return new Response('Missing key', { status: 400 })
        
      try {
        await storage.remove(key)
        return new Response('ok')
      } catch {
        return new Response('File not found', { status: 404 })
      }
    }

    // Has
    if (url.pathname === '/has' && request.method === 'GET') {
      const key = url.searchParams.get('key')
      if (!key) {
        return new Response('Missing key', { status: 400 })
      }
      const exists = await storage.has(key)
      return new Response(exists ? 'exists' : 'missing', { status: exists ? 200 : 404 })
    }

    // List
    if (url.pathname === '/list' && request.method === 'GET') {
      const limit = url.searchParams.get('limit')
      const cursor = url.searchParams.get('cursor')
      const prefix = url.searchParams.get('prefix')
      const options: any = {}
      if (limit) options.limit = parseInt(limit)
      if (cursor) options.cursor = cursor
      if (prefix) options.prefix = prefix
      const result = await storage.list(options)
      return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } })
    }

   
    // get
    if (request.method === 'GET' && url.pathname !== '/') {
      const key = decodeURIComponent(url.pathname.slice(1))
      let options: any = {}
      
      const etagMatch = url.searchParams.get('etag-match')
      const etagNoneMatch = url.searchParams.get('etag-none-match')
      const uploadedBefore = url.searchParams.get('uploaded-before')
      const uploadedAfter = url.searchParams.get('uploaded-after')
      
      if (etagMatch || etagNoneMatch || uploadedBefore || uploadedAfter) {
        options.onlyIf = {}
        if (etagMatch) options.onlyIf.etagMatches = etagMatch  // Changed: etagMatches (plural)
        if (etagNoneMatch) options.onlyIf.etagDoesNotMatch = etagNoneMatch  // Changed: etagDoesNotMatch
        if (uploadedBefore) options.onlyIf.uploadedBefore = new Date(uploadedBefore)
        if (uploadedAfter) options.onlyIf.uploadedAfter = new Date(uploadedAfter)
      }
      
      
      const rangeOffset = url.searchParams.get('range-offset')
      const rangeLength = url.searchParams.get('range-length')
      const rangeSuffix = url.searchParams.get('range-suffix')
      
      if (rangeSuffix) {
        options.range = { suffix: parseInt(rangeSuffix) }
      } else if (rangeOffset || rangeLength) {
        options.range = {}
        if (rangeOffset) options.range.offset = parseInt(rangeOffset)
        if (rangeLength) options.range.length = parseInt(rangeLength)
      }
      
      const ssecKey = url.searchParams.get('ssec-key')
      if (ssecKey) {
        options.ssecKey = ssecKey
      }
      
      const file = await storage.get(key, options)
      if (!file) return new Response('File not found', { status: 404 })
      return new Response(file, {
        headers: {
          'Content-Type': file.type,
          'Content-Length': String(file.size),
        },
      })
    }

    return new Response('Not found', { status: 404 })
  },
}
