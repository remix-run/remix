export function SiteFooter() {
  return () => (
    <footer aria-label="Site footer" class="site-footer">
      <div class="site-footer__links">
        <a href="https://remix.run" aria-label="Remix" class="site-footer__brand">
          <img src="/remix-wordmark-light-mode.svg" alt="" />
        </a>
        <nav aria-label="Find us on the web" class="site-footer__social">
          <a href="https://github.com/remix-run" aria-label="GitHub">
            <svg aria-hidden="true" fill="none">
              <use href="/icons.svg#github" />
            </svg>
          </a>
          <a href="https://x.com/remix_run" aria-label="X">
            <svg aria-hidden="true" fill="none">
              <use href="/icons.svg#x" />
            </svg>
          </a>
          <a href="https://youtube.com/remix_run" aria-label="YouTube">
            <svg aria-hidden="true" fill="none">
              <use href="/icons.svg#youtube" />
            </svg>
          </a>
          <a href="https://remix.run/discord" aria-label="Discord">
            <svg aria-hidden="true" fill="none">
              <use href="/icons.svg#discord" />
            </svg>
          </a>
        </nav>
      </div>
      <div class="site-footer__legal">
        <p>docs and examples licensed under mit</p>
        <p>&copy;{new Date().getFullYear()} Shopify, Inc.</p>
      </div>
    </footer>
  )
}
