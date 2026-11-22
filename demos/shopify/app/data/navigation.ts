import { routes } from '../routes.ts'
import type { ImageName } from './images.ts'
import { pages } from './pages.ts'

export interface NavigationLink {
  label: string
  href: string
}

export interface NavigationGroup {
  label: string
  links: NavigationLink[]
}

export interface NavigationCard extends NavigationLink {
  image: ImageName
}

export const whyCards: NavigationCard[] = [
  { label: 'Get started fast', href: pages.start.path, image: 'start' },
  { label: 'Switch to Shopify', href: pages.sell.path, image: 'hero' },
  {
    label: 'Trusted by enterprise brands',
    href: pages.enterprise.path,
    image: 'enterprise',
  },
]

export const whyLinks: NavigationLink[] = [
  { label: 'World’s best checkout', href: pages.checkout.path },
  { label: 'Sidekick', href: pages.sidekick.path },
]

export const productGroups: NavigationGroup[] = [
  {
    label: 'Build your website',
    links: [
      { label: 'Website Builder', href: pages.websiteBuilder.path },
      { label: 'Themes', href: 'https://themes.shopify.com/' },
      { label: 'Domains', href: pages.domains.path },
      { label: 'Customer Accounts', href: pages.customerAccounts.path },
      { label: 'Sidekick', href: pages.sidekick.path },
    ],
  },
  {
    label: 'Sell anywhere',
    links: [
      { label: 'Online', href: pages.online.path },
      { label: 'AI Chats', href: routes.agenticStorefronts.href() },
      { label: 'Point of Sale', href: pages.pos.path },
      { label: 'Shop App', href: pages.shop.path },
      { label: 'Social & Marketplaces', href: pages.channels.path },
      { label: 'Global', href: pages.international.path },
      { label: 'B2B', href: pages.b2bEnterprise.path },
      { label: 'Across Markets', href: pages.markets.path },
    ],
  },
  {
    label: 'Marketing & analytics',
    links: [
      { label: 'Advertising & Campaigns', href: pages.marketing.path },
      { label: 'Email & Customer Chat', href: pages.marketingAutomationTools.path },
      { label: 'Discounts', href: pages.discounts.path },
      { label: 'Analytics', href: pages.analytics.path },
      { label: 'Test & Launch', href: pages.testAndLaunch.path },
    ],
  },
  {
    label: 'Run your business',
    links: [
      { label: 'Orders & Inventory', href: pages.orders.path },
      { label: 'Shipping', href: pages.shipping.path },
      { label: 'Finances & Funding', href: pages.finance.path },
      { label: 'Workflow Automation', href: pages.flow.path },
    ],
  },
  {
    label: 'Get paid',
    links: [
      { label: 'Checkout', href: pages.checkout.path },
      { label: 'Payments', href: pages.payments.path },
      { label: 'Taxes', href: pages.tax.path },
    ],
  },
  {
    label: 'Customize & extend Shopify',
    links: [
      { label: 'Commerce for Agents', href: pages.ucp.path },
      { label: 'Shopify App Store ↗', href: 'https://apps.shopify.com/' },
      { label: 'Shopify.dev ↗', href: 'https://shopify.dev/' },
    ],
  },
]

export const editionLinks: NavigationLink[] = [
  { label: 'Shopify Editions', href: pages.editions.path },
  { label: 'Spring 2026 Edition', href: pages.spring2026.path },
  { label: 'Agentic Storefronts', href: `${pages.spring2026.path}#agentic-storefronts` },
  { label: 'Campaign Autopilot', href: `${pages.spring2026.path}#campaign-autopilot` },
  {
    label: 'Shopify AI Toolkit for devs',
    href: `${pages.spring2026.path}#shopify-ai-toolkit-for-devs`,
  },
]

export const footerGroups: NavigationGroup[] = [
  {
    label: 'Shopify',
    links: [
      { label: 'What is Shopify?', href: 'https://www.shopify.com/blog/what-is-shopify' },
      { label: 'Shopify Editions', href: pages.editions.path },
      { label: 'Careers', href: 'https://www.shopify.com/careers' },
      { label: 'Investors', href: 'https://www.shopify.com/investors' },
      { label: 'Newsroom', href: 'https://www.shopify.com/news' },
      { label: 'Sustainability', href: 'https://www.shopify.com/climate' },
    ],
  },
  {
    label: 'Ecosystem',
    links: [
      { label: 'Developer Docs ↗', href: 'https://shopify.dev/docs' },
      { label: 'Theme Store ↗', href: 'https://themes.shopify.com/' },
      { label: 'App Store ↗', href: 'https://apps.shopify.com/' },
      { label: 'Partners', href: 'https://www.shopify.com/partners' },
      { label: 'Affiliates', href: 'https://www.shopify.com/affiliates' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { label: 'Blog', href: 'https://www.shopify.com/blog' },
      { label: 'Compare Shopify', href: 'https://www.shopify.com/compare' },
      { label: 'Guides', href: 'https://www.shopify.com/blog/topics/guides' },
      { label: 'Free Tools', href: 'https://www.shopify.com/tools' },
      { label: 'Changelog ↗', href: 'https://changelog.shopify.com/' },
    ],
  },
  {
    label: 'Support',
    links: [
      { label: 'Shopify Help Center ↗', href: 'https://help.shopify.com/en' },
      { label: 'Community Forum ↗', href: 'https://community.shopify.com/' },
      { label: 'Hire a Partner', href: 'https://www.shopify.com/partners/directory' },
      { label: 'Service Status ↗', href: 'https://shopifystatus.com/' },
    ],
  },
]
