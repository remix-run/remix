import { html, render } from '../lib/render.ts'

export function homeHandler(): Response {
  return render(
    'UNPKG - npm package browser',
    html`
      <h1><span class="brand">UNPKG</span></h1>
      <div class="home-content">
        <p>Browse the contents of any npm package by entering its name in the URL.</p>
        <p>
          For example, visit <code>/lodash</code> to browse the latest version of lodash, or
          <code>/react@18</code> to browse React version 18.
        </p>
        <p>
          You can also browse specific files by adding the file path, like
          <code>/lodash/package.json</code>.
        </p>

        <div class="examples">
          <h2>Try these packages:</h2>
          <ul>
            <li><a href="/@remix-run/cookie">@remix-run/cookie</a> - scoped package</li>
            <li><a href="/react">react</a> - UI library</li>
            <li><a href="/express">express</a> - web framework</li>
            <li><a href="/typescript@5">typescript@5</a> - specific major version</li>
          </ul>
        </div>
      </div>
    `,
  )
}
