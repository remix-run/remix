export function renderLazyPanel(): HTMLElement {
  let panel = document.createElement('div')
  panel.style.background = '#082f49'
  panel.style.borderRadius = '0.9rem'
  panel.style.padding = '1rem'
  panel.innerHTML = `
    <strong>Lazy panel loaded.</strong>
    <p style="margin-bottom: 0;">
      This module came from a dynamic <code>import()</code>, so you can also edit it and refresh
      to verify the running script server picks up the change.
    </p>
  `
  return panel
}
