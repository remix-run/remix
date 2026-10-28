import { routes } from '../routes.ts'
import type { ImageName } from './images.ts'

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
  { label: 'Get started fast', href: routes.marketing.start.href(), image: 'start' },
  { label: 'Switch to Shopify', href: routes.marketing.sell.href(), image: 'hero' },
  {
    label: 'Trusted by enterprise brands',
    href: routes.marketing.enterprise.href(),
    image: 'enterprise',
  },
]

export const whyLinks: NavigationLink[] = [
  { label: 'World’s best checkout', href: routes.marketing.checkout.href() },
  { label: 'Sidekick', href: routes.marketing.sidekick.href() },
]

export const productGroups: NavigationGroup[] = [
  {
    label: 'Build your website',
    links: [
      { label: 'Website Builder', href: routes.marketing.websiteBuilder.href() },
      { label: 'Themes', href: 'https://themes.shopify.com/' },
      { label: 'Domains', href: routes.marketing.domains.href() },
      { label: 'Customer Accounts', href: routes.marketing.customerAccounts.href() },
      { label: 'Sidekick', href: routes.marketing.sidekick.href() },
    ],
  },
  {
    label: 'Sell anywhere',
    links: [
      { label: 'Online', href: routes.marketing.online.href() },
      { label: 'AI Chats', href: routes.agenticStorefronts.href() },
      { label: 'Point of Sale', href: routes.marketing.pos.href() },
      { label: 'Shop App', href: routes.marketing.shop.href() },
      { label: 'Social & Marketplaces', href: routes.marketing.channels.href() },
      { label: 'Global', href: routes.marketing.international.href() },
      { label: 'B2B', href: routes.marketing.b2bEnterprise.href() },
      { label: 'Across Markets', href: routes.marketing.markets.href() },
    ],
  },
  {
    label: 'Marketing & analytics',
    links: [
      { label: 'Advertising & Campaigns', href: routes.marketing.marketing.href() },
      { label: 'Email & Customer Chat', href: routes.marketing.marketingAutomationTools.href() },
      { label: 'Discounts', href: routes.marketing.discounts.href() },
      { label: 'Analytics', href: routes.marketing.analytics.href() },
      { label: 'Test & Launch', href: routes.marketing.testAndLaunch.href() },
    ],
  },
  {
    label: 'Run your business',
    links: [
      { label: 'Orders & Inventory', href: routes.marketing.orders.href() },
      { label: 'Shipping', href: routes.marketing.shipping.href() },
      { label: 'Finances & Funding', href: routes.marketing.finance.href() },
      { label: 'Workflow Automation', href: routes.marketing.flow.href() },
    ],
  },
  {
    label: 'Get paid',
    links: [
      { label: 'Checkout', href: routes.marketing.checkout.href() },
      { label: 'Payments', href: routes.marketing.payments.href() },
      { label: 'Taxes', href: routes.marketing.tax.href() },
    ],
  },
  {
    label: 'Customize & extend Shopify',
    links: [
      { label: 'Commerce for Agents', href: routes.marketing.ucp.href() },
      { label: 'Shopify App Store ↗', href: 'https://apps.shopify.com/' },
      { label: 'Shopify.dev ↗', href: 'https://shopify.dev/' },
    ],
  },
]

export const editionLinks: NavigationLink[] = [
  { label: 'Shopify Editions', href: routes.marketing.editions.href() },
  { label: 'Spring 2026 Edition', href: routes.marketing.spring2026.href() },
  {
    label: 'Agentic Storefronts',
    href: `${routes.marketing.spring2026.href()}#agentic-storefronts`,
  },
  { label: 'Campaign Autopilot', href: `${routes.marketing.spring2026.href()}#campaign-autopilot` },
  {
    label: 'Shopify AI Toolkit for devs',
    href: `${routes.marketing.spring2026.href()}#shopify-ai-toolkit-for-devs`,
  },
]

export const footerGroups: NavigationGroup[] = [
  {
    label: 'Shopify',
    links: [
      { label: 'What is Shopify?', href: 'https://www.shopify.com/blog/what-is-shopify' },
      { label: 'Shopify Editions', href: routes.marketing.editions.href() },
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
