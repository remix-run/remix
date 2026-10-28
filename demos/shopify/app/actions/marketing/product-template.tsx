import type { Handle } from 'remix/component'

import { images } from '../../data/images.ts'
import type { ImageName } from '../../data/images.ts'
import { pageSummaries, signupHref } from '../../data/pages.ts'
import type { MarketingPageName, PageName } from '../../data/pages.ts'
import { routes } from '../../routes.ts'
import { CallToAction, Document } from '../../ui/document.tsx'
import { CdnImage } from '../../ui/media.tsx'

// On shopify.com, each marketing page has its own layout built from shared sections such as
// heroes, card grids, side-by-side features, testimonials, and FAQs. This demo renders every
// marketing page through this one template with simplified copy; see the marketing controller for
// how a production app would structure these pages instead.

export interface Feature {
  id?: string
  title: string
  description: string
}

export interface ProductTemplateProps {
  name: MarketingPageName
  title: string
  image: ImageName
  features: readonly Feature[]
  related: readonly PageName[]
}

export function ProductTemplate(handle: Handle<ProductTemplateProps>) {
  return () => {
    let { name, title, image, features, related } = handle.props
    let { label, description, theme } = pageSummaries[name]

    return (
      <Document title={label} description={description}>
        <section class={`product-hero theme-${theme}`}>
          <div class="container product-hero-grid">
            <div>
              <p class="eyebrow">{label}</p>
              <h1>{title}</h1>
              <p class="product-intro">{description}</p>
              <div class="product-hero-actions">
                <a class="button button-black" href={signupHref}>
                  Start for free <span aria-hidden="true">↗</span>
                </a>
                <a class="text-link" href="#explore">
                  See how it works ↓
                </a>
              </div>
            </div>
            <div class={`product-hero-image image-${theme}`}>
              <CdnImage
                image={images[image]}
                alt={`${label} with Shopify`}
                sizes="(max-width: 600px) calc(100vw - 70px), (max-width: 900px) calc(90vw - 40px), (max-width: 1674px) 40vw, 660px"
                priority
              />
            </div>
          </div>
        </section>
        <div class="product-subnav">
          <div class="container">
            <span>{label}</span>
            <a href="#explore">Overview</a>
            <a href="#connected">More to explore</a>
            <a href="#questions">FAQs</a>
          </div>
        </div>
        <section class="section-space product-features" id="explore">
          <div class="container">
            <div class="section-heading">
              <p class="eyebrow">Built around your business</p>
              <h2>
                The next step
                <br />
                starts here.
              </h2>
              <p>Bring your ideas, your products, and your customers together on Shopify.</p>
            </div>
            {features.map((feature, index) => (
              <article
                key={feature.title}
                class={`product-feature-row ${index % 2 === 1 ? 'reversed' : ''}`}
                id={feature.id}
              >
                <div class={`feature-number-art art-${theme}`}>
                  {index === 0 ? (
                    <CdnImage
                      image={images[image]}
                      alt={`${label} product preview`}
                      sizes="(max-width: 600px) calc(100vw - 110px), (max-width: 1674px) 38vw, 600px"
                    />
                  ) : (
                    <div class="feature-illustration" aria-hidden="true">
                      <span class="illustration-number">0{index + 1}</span>
                      <div class="illustration-window">
                        <span />
                        <span />
                        <span />
                        <div class="illustration-chart">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                        <strong>{index === 1 ? 'Make it yours.' : 'Keep growing.'}</strong>
                      </div>
                    </div>
                  )}
                </div>
                <div class="product-feature-copy">
                  <p class="eyebrow">
                    0{index + 1} / {label}
                  </p>
                  <h2>{feature.title}</h2>
                  <p>{feature.description}</p>
                  <a href={signupHref} class="text-link">
                    Get started →
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
        <RelatedPages names={related} />
        <section class="section-space faq-section" id="questions">
          <div class="container faq-grid">
            <div>
              <p class="eyebrow">A few helpful answers</p>
              <h2>
                Good questions.
                <br />
                Clear next steps.
              </h2>
            </div>
            <div>
              <details>
                <summary>How do I get started?</summary>
                <p>
                  Start with a Shopify store, then find these tools in your admin. The available
                  features depend on your plan, location, and store setup. See{' '}
                  <a href="https://help.shopify.com/en">Shopify’s Help Center</a> for current setup
                  steps.
                </p>
              </details>
              <details>
                <summary>Can I use it with my existing store?</summary>
                <p>
                  These tools connect to your Shopify business. If you are moving from another
                  platform, explore <a href={routes.marketing.sell.href()}>switching to Shopify</a>{' '}
                  and choose the migration approach that fits your catalog and team.
                </p>
              </details>
              <details>
                <summary>Which plan should I choose?</summary>
                <p>
                  Compare the <a href={routes.pricing.href()}>Shopify plans</a> to find the staff
                  access, selling tools, and features you need. Check the official plan details
                  before starting a subscription.
                </p>
              </details>
            </div>
          </div>
        </section>
        <CallToAction />
      </Document>
    )
  }
}

function RelatedPages(handle: Handle<{ names: readonly PageName[] }>) {
  return () => (
    <section class="section-space related-section" id="connected">
      <div class="container">
        <p class="eyebrow">Better together</p>
        <h2>
          There’s more
          <br />
          where that came from.
        </h2>
        <div class="related-grid">
          {handle.props.names.map((name) => {
            let page = pageSummaries[name]
            return (
              <a key={name} href={page.path} class={`related-card theme-${page.theme}`}>
                <span class="eyebrow">Explore Shopify</span>
                <h3>{page.label}</h3>
                <p>{page.description}</p>
                <span class="related-arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
