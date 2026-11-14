import { signupHref } from '../data/pages.ts'
import { Document } from '../ui/document.tsx'

interface Plan {
  name: string
  audience: string
  yearly: string
  monthly: string
  features: string[]
  cta: string
  href: string
  // Plus is billed on a fixed term, so it has no separate yearly price.
  term?: string
}

const plans: Plan[] = [
  {
    name: 'Basic',
    audience: 'For solo entrepreneurs',
    yearly: '29',
    monthly: '39',
    cta: 'Start for free',
    href: signupHref,
    features: [
      'Sell online, in person, and in AI chats',
      'Card rates from 2.9% + 30¢ USD',
      'Built-in AI assistant',
      'Millions of tokens',
      'Earn up to $5,000 in credits',
    ],
  },
  {
    name: 'Grow',
    audience: 'For small teams',
    yearly: '79',
    monthly: '105',
    cta: 'Start for free',
    href: signupHref,
    features: [
      'Everything in Basic',
      'Card rates from 2.7% + 30¢ USD',
      'Up to 5 staff accounts',
      'Up to 87% off shipping',
      'Earn up to $7,500 in credits',
    ],
  },
  {
    name: 'Advanced',
    audience: 'For global reach',
    yearly: '299',
    monthly: '399',
    cta: 'Start for free',
    href: signupHref,
    features: [
      'Everything in Grow',
      'Card rates from 2.5% + 30¢ USD',
      'Up to 15 staff accounts',
      'Live 3rd-party shipping rates',
      'Tailor your store by region',
      'Earn up to $10,000 in credits',
    ],
  },
  {
    name: 'Plus',
    audience: 'For complex businesses',
    yearly: '2,300',
    monthly: '2,300',
    term: 'USD, on a 3-year term',
    cta: 'Try for $399',
    href: 'https://admin.shopify.com/signup?locale=en&signup_types%5B%5D=plus_signup',
    features: [
      'Everything in Advanced',
      'Card rates from 2.25% + 30¢ USD',
      'Unlimited staff accounts',
      'Fully customizable checkout',
      'Up to 200 POS Pro locations',
      'Unlimited B2B catalogs',
      'Priority 24/7 phone support',
    ],
  },
]

const includedFeatures = [
  {
    title: 'World’s best checkout',
    description: 'A fast checkout built to help turn more visits into sales.',
  },
  {
    title: 'Stunning store design',
    description: 'Start with an AI prompt or choose a ready-made theme.',
  },
  {
    title: 'Built-in assistant',
    description: 'Get help with the work of running your store from Sidekick.',
  },
  {
    title: 'Easy in-person sales',
    description: 'Take payments from your phone, a card reader, or your store counter.',
  },
  {
    title: 'Every channel, one platform',
    description: 'Manage sales across social channels, marketplaces, and AI chats.',
  },
]

