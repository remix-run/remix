import { images, logos } from '../data/images.ts'
import { videos } from '../data/videos.ts'
import { Document } from '../ui/document.tsx'

const signupHref =
  'https://admin.shopify.com/signup?locale=en&language=en&signup_page=https%3A%2F%2Fwww.shopify.com%2Fagentic-storefronts&signup_types%5B%5D=paid_trial_experience'
const salesHref = 'https://www.shopify.com/agentic-storefronts#contact-sales'

const features = [
  {
    name: 'chats',
    title: 'Sell directly in chats',
    description:
      'With Agentic Storefronts, your products show up instantly in ChatGPT, Gemini, and more. Shoppers discover and buy without leaving the chat.',
  },
  {
    name: 'ready',
    title: 'AI-ready by default',
    description:
      'Shopify Catalog automatically structures your product data so AI can find and surface your products. Buyers get accurate, real-time results.',
  },
  {
    name: 'checkout',
    title: 'The world’s best checkout',
    description:
      'Sales run through Shopify Checkout, powering 14% of US e-commerce. Fast, flexible, secure, and works with your payment processor.',
  },
  {
    name: 'data',
    title: 'Your customers. Your data.',
    description:
      'Orders flow into your Shopify admin. You own the customer relationship and decide where product data is shared.',
  },
] as const

const adminSlides = [
  {
    title: 'All your AI orders in one place',
    image: images['agentic-admin-1'],
    description:
      'Shopify is the one admin you need for everywhere you sell—online, POS, social channels, and now AI chats.',
    alt: 'Shopify admin Agentic dashboard showing agentic storefronts active, $103,813 earned and 8,935 agentic sessions in the last 30 days, with order counts across ChatGPT, Google AI Mode, Copilot, and Meta.',
  },
  {
    title: 'Accurate data from the source',
    image: images['agentic-admin-2'],
    description:
      'Shopify Catalog and Knowledge Base let agents surface your verified product and brand data from your store.',
    alt: 'Shopify admin Agentic catalog search for “Stylish table lamp” showing the Orange Silo Lamp in the top 10, with listing insights for description completeness, image coverage, price competitiveness, and shop policy completeness.',
  },
  {
    title: 'Clarity on what’s working',
    image: images['agentic-admin-3'],
    description:
      'Track your AI sales and see where buyers are finding you with clear labels and reporting.',
    alt: 'Shopify admin Agentic dashboard with the total sales metric selector open, showing sales by AI channel and a list of searches where the store’s products appeared.',
  },
]

const testimonials = [
  {
    name: 'monos',
    image: images['agentic-monos'],
    brand: 'Monos',
    author: 'Victor Tam — CEO and Co-Founder',
    quote:
      'It’s a new way for our story and product details to show up at the exact moment someone is asking real questions with real intent.',
    alt: 'Two silver Monos suitcases on a stone walkway, with an AI chat prompt asking for carry-on recommendations.',
  },
  {
    name: 'steve-madden',
    image: images['agentic-steve-madden'],
    brand: 'Steve Madden',
    author: 'Colleen Waters — VP of Ecommerce',
    quote:
      'Being on Shopify means we can automatically be wherever our customers are shopping—including inside AI conversations.',
    alt: 'A woman sitting on wooden stairs wearing a knit cardigan, jeans, and hightop sneakers, with an AI chat prompt asking for flat shoe suggestions.',
  },
]

