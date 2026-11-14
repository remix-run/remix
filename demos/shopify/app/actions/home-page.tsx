import { images, logos } from '../data/images.ts'
import { pages, signupHref } from '../data/pages.ts'
import { videos } from '../data/videos.ts'
import { routes } from '../routes.ts'
import { CallToAction, Document } from '../ui/document.tsx'

export function HomePage() {
  return () => (
    <Document
      home
      media
      title="Be the next AI all-star"
      description="Dream big and build fast on Shopify. The world’s best commerce platform."
    >
      <section class="home-hero">
        {/* The largest paint stays on this origin at full resolution. Chrome counts an upscaled
        image at its natural size, so a smaller poster cropped to a tall phone would lose LCP to the
        video's first frame. */}
        <img
          class="hero-image"
          src="/media/hero-poster.webp"
          alt=""
          width="1600"
          height="900"
          fetchPriority="high"
        />
        <video
          class="hero-image hero-video"
          data-video="hero"
          aria-label="Footage of Shopify merchants making sales, managing their business, and celebrating their success."
          width="1920"
          height="1080"
          preload="auto"
          muted
          loop
          playsInline
        >
          <source
            data-src={videos['hero-mobile.webm']}
            type='video/webm; codecs="av01.0.04M.08"'
            media="(max-width: 767px)"
          />
          <source
            data-src={videos['hero-mobile.mp4']}
            type='video/mp4; codecs="avc1.640020"'
            media="(max-width: 767px)"
          />
          <source
            data-src={videos['hero-desktop.webm']}
            type='video/webm; codecs="av01.0.08M.08"'
          />
          <source data-src={videos['hero-desktop.mp4']} type='video/mp4; codecs="avc1.640033"' />
        </video>
        <div class="hero-shade" />
        <div class="container hero-content">
          <h1>
            Be the next
            <br />
            <span>AI all-star</span>
          </h1>
          <div class="hero-bottom">
            <div>
              <p>Dream big and build fast on Shopify. The world’s best commerce platform.</p>
              <a href={signupHref} class="button button-white">
                Start for free
              </a>
            </div>
            <button class="button button-outline" type="button" data-pause-videos hidden>
              Pause animations
            </button>
          </div>
        </div>
      </section>

      <section class="merchant-section section-space" id="sell-everywhere">
        <div class="container">
          <fieldset class="merchant-picker">
            <legend class="visually-hidden">Explore ways to sell</legend>
            <input
              class="visually-hidden"
              type="radio"
              name="merchants"
              id="merchants-everywhere"
              checked
            />
            <input class="visually-hidden" type="radio" name="merchants" id="merchants-retail" />
            <input class="visually-hidden" type="radio" name="merchants" id="merchants-ai" />
            <input class="visually-hidden" type="radio" name="merchants" id="merchants-global" />
            <div class="merchant-labels">
              <label htmlFor="merchants-everywhere">Sell everywhere people shop.</label>
              <label htmlFor="merchants-retail">Online and in person.</label>
              <label htmlFor="merchants-ai">Across AI and on social.</label>
              <label htmlFor="merchants-global">Locally and globally.</label>
            </div>
            <div class="merchant-panel panel-everywhere">
              <a href={pages.online.path} class="merchant-preview preview-store">
                <img
                  {...images.online}
                  alt="An independent brand’s online storefront"
                  sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 900px) 30vw, (max-width: 1674px) 28vw, 466px"
                  loading="lazy"
                  decoding="async"
                />
                <span>Make your mark online ↗</span>
              </a>
              <a href={pages.pos.path} class="merchant-preview preview-retail">
                <img
                  {...images.pos}
                  alt="Shopify retail business"
                  sizes="(max-width: 600px) 320px, (max-width: 900px) 30vw, (max-width: 1674px) 28vw, 466px"
                  loading="lazy"
                  decoding="async"
                />
                <span>Bring your store to life ↗</span>
              </a>
              <a href={pages.shop.path} class="merchant-preview preview-shop">
                <img
                  {...images.shop}
                  alt="Products in the Shop shopping app"
                  sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 900px) 30vw, (max-width: 1674px) 28vw, 466px"
                  loading="lazy"
                  decoding="async"
                />
                <span>Find your next customer ↗</span>
              </a>
            </div>
            <div class="merchant-panel panel-retail">
              <div class="channel-feature">
                <img
                  {...images.pos}
                  alt="A retail business using Shopify"
                  sizes="(max-width: 600px) calc(100vw - 88px), (max-width: 1674px) 44vw, 750px"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <p class="eyebrow">Good things happen in store</p>
                  <h2>
                    Every location.
                    <br />
                    One business.
                  </h2>
                  <a class="text-link" href={pages.pos.path}>
                    Explore Shopify POS →
                  </a>
                </div>
              </div>
            </div>
            <div class="merchant-panel panel-ai">
              <div class="channel-feature">
                <img
                  {...images['agentic-storefronts']}
                  alt="A product buying experience in an AI chat"
                  sizes="(max-width: 600px) calc(100vw - 88px), (max-width: 1674px) 44vw, 750px"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <p class="eyebrow">A new way to be discovered</p>
                  <h2>
                    Join the
                    <br />
                    conversation.
                  </h2>
                  <a class="text-link" href={routes.agenticStorefronts.href()}>
                    Explore AI commerce →
                  </a>
                </div>
              </div>
            </div>
            <div class="merchant-panel panel-global">
              <div class="channel-feature">
                <img
                  {...images.international}
                  alt="A storefront with localized prices and currencies"
                  sizes="(max-width: 600px) calc(100vw - 88px), (max-width: 1674px) 44vw, 750px"
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <p class="eyebrow">Your world is getting bigger</p>
                  <h2>
                    Make yourself
                    <br />
                    at home. Everywhere.
                  </h2>
                  <a class="text-link" href={pages.international.path}>
                    Explore international selling →
                  </a>
                </div>
              </div>
            </div>
          </fieldset>
        </div>
      </section>

      <section class="ai-section section-space">
        <div class="container">
          <div class="section-heading">
            <p class="eyebrow">A new world of commerce</p>
            <h2>
              Your brand has
              <br />
              entered the chat
            </h2>
            <p>
              Get discovered across AI channels. Shoppers check out right in the chat. You don’t
              lift a finger. All powered by Agentic Storefronts.
            </p>
            <a class="text-link" href={routes.agenticStorefronts.href()}>
              Meet Agentic Storefronts →
            </a>
          </div>
          <div class="ai-display">
            <video
              data-video="viewport"
              width="2090"
              height="1742"
              poster={images['home-agentic-poster'].src}
              loading="lazy"
              preload="none"
              muted
              loop
              playsInline
              aria-label="Shopping with Agentic Storefronts"
            >
              <source data-src={videos['home-agentic.webm']} type='video/webm; codecs="vp9"' />
              <source
                data-src={videos['home-agentic.mp4']}
                type='video/mp4; codecs="hvc1.1.6.H150.B0"'
              />
            </video>
            <span class="ai-badge">Discovery. Conversation. Checkout.</span>
          </div>
        </div>
      </section>

      <section class="section-space black-section">
        <div class="container">
          <h2 class="section-title">
            Show up everywhere.
            <br />
            <span class="muted">Without going anywhere.</span>
          </h2>
          <div class="feature-grid home-features">
            <article>
              <div class="feature-image">
                <video
                  data-video="viewport"
                  width="1134"
                  height="680"
                  poster={images['home-store-poster'].src}
                  loading="lazy"
                  preload="none"
                  muted
                  loop
                  playsInline
                  aria-label="Build a Shopify store with AI"
                >
                  <source
                    data-src={videos['home-store.webm']}
                    type='video/webm; codecs="av01.0.05M.08"'
                  />
                  <source
                    data-src={videos['home-store.mp4']}
                    type='video/mp4; codecs="avc1.640032"'
                  />
                </video>
              </div>
              <a href={pages.online.path}>
                <h3>
                  Get a store that’s built to sell <span aria-hidden="true">↗</span>
                </h3>
              </a>
              <p>
                Start with a theme or an idea. Create a storefront that gives your products a place
                to shine.
              </p>
            </article>
            <article>
              <a href={pages.orders.path}>
                <div class="feature-image">
                  <img
                    {...images.analytics}
                    alt="The Shopify admin for managing a business"
                    sizes="(max-width: 600px) calc(157vw - 63px), (max-width: 1674px) 52vw, 850px"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <h3>
                  Control everything in one place <span aria-hidden="true">↗</span>
                </h3>
              </a>
              <p>
                Bring orders, inventory, payments, and customers into the same everyday workflow.
              </p>
            </article>
            <article>
              <a href={pages.channels.path}>
                <div class="feature-image">
                  <img
                    {...images.channels}
                    alt="Products available across multiple shopping channels"
                    sizes="(max-width: 600px) calc(111vw - 44px), (max-width: 1674px) 37vw, 600px"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <h3>
                  Sell on every channel <span aria-hidden="true">↗</span>
                </h3>
              </a>
              <p>
                Connect your catalog to the places people discover products, from social platforms
                to marketplaces.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section class="global-section section-space">
        <div class="container">
          <h2 class="section-title">
            Grow around
            <br />
            the world
          </h2>
          <div class="global-collage" aria-label="Products can reach customers around the world">
            <div class="global-product">
              <img
                {...images['global-customer-1']}
                alt="A product ready for international shipping"
                sizes="(max-width: 1674px) 30vw, 420px"
                loading="lazy"
                decoding="async"
              />
              <span>🇺🇸 Order received</span>
            </div>
            <div class="global-product">
              <img
                {...images['global-customer-2']}
                alt="A product reaching a new market"
                sizes="(max-width: 1674px) 30vw, 420px"
                loading="lazy"
                decoding="async"
              />
              <span>🇫🇷 Commande reçue</span>
            </div>
            <div class="global-product">
              <img
                {...images['global-customer-3']}
                alt="A product sold across borders"
                sizes="(max-width: 1674px) 30vw, 420px"
                loading="lazy"
                decoding="async"
              />
              <span>🇯🇵 ご注文ありがとうございます</span>
            </div>
            <div class="shipping-note">
              <span aria-hidden="true">◎</span>
              <div>
                <strong>Next stop: everywhere.</strong>
                <p>Your brand has places to go.</p>
              </div>
            </div>
          </div>
          <div class="international-demo">
            <video
              data-video="viewport"
              width="1248"
              height="1350"
              poster={images['home-global-poster'].src}
              loading="lazy"
              preload="none"
              muted
              loop
              playsInline
              aria-label="International selling and shipping"
            >
              <source
                data-src={videos['home-global.webm']}
                type='video/webm; codecs="av01.0.08M.08"'
              />
              <source data-src={videos['home-global.mp4']} type='video/mp4; codecs="avc1.640032"' />
            </video>
            <div class="split-caption">
              <h3>Sell across borders</h3>
              <div>
                <p>
                  Take the complexity out of international selling with Shopify Markets. Deliver
                  products faster and more affordably with built-in shipping tools.
                </p>
                <a class="text-link" href={pages.international.path}>
                  Explore international selling →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="section-space black-section">
        <div class="container">
          <h2 class="section-title">For anyone from entrepreneurs to enterprise</h2>
          <div class="business-grid">
            <a href={pages.start.path} class="business-card">
              <img
                src={images['home-guests-on-earth'].src}
                alt="Guests on Earth natural cleaning products"
                width="916"
                height="600"
                loading="lazy"
                decoding="async"
              />
              <div>
                <h3>Get started fast</h3>
                <p>
                  Jackie Prince launched <strong>Guests on Earth</strong> out of her home. Now it’s
                  a $4M+ business.
                </p>
              </div>
            </a>
            <a href={pages.sell.path} class="business-card">
              <img
                src={images['home-our-place'].src}
                alt="Our Place cookware products"
                width="916"
                height="600"
                loading="lazy"
                decoding="async"
              />
              <div>
                <h3>Grow as big as you want</h3>
                <p>
                  <strong>Our Place</strong> grew from a one-product shop into a cookware empire.
                </p>
              </div>
            </a>
            <a href={pages.enterprise.path} class="business-card">
              <img
                src={images['home-mattel'].src}
                alt="Mattel corporate headquarters"
                width="914"
                height="600"
                loading="lazy"
                decoding="async"
              />
              <div>
                <h3>Raise the bar</h3>
                <p>
                  Iconic toymaker <strong>Mattel</strong> sells direct to shoppers all around the
                  world. All powered by Shopify.
                </p>
              </div>
            </a>
          </div>
          <div class="centered">
            <a class="button button-outline" href={routes.pricing.href()}>
              Pick a plan that fits →
            </a>
          </div>
        </div>
      </section>

      <section class="sidekick-section section-space">
        <div class="container">
          <h2 class="section-title">
            Meet your secret
            <br />
            weapon, Sidekick
          </h2>
          <div class="sidekick-grid">
            <article class="sidekick-main">
              <video
                data-video="viewport"
                width="2016"
                height="872"
                poster={images['home-sidekick-reduced'].src}
                loading="lazy"
                preload="none"
                muted
                loop
                playsInline
                aria-label="Your very own commerce AI"
              >
                <source
                  data-src={videos['home-sidekick.webm']}
                  type='video/webm; codecs="av01.0.08M.08"'
                />
                <source
                  data-src={videos['home-sidekick.mp4']}
                  type='video/mp4; codecs="avc1.640033"'
                />
              </video>
              <div>
                <h3>Your very own commerce AI</h3>
                <p>
                  Work through ideas, get answers about your business, and make progress on the
                  tasks ahead.
                </p>
                <a href={pages.sidekick.path} class="text-link">
                  Meet your AI assistant →
                </a>
              </div>
            </article>
            <article class="sidekick-note">
              <video
                controls
                playsInline
                loading="lazy"
                preload="none"
                width="930"
                height="828"
                poster={images['testimonial-poster'].src}
                aria-label="How brands use Sidekick to build faster and smarter"
              >
                <source
                  src={videos['testimonial.webm']}
                  type='video/webm; codecs="av01.0.05M.08, opus"'
                />
                <source
                  src={videos['testimonial.mp4']}
                  type='video/mp4; codecs="avc1.640032, mp4a.40.2"'
                />
                <track
                  kind="captions"
                  src="/media/testimonial.vtt"
                  srcLang="en"
                  label="English"
                  default
                />
              </video>
              <h3>What winning looks like</h3>
              <p>Hear how brands use Sidekick to build faster and smarter.</p>
            </article>
          </div>
          <div class="apps-block">
            <div>
              <p class="eyebrow">Make it work your way</p>
              <h3>
                A whole world
                <br />
                of possibilities.
              </h3>
              <p>
                Find apps for the special things your business needs, from subscriptions and reviews
                to loyalty and fulfillment.
              </p>
              <a href="https://apps.shopify.com/" class="text-link">
                Explore the App Store ↗
              </a>
            </div>
            <img
              {...images.apps}
              alt="A collection of apps in the Shopify ecosystem"
              sizes="(max-width: 600px) max(490px, calc(100vw - 40px)), (max-width: 1674px) max(770px, 46vw), 800px"
              loading="lazy"
              decoding="async"
            />
          </div>
          <div class="developer-block">
            <div>
              <p class="eyebrow">Built for builders</p>
              <h3>
                Your vision.
                <br />
                The tools to build it.
              </h3>
              <p>
                Create a custom storefront, extend checkout, or build the next commerce tool with
                Shopify APIs and developer resources.
              </p>
              <a href={pages.ucp.path} class="text-link">
                Explore commerce for agents →
              </a>
              <a href="https://shopify.dev/" class="text-link">
                Visit Shopify.dev ↗
              </a>
            </div>
            <img
              {...images.developer}
              alt="Examples of custom commerce experiences built with Shopify tools"
              sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1674px) 48vw, 800px"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>

      <section class="platform-section section-space">
        <div class="container">
          <h2 class="section-title">There’s no better place for you to build</h2>
          <div class="checkout-block">
            <div>
              <p class="eyebrow">From cart to customer</p>
              <h3>
                Make the last step
                <br />
                the easy step.
              </h3>
              <p>Give shoppers familiar payment options and a checkout that keeps things moving.</p>
              <img
                class="shop-pay-logo"
                src={logos['shop-pay']}
                alt="Shop Pay"
                width="105"
                height="25"
                loading="lazy"
              />
              <a class="text-link" href={pages.checkout.path}>
                Explore Shopify Checkout →
              </a>
            </div>
            <div class="checkout-art">
              <img
                {...images.checkout}
                alt="Shopify Checkout with customer information and payment options"
                sizes="(max-width: 600px) calc(100vw - 100px), (max-width: 1674px) 38vw, 620px"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
          <div class="reliability-block">
            <video
              class="commerce-video"
              data-video="viewport"
              width="2736"
              height="2736"
              poster={images['home-globe-poster'].src}
              loading="lazy"
              preload="none"
              muted
              loop
              playsInline
              aria-label="Shopify commerce around the world"
            >
              <source data-src={videos['home-globe.webm']} type='video/webm; codecs="vp9"' />
              <source
                data-src={videos['home-globe.mov']}
                type='video/quicktime; codecs="hvc1.1.6.L153.B0"'
              />
            </video>
            <div>
              <p class="eyebrow">Built to keep up</p>
              <h3>Rock steady. Blazing fast.</h3>
              <p>Your Shopify store runs strong, even during your most epic product drops.</p>
              <a href={pages.enterprise.path} class="text-link">
                Build at scale →
              </a>
            </div>
          </div>
          <div class="capital-block">
            <div>
              <p class="eyebrow">Shopify Finance</p>
              <h3>
                A little momentum
                <br />
                goes a long way.
              </h3>
              <p>
                Keep business finances close to your commerce. Explore tools for managing money and
                funding your next step.
              </p>
              <a href={pages.finance.path} class="text-link">
                Explore your finance tools →
              </a>
            </div>
            <img
              {...images.finance}
              alt="Shopify tools for business finances"
              sizes="(max-width: 600px) calc(100vw - 40px), (max-width: 1674px) 43vw, 700px"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>
      <CallToAction />
    </Document>
  )
}