const comparisons = [
  {
    name: 'Pricing',
    rows: [
      {
        feature: 'Pay monthly',
        values: plans.map((plan) => `${plan.term ? 'Starts at ' : ''}$${plan.monthly} USD/mo`),
      },
      {
        feature: 'Pay yearly',
        values: plans.map((plan) => (plan.term ? false : `$${plan.yearly} USD/mo`)),
      },
    ],
  },
  {
    name: 'Core features',
    rows: [
      {
        feature: 'Earn 1% back on all sales',
        values: ['Up to $5,000 USD', 'Up to $7,500 USD', 'Up to $10,000 USD', false],
      },
      {
        feature: 'Online store',
        values: ['Full-featured', 'Full-featured', 'Full-featured', 'Full-featured'],
      },
      { feature: 'Themes and templates', values: [true, true, true, true] },
      { feature: 'Sell unlimited products', values: [true, true, true, true] },
      { feature: "World's best-converting checkout", values: [true, true, true, true] },
      { feature: 'Sell on social and marketplaces', values: [true, true, true, true] },
      { feature: 'Sell in AI chats', values: [true, true, true, true] },
      {
        feature: 'Shopify B2B',
        values: ['Up to 3 catalogs', 'Up to 3 catalogs', 'Up to 3 catalogs', 'Unlimited catalogs'],
      },
      { feature: 'Inventory management', values: [true, true, true, true] },
      { feature: 'Inventory locations', values: ['10', '10', '10', '200'] },
      { feature: 'Additional staff accounts', values: [false, '5', '15', 'Unlimited'] },
      { feature: 'Invite third-party collaborators', values: [true, true, true, true] },
      {
        feature: 'Sell and source products with Shopify Collective',
        values: [true, true, true, true],
      },
      {
        feature: '200+ real-time reports, plus custom analytics',
        values: [true, true, true, true],
      },
      {
        feature: '24/7 support',
        values: ['Live chat', 'Live chat', 'Enhanced live chat', 'Priority support'],
      },
      { feature: 'Free Shopify Academy courses', values: [true, true, true, true] },
    ],
  },
  {
    name: 'In-person sales',
    rows: [
      {
        feature: 'Casual, in-person sales at pop-ups and events',
        values: [true, true, true, true],
      },
      {
        feature: 'POS Pro: Advanced tools for brick‑and‑mortar retailers',
        values: [
          '$89/mo per location',
          '$89/mo per location',
          '$89/mo per location',
          'Includes 20 locations. Up to 200 with Shopify Payments.',
        ],
      },
    ],
  },
  {
    name: 'AI features',
    rows: [
      { feature: 'Website builder', values: [true, true, true, true] },
      { feature: 'Millions of tokens', values: [true, true, true, true] },
      { feature: 'Sidekick, AI assistant for commerce', values: [true, true, true, true] },
    ],
  },
  {
    name: 'Accepting payments',
    rows: [
      { feature: 'Shopify Payments', values: [true, true, true, true] },
      {
        feature: 'Online standard card rates',
        values: ['2.9% + 30¢', '2.7% + 30¢', '2.5% + 30¢', '2.25% + 30¢'],
      },
      {
        feature: 'Online premium card rates',
        values: ['3.5% + 30¢', '3.3% + 30¢', '3.1% + 30¢', '2.95% + 30¢'],
      },
      { feature: 'Online international rates', values: ['+ 1%', '+ 1%', '+ 1%', '+ 1%'] },
      {
        feature: 'PayPal Wallet rates',
        values: [
          'Starting at 3.49% + 49¢',
          'Starting at 3.49% + 49¢',
          'Starting at 3.49% + 49¢',
          'Starting at 3.49% + 49¢',
        ],
      },
      {
        feature: 'MB WAY rates',
        values: ['3.9% + 30¢', '3.7% + 30¢', '3.5% + 30¢', '3.25% + 30¢'],
      },
      { feature: 'Bizum rates', values: ['3.9% + 30¢', '3.7% + 30¢', '3.5% + 30¢', '3.25% + 30¢'] },
      {
        feature: 'In-person card rates',
        values: ['2.6% + 10¢', '2.5% + 10¢', '2.4% + 10¢', '2.3% + 10¢'],
      },
      { feature: 'USDC rates', values: ['2.9% + 30¢', '2.7% + 30¢', '2.5% + 30¢', '2.25% + 30¢'] },
      {
        feature: 'In-person manual rates',
        values: ['3.5% + 10¢', '3.5% + 10¢', '3.5% + 10¢', '3.4% + 10¢'],
      },
      { feature: 'Third-party transaction fees', values: ['2%', '1%', '0.6%', '0.2%'] },
      { feature: 'Built-in fraud analysis*', values: [true, true, true, true] },
    ],
  },
  {
    name: 'Hosting',
    rows: [
      { feature: 'Unlimited web hosting', values: [true, true, true, true] },
      { feature: 'Custom domain name', values: [true, true, true, true] },
      { feature: 'Free SSL certificate', values: [true, true, true, true] },
    ],
  },
  {
    name: 'Marketing',
    rows: [
      { feature: 'Unlimited contacts', values: [true, true, true, true] },
      { feature: 'Create customer segments', values: [true, true, true, true] },
      { feature: 'Create email campaigns', values: [true, true, true, true] },
      { feature: 'Pay-per-send SMS campaigns', values: [true, true, true, true] },
      { feature: 'Capture customer leads', values: [true, true, true, true] },
      { feature: 'Chat with customers', values: [true, true, true, true] },
      { feature: 'Create marketing automations', values: [true, true, true, true] },
      { feature: 'Abandoned checkout recovery', values: [true, true, true, true] },
      { feature: 'Create and share discount codes', values: [true, true, true, true] },
      { feature: 'Sell gift cards', values: [true, true, true, true] },
      {
        feature: 'Acquire customers risk-free with Shop Campaigns',
        values: [true, true, true, true],
      },
    ],
  },
  {
    name: 'Shipping',
    rows: [
      {
        feature: 'Shipping discounts',
        values: ['Up to 87% off', 'Up to 87% off', 'Up to 87% off', 'Up to 87% off'],
      },
      { feature: 'Buy and print shipping labels', values: [true, true, true, true] },
      { feature: 'Shipping insurance*', values: [true, true, true, true] },
      { feature: '3rd-party calculated shipping rates', values: [false, 'Add on', true, true] },
    ],
  },
  {
    name: 'Marketplaces',
    rows: [
      { feature: 'Import unlimited orders from marketplaces', values: [true, true, true, true] },
      {
        feature: '50 synced marketplace orders per month',
        values: ['Free', 'Free', 'Free', 'Free'],
      },
      {
        feature: 'Over 50 synced marketplace orders',
        values: ['1% up to $99/mo', '1% up to $99/mo', '1% up to $99/mo', '1% up to $99/mo'],
      },
    ],
  },
  {
    name: 'Customization',
    rows: [
      { feature: 'Integrate with 1000s of apps', values: [true, true, true, true] },
      { feature: 'Checkout customization', values: ['Limited', 'Limited', 'Limited', 'Full'] },
      {
        feature: 'Build custom apps using Shopify APIs',
        values: ['Limited data access', 'Full data access', 'Full data access', 'Full data access'],
      },
      {
        feature: 'API rate limits',
        values: ['Standard', 'Standard', 'Up to 2x on select APIs', 'Up to 10x on select APIs'],
      },
      { feature: 'Build headless storefronts', values: ['1', '1', '1', '25'] },
    ],
  },
  {
    name: 'Sell globally',
    rows: [
      { feature: 'Translate your storefront', values: [true, true, true, true] },
      { feature: 'Show prices in local currencies*', values: [true, true, true, true] },
      { feature: 'Localized selling with Shopify Markets', values: [true, true, true, true] },
      { feature: 'Accept local payment methods*', values: [true, true, true, true] },
      { feature: 'Assign local domains', values: [true, true, true, true] },
      { feature: 'Estimate and collect duties and taxes', values: [true, true, true, true] },
    ],
  },
  {
    name: 'Tax',
    rows: [
      { feature: 'Automated sales tax calculations', values: [true, true, true, true] },
      { feature: 'Tax liability tracking', values: [true, true, true, true] },
      { feature: 'VAT validation, exemptions, and invoicing', values: [true, true, true, true] },
      { feature: 'Advanced tax platform', values: ['Add on', 'Add on', 'Add on', 'Add on'] },
    ],
  },
  {
    name: 'Just for Plus',
    rows: [
      { feature: 'High volume checkout', values: [false, false, false, true] },
      {
        feature: 'Merchandise with Shopify Combined Listings',
        values: [false, false, false, true],
      },
      { feature: 'Optimize ads with Shopify Audiences', values: [false, false, false, true] },
      { feature: 'Free expansion stores', values: [false, false, false, 'Up to 9'] },
      { feature: 'Bot protection', values: [false, false, false, true] },
      { feature: 'Up to 500% higher API call limits', values: [false, false, false, true] },
      { feature: 'Test new features before launch', values: [false, false, false, true] },
      { feature: 'Personalize store with custom functions', values: [false, false, false, true] },
      { feature: 'Custom user groups', values: [false, false, false, true] },
      { feature: 'Plus Certified apps', values: [false, false, false, true] },
    ],
  },
]

