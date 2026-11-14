import { routes } from '../routes.ts'
import type { ImageName } from './images.ts'

export interface Feature {
  id?: string
  title: string
  description: string
}

export type PageName = keyof typeof pageContent | keyof typeof routePages

export interface PageSummary {
  path: string
  label: string
  description: string
  theme: 'mint' | 'purple' | 'cream' | 'dark'
}

export interface MarketingPage extends PageSummary {
  image: ImageName
  title: string
  features: readonly Feature[]
  related: readonly PageName[]
}

// Pages with their own routes and layouts still appear in related links and the sitemap.
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

const pageContent = {
  start: {
    path: '/start',
    image: 'start',
    label: 'Get started fast',
    title: 'Start today. Build your tomorrow.',
    theme: 'mint',
    description:
      'Turn the idea you keep thinking about into a business. Create a store, add your products, and get ready for your first order.',
    features: [
      {
        title: 'A design that feels like you',
        description:
          'Describe your business to the AI store builder, or pick a theme and make it your own. Adjust colors, layouts, and type without writing code.',
      },
      {
        title: 'Give every product its moment',
        description:
          'Add photos, tell the story behind your products, and organize your collections. Sidekick can help with images and descriptions along the way.',
      },
      {
        title: 'Open for business',
        description:
          'Connect a domain, choose how to accept payments, and set your shipping rates. Your store brings the pieces together so you can focus on selling.',
      },
    ],
    related: ['websiteBuilder', 'payments', 'pricing'],
  },
  sell: {
    path: '/sell',
    image: 'online',
    label: 'Switch to Shopify',
    title: 'More bang, less buck.',
    theme: 'cream',
    description:
      'Bring your business to a platform built around selling. Move your products and customers, keep your brand, and find new ways to grow.',
    features: [
      {
        title: 'Meet your next customer',
        description:
          'Reach people through search, social platforms, marketplaces, and AI conversations. Manage your channels together instead of building a separate business for each one.',
      },
      {
        title: 'Make the move your way',
        description:
          'Import your catalog, connect the tools you use, and rebuild your storefront around your brand. Work with a Shopify Partner when you need a hand.',
      },
      {
        title: 'Keep more of your time',
        description:
          'Handle orders, inventory, payments, and reports in one admin. Replace repetitive work with automations as your business grows.',
      },
    ],
    related: ['channels', 'checkout', 'enterprise'],
  },
  enterprise: {
    path: '/enterprise',
    image: 'enterprise',
    label: 'Enterprise',
    title: 'Enterprise commerce without compromise',
    theme: 'dark',
    description:
      'Build for the scale you have and the growth ahead. Bring your brands, markets, retail stores, and wholesale business onto a connected commerce platform.',
    features: [
      {
        title: 'Built for your biggest moments',
        description:
          'Launch a new collection or enter a new market with infrastructure designed for busy stores. Your teams can focus on the experience instead of maintaining the platform.',
      },
      {
        title: 'Your business, connected',
        description:
          'Connect your existing systems through APIs and apps. Give retail, ecommerce, operations, and finance a shared view of your business.',
      },
      {
        title: 'Make the experience yours',
        description:
          'Customize your storefront and checkout, build a headless experience, and create different buying journeys for different audiences.',
      },
    ],
    related: ['b2bEnterprise', 'markets', 'checkout'],
  },
  checkout: {
    path: '/checkout',
    image: 'checkout',
    label: 'Checkout',
    title: 'Shopify Checkout',
    theme: 'purple',
    description:
      'Make the last step feel effortless. Give customers a clear, fast path from the products they love to a completed order.',
    features: [
      {
        title: 'Less typing. More buying.',
        description:
          'Shop Pay lets returning shoppers use their saved information. Offer familiar wallets and payment methods so customers can choose how they pay.',
      },
      {
        title: 'A checkout that travels',
        description:
          'Keep the buying experience connected across your online store, social channels, and other places your products appear.',
      },
      {
        title: 'Make room for your business rules',
        description:
          'Use extensions and apps to shape the checkout experience. Add the right delivery choices, discounts, and branding for your business.',
      },
    ],
    related: ['payments', 'shop', 'discounts'],
  },
  sidekick: {
    path: '/sidekick',
    image: 'sidekick',
    label: 'Sidekick',
    title: 'Starting a business? You’ve got backup.',
    theme: 'purple',
    description:
      'Meet an AI assistant that works with your store. Ask questions, explore ideas, and turn the next thing on your list into the next thing you finish.',
    features: [
      {
        title: 'From an idea to a storefront',
        description:
          'Talk through your vision and get help creating a store design. Keep adjusting until the result feels right for your brand.',
      },
      {
        title: 'Give your products a lift',
        description:
          'Work on product descriptions, create image variations, and get help with the details that make a catalog feel complete.',
      },
      {
        title: 'Understand what comes next',
        description:
          'Ask about your store’s performance and get help finding useful reports. Turn what you learn into actions in your admin.',
      },
    ],
    related: ['start', 'websiteBuilder', 'analytics'],
  },
  websiteBuilder: {
    path: '/website/builder',
    image: 'website-builder',
    label: 'Website Builder',
    title: 'Your idea. Your website. Your way.',
    theme: 'mint',
    description:
      'Build an ecommerce website with room for your whole brand. Start with AI or a theme, then make every page your own.',
    features: [
      {
        title: 'Begin with a conversation',
        description:
          'Describe your products and the kind of store you want. Use the generated design as a starting point and keep making it yours.',
      },
      {
        title: 'Find your starting style',
        description:
          'Choose a theme with the layouts and features your business needs. Use the editor to arrange sections and adjust your visual style.',
      },
      {
        title: 'Built to do business',
        description:
          'Your website connects to products, checkout, inventory, and orders. Add a custom domain and give shoppers a home for your brand.',
      },
    ],
    related: ['domains', 'online', 'sidekick'],
  },
  domains: {
    path: '/domains',
    image: 'domains',
    label: 'Domains',
    title: 'Set up shop with the perfect domain',
    theme: 'cream',
    description:
      'Give your business an address people can remember. Find a new domain or connect one you already own to your Shopify store.',
    features: [
      {
        title: 'Put your name out there',
        description:
          'Choose an address that fits your brand and is easy to share. Explore familiar extensions and options for the markets you sell in.',
      },
      {
        title: 'Connect the dots',
        description:
          'Manage a Shopify domain with your store or connect a domain from another provider. Your storefront stays at the center of the experience.',
      },
      {
        title: 'Build trust from the first visit',
        description:
          'Use a consistent address across your storefront, marketing, and social profiles. Give customers a clear place to find your business.',
      },
    ],
    related: ['websiteBuilder', 'start', 'international'],
  },
  customerAccounts: {
    path: '/customer-accounts',
    image: 'customer-accounts',
    label: 'Customer Accounts',
    title: 'A little more personal. A lot more useful.',
    theme: 'cream',
    description:
      'Give customers a home for their relationship with your brand. Make it easy to return, check an order, and shop again.',
    features: [
      {
        title: 'An easier way back in',
        description:
          'Let customers sign in with a code sent to their email. They can return to their information without remembering another password.',
      },
      {
        title: 'Answers on their schedule',
        description:
          'Give shoppers access to order history, delivery updates, and return requests. Help them handle the everyday questions themselves.',
      },
      {
        title: 'Keep your brand close',
        description:
          'Carry your design into the account experience and extend it with apps. Create a useful place for customers to come back to.',
      },
    ],
    related: ['checkout', 'orders', 'marketingAutomationTools'],
  },
  online: {
    path: '/online',
    image: 'online',
    label: 'Online',
    title: 'Build a store worth coming back to.',
    theme: 'dark',
    description:
      'Make a home for your products and your story. Create an online store that brings your brand, checkout, and business tools together.',
    features: [
      {
        title: 'Make a strong first impression',
        description:
          'Create a storefront from a theme, build with AI, or develop a custom experience. Show your products in a way that feels like your brand.',
      },
      {
        title: 'Ready for the next order',
        description:
          'Connect your product catalog to inventory, payments, and fulfillment. Your store is part of the same system your business runs on.',
      },
      {
        title: 'Keep improving',
        description:
          'Learn how people discover and use your store. Add apps, test ideas, and make changes as you learn what your customers need.',
      },
    ],
    related: ['websiteBuilder', 'checkout', 'analytics'],
  },
  pos: {
    path: '/pos',
    image: 'pos',
    label: 'Point of Sale',
    title: 'Great in store. Connected everywhere.',
    theme: 'cream',
    description:
      'Bring your online and retail business together with Shopify POS. Give your staff the tools to help customers wherever they shop.',
    features: [
      {
        title: 'From a pop-up to your next location',
        description:
          'Choose hardware and a setup that fit your space. Take your business to an event or give a growing retail team a shared system.',
      },
      {
        title: 'Know what’s on the shelf',
        description:
          'Connect inventory across locations and your online store. Help staff find the right product and offer customers more ways to receive it.',
      },
      {
        title: 'A better view of your customer',
        description:
          'Bring purchase history and customer information into the retail experience. Make it easier to pick up where the last visit left off.',
      },
    ],
    related: ['payments', 'orders', 'markets'],
  },
  shop: {
    path: '/shop',
    image: 'shop',
    label: 'Shop App',
    title: 'Reach the world’s best Shoppers',
    theme: 'purple',
    description:
      'Give people another way to discover your brand, buy your products, and keep track of their orders through Shop.',
    features: [
      {
        title: 'Make your brand discoverable',
        description:
          'Bring your catalog to a shopping app designed around independent brands. Give new customers a way to find products they may love.',
      },
      {
        title: 'Make buying feel familiar',
        description:
          'Shop Pay connects saved information with a fast checkout experience. Customers can return to shopping without starting over.',
      },
      {
        title: 'Stay connected after checkout',
        description:
          'Give shoppers a place to follow delivery updates and return to your brand. Bring discovery and the post-purchase experience closer together.',
      },
    ],
    related: ['checkout', 'marketing', 'channels'],
  },
  channels: {
    path: '/channels',
    image: 'channels',
    label: 'Social & Marketplaces',
    title: 'Be where your customers are.',
    theme: 'cream',
    description:
      'Put your products in more places without splitting your business apart. Connect social platforms and marketplaces to your Shopify store.',
    features: [
      {
        title: 'Meet shoppers on marketplaces',
        description:
          'Connect supported marketplaces and keep listings tied to your catalog. Manage incoming orders alongside the rest of your business.',
      },
      {
        title: 'Turn attention into discovery',
        description:
          'Share products through social channels and connect your catalog to campaigns. Help shoppers move from something they see to something they can buy.',
      },
      {
        title: 'Keep the back office together',
        description:
          'Use one place to manage your products, inventory, and orders. Add channels as your business finds new audiences.',
      },
    ],
    related: ['marketing', 'shop', 'agenticStorefronts'],
  },
  international: {
    path: '/international',
    image: 'international',
    label: 'Global',
    title: 'Grow around the globe',
    theme: 'mint',
    description:
      'Make your store feel closer to customers around the world. Bring international selling into the same business you already run.',
    features: [
      {
        title: 'Make visitors feel at home',
        description:
          'Adapt languages, currencies, and domains for your markets. Give customers useful local information as they browse.',
      },
      {
        title: 'Plan for the border',
        description:
          'Set up shipping options and understand duties and import taxes. Choose the services and settings that fit the places you sell.',
      },
      {
        title: 'Grow at your own pace',
        description:
          'Start with the markets that make sense for your products. Watch performance and adjust your approach as you learn.',
      },
    ],
    related: ['markets', 'shipping', 'payments'],
  },
  b2bEnterprise: {
    path: '/solutions/b2b/enterprise',
    image: 'solutions-b2b-enterprise',
    label: 'B2B',
    title: 'Wholesale, with a whole new outlook.',
    theme: 'dark',
    description:
      'Give business buyers a modern buying experience. Connect wholesale to the same platform that powers the rest of your commerce.',
    features: [
      {
        title: 'A store that knows the buyer',
        description:
          'Create company accounts with the catalogs, pricing, and terms each customer needs. Make repeat buying easier for your wholesale customers.',
      },
      {
        title: 'Bring your systems together',
        description:
          'Connect commerce with your existing operations through apps and APIs. Keep the information your teams rely on moving between systems.',
      },
      {
        title: 'Give your team time back',
        description:
          'Let buyers place orders themselves and use automations for routine work. Spend more time on relationships and less on manual order entry.',
      },
    ],
    related: ['enterprise', 'customerAccounts', 'flow'],
  },
  markets: {
    path: '/markets',
    image: 'markets',
    label: 'Across Markets',
    title: 'One store. So many possibilities.',
    theme: 'mint',
    description:
      'Create different shopping experiences for different audiences. Manage your markets from one store while making each one feel considered.',
    features: [
      {
        title: 'Define your next market',
        description:
          'Group customers and regions into markets that fit your business. Set up the right catalog and experience for each audience.',
      },
      {
        title: 'Change the details that matter',
        description:
          'Adapt product availability, currencies, pricing, and storefront content. Give each market a version of your store that works for it.',
      },
      {
        title: 'See the bigger picture',
        description:
          'Manage changes from one admin and review how your markets perform. Keep a shared view as your business expands.',
      },
    ],
    related: ['international', 'b2bEnterprise', 'analytics'],
  },
  marketing: {
    path: '/marketing',
    image: 'marketing',
    label: 'Advertising & Campaigns',
    title: 'Bring your next customer closer.',
    theme: 'cream',
    description:
      'Connect your marketing to your commerce. Find audiences, create campaigns, and understand what brings people back to your store.',
    features: [
      {
        title: 'Find your people',
        description:
          'Connect your catalog to social platforms, marketplaces, and Shop. Put products in front of people in the places they already spend time.',
      },
      {
        title: 'Keep the conversation going',
        description:
          'Create customer segments and follow up with useful messages. Build campaigns around what you learn about your customers.',
      },
      {
        title: 'Learn from every campaign',
        description:
          'Review marketing activity alongside your sales data. Use the results to decide where your next campaign should go.',
      },
    ],
    related: ['marketingAutomationTools', 'analytics', 'channels'],
  },
  marketingAutomationTools: {
    path: '/marketing-automation-tools',
    image: 'marketing-automation-tools',
    label: 'Email & Customer Chat',
    title: 'Good timing. Better connections.',
    theme: 'mint',
    description:
      'Bring email, customer chat, forms, and automations closer to your store. Make each message part of a useful customer experience.',
    features: [
      {
        title: 'Welcome the next subscriber',
        description:
          'Create a signup form and follow it with a welcome message. Give new customers a clear way to get to know your brand.',
      },
      {
        title: 'Send something that matters',
        description:
          'Build customer segments and create emails that fit each audience. Use product and store information to make messages more useful.',
      },
      {
        title: 'Keep helping between visits',
        description:
          'Use chat to answer questions and automations to follow up at the right moment. Connect conversations to your customer relationships.',
      },
    ],
    related: ['marketing', 'customerAccounts', 'flow'],
  },
  discounts: {
    path: '/discounts',
    image: 'discounts',
    label: 'Discounts',
    title: 'Give shoppers a reason to say yes.',
    theme: 'purple',
    description:
      'Build promotions around your products and your goals. Create offers that fit your customers and manage them from your store.',
    features: [
      {
        title: 'Find the right offer',
        description:
          'Create discount codes or automatic discounts. Choose the products, collections, and customers that should be part of a promotion.',
      },
      {
        title: 'Put your rules to work',
        description:
          'Set the dates, requirements, and limits for an offer. Decide how promotions combine so the checkout follows your plan.',
      },
      {
        title: 'See what your offer did',
        description:
          'Review discount use and sales results in your reports. Learn which promotions help your business and plan your next one.',
      },
    ],
    related: ['checkout', 'marketing', 'analytics'],
  },
  analytics: {
    path: '/analytics',
    image: 'analytics',
    label: 'Analytics',
    title: 'Know your business. Find your next move.',
    theme: 'mint',
    description:
      'Bring your commerce data into focus. See what is happening in your store and explore the details behind your results.',
    features: [
      {
        title: 'Start with a useful view',
        description:
          'Review sales, orders, visitors, and customer behavior in reports built for commerce. Keep the measures that matter close at hand.',
      },
      {
        title: 'Ask a better question',
        description:
          'Filter and explore your data to understand a product, campaign, or market. Build reports around the decisions your team needs to make.',
      },
      {
        title: 'Watch the moment happen',
        description:
          'Follow store activity as customers arrive and orders come in. Keep an eye on your business during a launch or campaign.',
      },
    ],
    related: ['marketing', 'markets', 'sidekick'],
  },
  testAndLaunch: {
    path: '/test-and-launch',
    image: 'test-and-launch',
    label: 'Test & Launch',
    title: 'Make every change count',
    theme: 'purple',
    description:
      'Give your next idea a clearer path to launch. Explore changes, gather feedback, and learn before bringing an update to everyone.',
    features: [
      {
        title: 'Explore the experience',
        description:
          'Use simulated shopping journeys to look for friction. Get another view of how a visitor may experience the changes you are planning.',
      },
      {
        title: 'Learn before you decide',
        description:
          'Compare ideas and review the results that matter to your store. Give your team evidence to use when choosing what comes next.',
      },
      {
        title: 'Bring the change to life',
        description:
          'Plan a rollout and watch what happens as it reaches customers. Keep learning after the launch as your store evolves.',
      },
    ],
    related: ['online', 'analytics', 'spring2026'],
  },
  orders: {
    path: '/orders',
    image: 'orders',
    label: 'Orders & Inventory',
    title: 'From order placed to order delivered.',
    theme: 'cream',
    description:
      'Keep your orders, inventory, and fulfillment connected. Give your team one place to turn a sale into a package on its way.',
    features: [
      {
        title: 'Bring every order together',
        description:
          'Manage orders from your connected channels in one admin. Review the details, accept payment, and keep customers informed.',
      },
      {
        title: 'Keep stock in sight',
        description:
          'Track products across locations and understand what is available. Keep your storefront and operations working from the same inventory.',
      },
      {
        title: 'Get it out the door',
        description:
          'Organize picking and packing, create shipping labels, and share tracking updates. Connect fulfillment services when your business needs them.',
      },
    ],
    related: ['shipping', 'pos', 'flow'],
  },
  shipping: {
    path: '/shipping',
    image: 'shipping',
    label: 'Shipping',
    title: 'Shipping, included',
    theme: 'mint',
    description:
      'Make getting an order to your customer part of the same workflow. Compare options, buy labels, and send packages from your admin.',
    features: [
      {
        title: 'Find a way there',
        description:
          'Choose from supported carriers and services for your shipping origin. Compare delivery options that fit your packages and your customers.',
      },
      {
        title: 'Pack more. Click less.',
        description:
          'Create labels in batches and organize your fulfillment workflow. Keep the order information your team needs close to the work.',
      },
      {
        title: 'Keep customers in the loop',
        description:
          'Send tracking information as orders leave your business. Set delivery expectations before checkout and share updates after it.',
      },
    ],
    related: ['orders', 'international', 'checkout'],
  },
  finance: {
    path: '/finance',
    image: 'finance',
    label: 'Finances & Funding',
    title: 'Put your money where your business is',
    theme: 'mint',
    description:
      'Bring a clearer view of your business finances into Shopify. Explore tools for managing money, business spending, and growth funding.',
    features: [
      {
        title: 'Keep money in view',
        description:
          'See financial activity alongside the business that creates it. Use the available finance tools to keep everyday money tasks organized.',
      },
      {
        title: 'Plan the next stage',
        description:
          'Explore Shopify Capital when your business is eligible. Review the offer and its terms to decide how funding fits your plans.',
      },
      {
        title: 'Manage the everyday',
        description:
          'Bring bills and business spending into a more connected workflow. Product availability and eligibility depend on your business and location.',
      },
    ],
    related: ['payments', 'analytics', 'enterprise'],
  },
  flow: {
    path: '/flow',
    image: 'flow',
    label: 'Workflow Automation',
    title: 'Less busywork. More possibility.',
    theme: 'cream',
    description:
      'Connect the steps you repeat with Shopify Flow. Build automations around the events, conditions, and actions that run your business.',
    features: [
      {
        title: 'Build a workflow you can see',
        description:
          'Choose a trigger, add conditions, and decide what happens next. Create automations with a visual editor instead of a custom script.',
      },
      {
        title: 'Put routine work on a schedule',
        description:
          'Use workflows for stock updates, customer tagging, order handling, and other repeated tasks. Start small and add steps as you learn.',
      },
      {
        title: 'Connect more of your tools',
        description:
          'Use supported app actions and integrations to carry work between tools. Keep your automations close to the commerce events that start them.',
      },
    ],
    related: ['orders', 'marketingAutomationTools', 'sidekick'],
  },
  payments: {
    path: '/payments',
    image: 'payments',
    label: 'Payments',
    title: 'Accept payments. Expect growth.',
    theme: 'purple',
    description:
      'Give customers familiar ways to pay. Connect payment setup, checkout, and your view of incoming money through Shopify Payments.',
    features: [
      {
        title: 'Welcome their way to pay',
        description:
          'Offer supported cards, wallets, and local payment methods. The options available depend on where your business operates.',
      },
      {
        title: 'Make returning easier',
        description:
          'Use Shop Pay to help shoppers check out with saved information. Keep the experience quick across the devices they use.',
      },
      {
        title: 'Follow the money',
        description:
          'Review transactions and payouts from your admin. Bring payment activity together with the orders and reports behind it.',
      },
    ],
    related: ['checkout', 'finance', 'international'],
  },
  tax: {
    path: '/tax',
    image: 'tax',
    label: 'Taxes',
    title: 'A clearer path through sales tax.',
    theme: 'cream',
    description:
      'Bring tax tools into your commerce workflow. Track where your business may need attention and manage tax settings alongside your store.',
    features: [
      {
        title: 'See where you stand',
        description:
          'Use liability insights to monitor your activity in supported regions. Keep the information you need for registration decisions in view.',
      },
      {
        title: 'Work with the right details',
        description:
          'Organize product categories and tax settings to support accurate calculations. Review your setup as your products and markets change.',
      },
      {
        title: 'Keep your records together',
        description:
          'Use reports and supported filing tools to prepare the next step. Availability varies by region and the services your business uses.',
      },
    ],
    related: ['international', 'orders', 'finance'],
  },
  ucp: {
    path: '/ucp',
    image: 'ucp',
    label: 'Commerce for Agents',
    title: 'Universal Commerce Protocol',
    theme: 'dark',
    description:
      'Connect AI agents and commerce through a common language. Build shopping experiences around shared ways to discover products and complete a purchase.',
    features: [
      {
        title: 'Start with shared building blocks',
        description:
          'Use a common set of commerce concepts so agents and businesses can work together. Reduce the need for a separate connection for every surface.',
      },
      {
        title: 'Connect the shopping journey',
        description:
          'Bring discovery, checkout, and order experiences into agent-driven applications. Keep the transaction connected to the merchant’s business.',
      },
      {
        title: 'Build for what comes next',
        description:
          'Extend the protocol for new capabilities and business needs. Explore the developer documentation for the technical details.',
      },
    ],
    related: ['agenticStorefronts', 'checkout', 'spring2026'],
  },
  editions: {
    path: '/editions',
    image: 'editions-spring2026',
    label: 'Shopify Editions',
    title: 'Big ideas. New possibilities.',
    theme: 'dark',
    description:
      'Explore the latest Shopify product releases. See what is new for building a store, reaching customers, and running a growing business.',
    features: [
      {
        title: 'Everywhere',
        description:
          'Discover the Spring 2026 collection, with updates across AI commerce, marketing, store building, and day-to-day operations.',
      },
      {
        title: 'Built for what you’re building',
        description:
          'Find updates for the part of your business you are working on. Explore new ways to sell online, in retail, and across markets.',
      },
      {
        title: 'Keep moving forward',
        description:
          'Follow new tools as they arrive and learn how they fit into your workflow. Visit Shopify’s release notes for availability and product details.',
      },
    ],
    related: ['spring2026', 'sidekick', 'testAndLaunch'],
  },
  spring2026: {
    path: '/editions/spring2026',
    image: 'editions-spring2026',
    label: 'Spring 2026 Edition',
    title: 'Commerce. Everywhere.',
    theme: 'purple',
    description:
      'Explore a new season of tools for your business. Build with AI, reach shoppers in more places, and bring the work of commerce together.',
    features: [
      {
        id: 'agentic-storefronts',
        title: 'Agentic Storefronts',
        description:
          'Bring your products into AI shopping experiences with connected catalog data and checkout. Explore new surfaces without separating your business.',
      },
      {
        id: 'campaign-autopilot',
        title: 'Campaign Autopilot',
        description:
          'Explore new help for planning and running marketing campaigns. Bring customer knowledge and campaign tools closer together.',
      },
      {
        id: 'shopify-ai-toolkit-for-devs',
        title: 'Shopify AI Toolkit for devs',
        description:
          'Build commerce tools with resources designed for AI development workflows. Explore the APIs, documentation, and developer tools on Shopify.dev.',
      },
    ],
    related: ['agenticStorefronts', 'marketing', 'ucp'],
  },
} as const

export const pages = pageContent satisfies Record<keyof typeof pageContent, MarketingPage>

export const pageSummaries: Record<PageName, PageSummary> = { ...pages, ...routePages }

export const pagePaths = [
  routes.home.href(),
  ...Object.values(pageSummaries).map((page) => page.path),
  routes.sitemap.href(),
]

export const signupHref = 'https://admin.shopify.com/signup'