export function AgenticPage() {
  return () => (
    <Document
      title="Agentic Storefronts: Sell in AI chats"
      description="Reach new buyers in AI chats and manage it all in one place with Shopify Agentic Storefronts."
      stylesheet="/agentic.css"
      media
    >
      <div class="agentic-page">
        <section class="agentic-hero" aria-labelledby="agentic-title">
          <div class="container agentic-hero-grid">
            <div class="agentic-hero-copy">
              <p class="agentic-eyebrow">Agentic Storefronts</p>
              <h1 id="agentic-title">
                AI shopping is here.
                <br />
                Start selling.
              </h1>
              <p class="agentic-intro">
                Reach new buyers in AI chats and manage it all in one place with Shopify.
              </p>
              <div class="agentic-buttons">
                <a class="button button-white" href={signupHref}>
                  Start for free
                </a>
                <a class="button button-outline" href={salesHref}>
                  Talk to sales on Shopify
                </a>
              </div>
              <button class="agentic-motion" type="button" data-pause-videos hidden>
                Pause animations
              </button>
            </div>
            <video
              class="agentic-hero-video"
              width="1440"
              height="1440"
              muted
              loop
              playsInline
              preload="auto"
              poster="/media/agentic-hero-poster.webp"
              data-video="hero"
              aria-label="Phone screens showing AI chat shopping for a lamp, with product details and Shopify Checkout. Logos of OpenAI, Google, Microsoft and Meta."
            >
              <source
                data-src={videos['agentic-hero-av1.mp4']}
                type={'video/mp4; codecs="av01.0.08M.08"'}
              />
              <source
                data-src={videos['agentic-hero-h264.mp4']}
                type='video/mp4; codecs="avc1.640033"'
              />
            </video>
          </div>
        </section>

        <div class="agentic-partners container" aria-label="AI shopping partners">
          <img src={logos.openai} alt="OpenAI" width="160" height="90" />
          <img src={logos.google} alt="Google" width="160" height="90" />
          <img src={logos.microsoft} alt="Microsoft" width="210" height="90" />
          <img src={logos.meta} alt="Meta" width="170" height="90" />
        </div>

        <section class="agentic-features" id="explore" aria-labelledby="agentic-features-title">
          <div class="container">
            <h2 id="agentic-features-title">
              From discovery to checkout,
              <br />
              Shopify runs it all.
            </h2>
            <div class="agentic-feature-grid">
              {features.map((feature) => (
                <article key={feature.name}>
                  <video
                    width="1920"
                    height="1080"
                    loading="lazy"
                    muted
                    loop
                    playsInline
                    preload="none"
                    poster={images[`agentic-${feature.name}-poster`].src}
                    data-video="viewport"
                    aria-label={feature.title}
                  >
                    <source
                      data-src={videos[`agentic-${feature.name}-av1.mp4`]}
                      type={'video/mp4; codecs="av01.0.08M.08"'}
                    />
                    <source
                      data-src={videos[`agentic-${feature.name}-h264.mp4`]}
                      type='video/mp4; codecs="avc1.640033"'
                    />
                  </video>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section class="agentic-admin" aria-labelledby="agentic-admin-title">
          <div class="container">
            <h2 id="agentic-admin-title">See Agentic Storefronts in action</h2>
            <fieldset class="agentic-admin-picker">
              <legend class="visually-hidden">Explore Agentic Storefronts in Shopify admin</legend>
              {adminSlides.map((slide, index) => (
                <input
                  key={slide.title}
                  class="visually-hidden"
                  type="radio"
                  name="agentic-admin"
                  id={`agentic-admin-${index + 1}`}
                  checked={index === 0}
                />
              ))}
              <div class="agentic-admin-labels">
                {adminSlides.map((slide, index) => (
                  <label key={slide.title} htmlFor={`agentic-admin-${index + 1}`}>
                    <span class="agentic-slide-title">{slide.title}</span>
                    <span class="agentic-slide-description">{slide.description}</span>
                  </label>
                ))}
              </div>
              <div class="agentic-admin-images">
                {adminSlides.map((slide, index) => (
                  <img
                    key={slide.title}
                    class={`agentic-admin-image agentic-admin-image-${index + 1}`}
                    src={slide.image.src}
                    alt={slide.alt}
                    width="2175"
                    height="1800"
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section class="agentic-testimonials" aria-label="What merchants are saying">
          <fieldset class="container agentic-testimonial-picker">
            <legend class="visually-hidden">Choose a merchant story</legend>
            {testimonials.map((testimonial, index) => (
              <input
                key={testimonial.name}
                class="visually-hidden"
                type="radio"
                name="agentic-testimonial"
                id={`agentic-testimonial-${index + 1}`}
                checked={index === 0}
              />
            ))}
            {testimonials.map((testimonial, index) => (
              <article
                key={testimonial.name}
                class={`agentic-testimonial agentic-testimonial-${index + 1}`}
              >
                <figure class="agentic-quote">
                  <blockquote>
                    <p>{testimonial.quote}</p>
                  </blockquote>
                  <figcaption>
                    <strong>{testimonial.brand}</strong>
                    <span>{testimonial.author}</span>
                  </figcaption>
                </figure>
                <img
                  src={testimonial.image.src}
                  alt={testimonial.alt}
                  width="808"
                  height="808"
                  loading="lazy"
                  decoding="async"
                />
              </article>
            ))}
            <div class="agentic-testimonial-controls">
              <label htmlFor="agentic-testimonial-1">
                <span aria-hidden="true">←</span>
                <span class="visually-hidden">Read the Monos story</span>
              </label>
              <label htmlFor="agentic-testimonial-2">
                <span aria-hidden="true">→</span>
                <span class="visually-hidden">Read the Steve Madden story</span>
              </label>
            </div>
          </fieldset>
        </section>

        <section class="agentic-close" aria-labelledby="agentic-close-title">
          <div class="container">
            <h2 id="agentic-close-title">
              Ready to sell in AI?
              <br />
              With Shopify, you’re set.
            </h2>
            <div class="agentic-buttons">
              <a class="button button-white" href={signupHref}>
                Start for free
              </a>
              <a class="button button-outline" href={salesHref}>
                Talk to sales on Shopify
              </a>
            </div>
            <p>
              Agentic Storefronts is enabled automatically for eligible stores.{' '}
              <a href="https://www.shopify.com/legal/terms-agentic-storefronts">Terms apply.</a>
            </p>
          </div>
        </section>
      </div>
    </Document>
  )
}
