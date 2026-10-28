import type { Handle, RemixNode } from 'remix/component'
import { ImportMap } from 'remix/component/server'

import { assets, scriptEntry } from '../assets.ts'
import { images } from '../data/images.ts'
import {
  editionLinks,
  footerGroups,
  productGroups,
  whyCards,
  whyLinks,
} from '../data/navigation.ts'
import { signupHref } from '../data/pages.ts'
import { routes } from '../routes.ts'
import { CdnImage } from './media.tsx'

export interface DocumentProps {
  title: string
  description: string
  home?: boolean
  head?: RemixNode
  children: RemixNode
}

export function Document(handle: Handle<DocumentProps>) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={handle.props.description} />
        <meta name="theme-color" content="#000000" />
        <meta name="robots" content="noindex, nofollow" />
        <title>{handle.props.title} — Shopify demo</title>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://cdn.shopify.com" />
        <link
          rel="preload"
          as="font"
          href={assets.font}
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={assets.styles} />
        {handle.props.head}
        <ImportMap value={scriptEntry.importMap} />
        {scriptEntry.preloads.map((href) => (
          <link key={href} rel="modulepreload" href={href} />
        ))}
        <script type="module" src={scriptEntry.href} />
      </head>
      <body class={handle.props.home ? 'home' : 'inner-page'}>
        <a class="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{handle.props.children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}

function SiteHeader() {
  return () => (
    <header class="site-header">
      <div class="header-inner container">
        <a class="brand" href={routes.home.href()} aria-label="Shopify home">
          <img src={assets.logo} alt="Shopify" width="125" height="36" />
        </a>
        <nav class="desktop-nav" aria-label="Main navigation">
          <button class="nav-trigger" type="button" popoverTarget="why-menu">
            Why Shopify <span class="chevron" />
          </button>
          <div class="mega-menu why-menu" id="why-menu" popover>
            <div class="why-cards">
              {whyCards.map((link) => (
                <a key={link.href} class="why-card" href={link.href}>
                  <CdnImage
                    image={images[link.image]}
                    alt=""
                    sizes="(max-width: 1674px) 28vw, 466px"
                  />
                  <strong>{link.label}</strong>
                  <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
            <div class="menu-bottom">
              <span class="eyebrow">Built into every store</span>
              {whyLinks.map((link) => (
                <a key={link.href} href={link.href}>
                  {link.label} →
                </a>
              ))}
            </div>
          </div>
          <button class="nav-trigger" type="button" popoverTarget="products-menu">
            Products <span class="chevron" />
          </button>
          <div class="mega-menu products-menu" id="products-menu" popover>
            <div class="product-menu-grid">
              {productGroups.map((group) => (
                <div key={group.label}>
                  <p class="eyebrow">{group.label}</p>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <a href={link.href}>{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div class="menu-bottom editions-menu">
              <span class="eyebrow">Non-stop innovation</span>
              {editionLinks.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <a href={routes.pricing.href()}>Pricing</a>
          <a href={routes.marketing.enterprise.href()}>Enterprise</a>
        </nav>
        <div class="header-actions">
          <a class="login-link" href="https://www.shopify.com/login">
            Log in
          </a>
          <a class="button button-white button-small" href={signupHref}>
            Start for free
          </a>
          <div class="mobile-menu">
            <button type="button" popoverTarget="mobile-navigation" aria-label="Menu">
              <span class="menu-icon">
                <span />
              </span>
            </button>
            <nav class="mobile-panel" id="mobile-navigation" popover aria-label="Mobile navigation">
              <details>
                <summary>Why Shopify</summary>
                <ul>
                  {[...whyCards, ...whyLinks].map((link) => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </details>
              {productGroups.map((group) => (
                <details key={group.label}>
                  <summary>{group.label}</summary>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <a href={link.href}>{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
              <details>
                <summary>Shopify Editions</summary>
                <ul>
                  {editionLinks.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </details>
              <a href={routes.pricing.href()}>Pricing</a>
              <a href={routes.marketing.enterprise.href()}>Enterprise</a>
              <a href="https://www.shopify.com/login">Log in ↗</a>
            </nav>
          </div>
        </div>
      </div>
    </header>
  )
}

export function CallToAction() {
  return () => (
    <section class="closing-cta">
      <div class="container closing-grid">
        <div>
          <p class="eyebrow">Your next chapter starts here</p>
          <h2>Build fast on Shopify</h2>
          <ol class="start-steps">
            <li>
              <span>01</span> Add your first product
            </li>
            <li>
              <span>02</span> Customize your store
            </li>
            <li>
              <span>03</span> Set up payments
            </li>
          </ol>
          <a href={signupHref} class="button button-white">
            Take your shot <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div class="closing-images" aria-hidden="true">
          <CdnImage
            image={images['merchant-1']}
            alt=""
            sizes="(max-width: 600px) 220px, (max-width: 1674px) 23vw, 340px"
          />
          <CdnImage
            image={images['merchant-2']}
            alt=""
            sizes="(max-width: 600px) 220px, (max-width: 1674px) 23vw, 340px"
          />
        </div>
      </div>
    </section>
  )
}

function SiteFooter() {
  return () => (
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <a href={routes.home.href()} class="footer-brand" aria-label="Back to Shopify home">
            <img src={assets.logo} alt="Shopify" width="125" height="36" loading="lazy" />
          </a>
          {footerGroups.map((group) => (
            <div key={group.label}>
              <h2>{group.label}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div class="footer-bottom">
          <span>◎ USA | English</span>
          <nav aria-label="Legal">
            <a href="https://www.shopify.com/legal/terms">Terms of Service</a>
            <a href="https://www.shopify.com/legal">Legal</a>
            <a href="https://www.shopify.com/legal/privacy">Privacy Policy</a>
            <a href={routes.sitemap.href()}>Sitemap</a>
            <a href="https://privacy.shopify.com/en">Your Privacy Choices</a>
          </nav>
        </div>
        <div class="footer-social">
          <a href="https://www.instagram.com/shopify/">Instagram ↗</a>
          <a href="https://www.youtube.com/shopify">YouTube ↗</a>
          <a href="https://www.linkedin.com/company/shopify">LinkedIn ↗</a>
          <span>Remix 3 demo · Based on Shopify’s English marketing site</span>
        </div>
      </div>
    </footer>
  )
}