const faqs = [
  {
    question: 'What is Shopify and how does it work?',
    answer:
      'Shopify gives businesses one place to run online, social, and in-person sales. The admin brings together products, inventory, payments, orders, marketing, and reports. You can set up a store without writing code.',
  },
  {
    question: 'How much does Shopify cost?',
    answer:
      'Start with a 3-day free trial, with no credit card required. Most plans then offer 3 months at $1 per month before standard pricing begins. POS Pro is an optional subscription for advanced retail tools.',
  },
  {
    question: 'Can I cancel or change my subscription anytime?',
    answer:
      'You can cancel your account. Plus subscriptions with a 1-year or 3-year commitment can be canceled when that term ends. Check your subscription terms before changing plans.',
  },
  {
    question: 'Are there any additional fees?',
    answer:
      'Plans have no setup fees. Card processing fees depend on your plan. Transaction fees can also apply when you choose a third-party payment provider in place of Shopify Payments.',
  },
  {
    question: 'In what countries can I use Shopify?',
    answer:
      'Shopify is available in nearly every country. Shopify Payments, other features, prices, and payment options depend on where your business operates.',
  },
  {
    question: 'Is Shopify PCI Compliant or PCI Certified?',
    answer:
      'Shopify is certified Level 1 PCI DSS compliant. Stores using Shopify receive that payment security coverage by default.',
  },
  {
    question: 'Can I use my own domain name with Shopify?',
    answer:
      'Connect a domain you own or buy a new domain. Each store also gets a free myshopify.com address. An existing domain can stay with its provider or be transferred to Shopify.',
  },
  {
    question: 'Do I get web hosting with Shopify?',
    answer:
      'Plans include hosting, unlimited bandwidth, and a TLS/SSL certificate for connected domains. You can also add Buy Buttons to another website or blog and use Shopify for checkout.',
  },
]

