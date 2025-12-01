import { html, render } from './utils/render.ts'

export function renderError(title: string, message: string): Response {
  return render(
    title,
    html`
      <h1>${title}</h1>
      <div class="error">
        <p>${message}</p>
      </div>
      <p style="margin-top: 1rem;">
        <a href="/">Back to home</a>
      </p>
    `,
    { status: 404 },
  )
}
