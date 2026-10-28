import { routes } from '../routes.ts'

export interface PageSummary {
  path: string
  label: string
  description: string
  theme: 'mint' | 'purple' | 'cream' | 'dark'
}

export type MarketingPageName = keyof typeof routes.marketing

// Navigation menus, related links, and the sitemap describe other pages with these summaries.
// Each page's own content lives in its page module.
const marketingPages = {
  start: {
    path: routes.marketing.start.href(),
    label: 'Get started fast',
    theme: 'mint',
    description:
      'Turn the idea you keep thinking about into a business. Create a store, add your products, and get ready for your first order.',
  },
  sell: {
    path: routes.marketing.sell.href(),
    label: 'Switch to Shopify',
    theme: 'cream',
    description:
      'Bring your business to a platform built around selling. Move your products and customers, keep your brand, and find new ways to grow.',
  },
  enterprise: {
    path: routes.marketing.enterprise.href(),
    label: 'Enterprise',
    theme: 'dark',
    description:
      'Build for the scale you have and the growth ahead. Bring your brands, markets, retail stores, and wholesale business onto a connected commerce platform.',
  },
  checkout: {
    path: routes.marketing.checkout.href(),
    label: 'Checkout',
    theme: 'purple',
    description:
      'Make the last step feel effortless. Give customers a clear, fast path from the products they love to a completed order.',
  },
  sidekick: {
    path: routes.marketing.sidekick.href(),
    label: 'Sidekick',
    theme: 'purple',
    description:
      'Meet an AI assistant that works with your store. Ask questions, explore ideas, and turn the next thing on your list into the next thing you finish.',
  },
  websiteBuilder: {
    path: routes.marketing.websiteBuilder.href(),
    label: 'Website Builder',
    theme: 'mint',
    description:
      'Build an ecommerce website with room for your whole brand. Start with AI or a theme, then make every page your own.',
  },
  domains: {
    path: routes.marketing.domains.href(),
    label: 'Domains',
    theme: 'cream',
    description:
      'Give your business an address people can remember. Find a new domain or connect one you already own to your Shopify store.',
  },
  customerAccounts: {
    path: routes.marketing.customerAccounts.href(),
    label: 'Customer Accounts',
    theme: 'cream',
    description:
      'Give customers a home for their relationship with your brand. Make it easy to return, check an order, and shop again.',
  },
  online: {
    path: routes.marketing.online.href(),
    label: 'Online',
    theme: 'dark',
    description:
      'Make a home for your products and your story. Create an online store that brings your brand, checkout, and business tools together.',
  },
  pos: {
    path: routes.marketing.pos.href(),
    label: 'Point of Sale',
    theme: 'cream',
    description:
      'Bring your online and retail business together with Shopify POS. Give your staff the tools to help customers wherever they shop.',
  },
  shop: {
    path: routes.marketing.shop.href(),
    label: 'Shop App',
    theme: 'purple',
    description:
      'Give people another way to discover your brand, buy your products, and keep track of their orders through Shop.',
  },
  channels: {
    path: routes.marketing.channels.href(),
    label: 'Social & Marketplaces',
    theme: 'cream',
    description:
      'Put your products in more places without splitting your business apart. Connect social platforms and marketplaces to your Shopify store.',
  },
  international: {
    path: routes.marketing.international.href(),
    label: 'Global',
    theme: 'mint',
    description:
      'Make your store feel closer to customers around the world. Bring international selling into the same business you already run.',
  },
  b2bEnterprise: {
    path: routes.marketing.b2bEnterprise.href(),
    label: 'B2B',
    theme: 'dark',
    description:
      'Give business buyers a modern buying experience. Connect wholesale to the same platform that powers the rest of your commerce.',
  },
  markets: {
    path: routes.marketing.markets.href(),
    label: 'Across Markets',
    theme: 'mint',
    description:
      'Create different shopping experiences for different audiences. Manage your markets from one store while making each one feel considered.',
  },
  marketing: {
    path: routes.marketing.marketing.href(),
    label: 'Advertising & Campaigns',
    theme: 'cream',
    description:
      'Connect your marketing to your commerce. Find audiences, create campaigns, and understand what brings people back to your store.',
  },
  marketingAutomationTools: {
    path: routes.marketing.marketingAutomationTools.href(),
    label: 'Email & Customer Chat',
    theme: 'mint',
    description:
      'Bring email, customer chat, forms, and automations closer to your store. Make each message part of a useful customer experience.',
  },
  discounts: {
    path: routes.marketing.discounts.href(),
    label: 'Discounts',
    theme: 'purple',
    description:
      'Build promotions around your products and your goals. Create offers that fit your customers and manage them from your store.',
  },
  analytics: {
    path: routes.marketing.analytics.href(),
    label: 'Analytics',
    theme: 'mint',
    description:
      'Bring your commerce data into focus. See what is happening in your store and explore the details behind your results.',
  },
  testAndLaunch: {
    path: routes.marketing.testAndLaunch.href(),
    label: 'Test & Launch',
    theme: 'purple',
    description:
      'Give your next idea a clearer path to launch. Explore changes, gather feedback, and learn before bringing an update to everyone.',
  },
  orders: {
    path: routes.marketing.orders.href(),
    label: 'Orders & Inventory',
    theme: 'cream',
    description:
      'Keep your orders, inventory, and fulfillment connected. Give your team one place to turn a sale into a package on its way.',
  },
  shipping: {
    path: routes.marketing.shipping.href(),
    label: 'Shipping',
    theme: 'mint',
    description:
      'Make getting an order to your customer part of the same workflow. Compare options, buy labels, and send packages from your admin.',
  },
  finance: {
    path: routes.marketing.finance.href(),
    label: 'Finances & Funding',
    theme: 'mint',
    description:
      'Bring a clearer view of your business finances into Shopify. Explore tools for managing money, business spending, and growth funding.',
  },
  flow: {
    path: routes.marketing.flow.href(),
    label: 'Workflow Automation',
    theme: 'cream',
    description:
      'Connect the steps you repeat with Shopify Flow. Build automations around the events, conditions, and actions that run your business.',
  },
  payments: {
    path: routes.marketing.payments.href(),
    label: 'Payments',
    theme: 'purple',
    description:
      'Give customers familiar ways to pay. Connect payment setup, checkout, and your view of incoming money through Shopify Payments.',
  },
  tax: {
    path: routes.marketing.tax.href(),
    label: 'Taxes',
    theme: 'cream',
    description:
      'Bring tax tools into your commerce workflow. Track where your business may need attention and manage tax settings alongside your store.',
  },
  ucp: {
    path: routes.marketing.ucp.href(),
    label: 'Commerce for Agents',
    theme: 'dark',
    description:
      'Connect AI agents and commerce through a common language. Build shopping experiences around shared ways to discover products and complete a purchase.',
  },
  editions: {
    path: routes.marketing.editions.href(),
    label: 'Shopify Editions',
    theme: 'dark',
    description:
      'Explore the latest Shopify product releases. See what is new for building a store, reaching customers, and running a growing business.',
  },
  spring2026: {
    path: routes.marketing.spring2026.href(),
    label: 'Spring 2026 Edition',
    theme: 'purple',
    description:
      'Explore a new season of tools for your business. Build with AI, reach shoppers in more places, and bring the work of commerce together.',
  },
} as const satisfies Record<MarketingPageName, PageSummary>

const routePages = {
  agenticStorefronts: {
    path: routes.agenticStorefronts.href(),
    label: 'AI Chats',
    theme: 'dark',
    description:
      'Bring your products into AI shopping conversations. Connect product discovery with a buying experience that stays tied to your business.',
  },
  pricing: {
    path: routes.pricing.href(),
    label: 'Pricing',
    theme: 'cream',
    description:
      'Find a plan for your next chapter. Start a business, bring a team together, or build for the scale ahead.',
  },
} as const satisfies Record<string, PageSummary>

export type PageName = MarketingPageName | keyof typeof routePages

export const pageSummaries: Record<PageName, PageSummary> = { ...marketingPages, ...routePages }

export const pagePaths = [
  routes.home.href(),
  ...Object.values(pageSummaries).map((page) => page.path),
  routes.sitemap.href(),
]

export const signupHref = 'https://admin.shopify.com/signup'