export function PricingPage() {
  return () => (
    <Document
      title="Pricing"
      description="Compare Shopify plans for solo entrepreneurs, teams, and complex businesses."
      stylesheet="/pricing.css"
    >
      <div class="pricing-page">
        <section class="pricing-hero section-space">
          <div class="container">
            <div class="pricing-heading">
              <h1>
                You’ve got plans.
                <br />
                Us too.
              </h1>
              <p>Try 3 days free, then $1/month for 3 months.</p>
            </div>
            <fieldset class="pricing-billing">
              <legend class="visually-hidden">Billing frequency</legend>
              <input
                class="visually-hidden"
                type="radio"
                name="billing"
                id="billing-yearly"
                checked
              />
              <input class="visually-hidden" type="radio" name="billing" id="billing-monthly" />
              <div class="pricing-billing-labels">
                <label htmlFor="billing-yearly">Pay yearly</label>
                <label htmlFor="billing-monthly">Pay monthly</label>
              </div>
              <div class="pricing-plans">
                {plans.map((plan) => (
                  <article key={plan.name} class="pricing-plan">
                    <h2>{plan.name}</h2>
                    <div class="pricing-amount">
                      {plan.term && <small>from</small>}
                      <span class="pricing-yearly">${plan.yearly}</span>
                      <span class="pricing-monthly">${plan.monthly}</span>
                      <small>/mo</small>
                    </div>
                    <p class="pricing-audience">{plan.audience}</p>
                    <p class="pricing-cadence">
                      {plan.term ?? (
                        <>
                          <span class="pricing-yearly">USD, billed yearly</span>
                          <span class="pricing-monthly">USD, billed monthly</span>
                        </>
                      )}
                    </p>
                    <a class="button button-white" href={plan.href}>
                      {plan.cta}
                    </a>
                    <ul class="pricing-features">
                      {plan.features.map((feature) => (
                        <li key={feature}>{feature}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </fieldset>
            <div class="centered">
              <a class="text-link" href="#compare-all-features">
                Compare plan features <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p class="pricing-terms">
              US prices. Taxes and eligibility vary. Plus starts at $399 for the first month.
              Subscription credits earn 1% on sales, or 0.5% without Shopify Payments, for the first
              6 months or until the plan’s limit. See{' '}
              <a href="https://www.shopify.com/pricing">Shopify’s pricing and offer terms</a>.
            </p>
          </div>
        </section>
        <section class="pricing-included section-space">
          <div class="container">
            <h2>Always included</h2>
            <div class="pricing-included-grid">
              {includedFeatures.map((feature) => (
                <article key={feature.title}>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section class="pricing-extras section-space">
          <div class="container">
            <h2>But wait, there’s more</h2>
            <div class="pricing-extra-grid">
              <article>
                <div class="pricing-extra-title">
                  <h3>POS Pro</h3>
                  <span>Add on</span>
                </div>
                <p class="pricing-extra-price">
                  +$89<small>/mo per location</small>
                </p>
                <p>For physical storefronts</p>
                <ul class="pricing-features">
                  <li>Unlimited staff roles and permissions</li>
                  <li>In-store inventory management</li>
                  <li>In-store pickup and flexible delivery</li>
                </ul>
                <a class="button button-white" href="https://www.shopify.com/pos/pricing">
                  Learn more
                </a>
              </article>
              <article>
                <h3>Agentic</h3>
                <p class="pricing-extra-price">
                  $0<small>/mo</small>
                </p>
                <p>For selling in AI channels</p>
                <ul class="pricing-features">
                  <li>Add your products to Shopify Catalog</li>
                  <li>Choose your AI sales channels</li>
                  <li>Pay when you make a sale</li>
                  <li>Online card rates from 2.9% + 30¢ USD</li>
                </ul>
                <a class="button button-white" href="https://www.shopify.com/agentic-plan">
                  Start for free
                </a>
              </article>
            </div>
          </div>
        </section>
        <section class="pricing-comparison section-space" id="compare-all-features">
          <div class="container">
            <h2>Compare plan features</h2>
            <div class="table-scroll" role="region" aria-label="Plan comparison" tabIndex={0}>
              <table>
                <caption class="visually-hidden">Compare Shopify plan features in the US</caption>
                <thead>
                  <tr>
                    <th scope="col">Features</th>
                    {plans.map((plan) => (
                      <th key={plan.name} scope="col">
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                {comparisons.map((group) => (
                  <tbody key={group.name}>
                    <tr class="pricing-category">
                      <th colSpan={5}>{group.name}</th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.feature}>
                        <th scope="row">{row.feature}</th>
                        {row.values.map((value, index) => (
                          <td key={index}>
                            {typeof value === 'boolean' ? (
                              <>
                                <span aria-hidden="true">{value ? '✓' : '—'}</span>
                                <span class="visually-hidden">
                                  {value ? 'Included' : 'Not included'}
                                </span>
                              </>
                            ) : (
                              value
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
            <p class="pricing-terms">
              * Requires Shopify Payments. Amounts are in USD. Regional availability, additional
              charges, and eligibility apply. See the{' '}
              <a href="https://www.shopify.com/pricing">full current comparison and terms</a>,
              including finance products.
            </p>
          </div>
        </section>
        <section class="pricing-faq section-space">
          <div class="container faq-grid">
            <h2>FAQs</h2>
            <div>
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <p>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section class="pricing-closing section-space">
          <div class="container">
            <h2>Turn plans into progress</h2>
            <p>3 days free → Extend your trial for $1 → Earn up to $10,000 in credits</p>
            <a href={signupHref} class="button button-white">
              Start for free
            </a>
            <p class="pricing-terms">Trial and credit terms apply.</p>
          </div>
        </section>
      </div>
    </Document>
  )
}
