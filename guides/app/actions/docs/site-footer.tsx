import { Icon } from '../../ui/icon.tsx'

export function SiteFooter() {
  return () => (
    <footer aria-label="Site footer" class="site-footer">
      <div class="site-footer__links">
        <a href="https://remix.run" aria-label="Remix" class="site-footer__brand">
          <img src="/remix-wordmark-light-mode.svg" alt="" />
        </a>
        <nav aria-label="Find us on the web" class="site-footer__social">
          <a href="https://github.com/remix-run" aria-label="GitHub">
            <Icon name="github" />
          </a>
          <a href="https://x.com/remix_run" aria-label="X">
            <Icon name="x" />
          </a>
          <a href="https://youtube.com/remix_run" aria-label="YouTube">
            <Icon name="youtube" />
          </a>
          <a href="https://remix.run/discord" aria-label="Discord">
            <Icon name="discord" />
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
