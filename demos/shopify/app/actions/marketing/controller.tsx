import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { ProductTemplate } from './product-template.tsx'

// This is a deliberately fat controller. On shopify.com, every marketing page has its own layout,
// so a production app would give each action its own page module (for example `checkout-page.tsx`)
// that composes shared sections with that page's content. For this proof of concept, every page
// renders the same ProductTemplate with simplified copy, so each action passes its page's content
// inline instead of adding 29 page modules that would only wrap the template. The trade-off is a
// long file. Each page still has its own route and action, so building one out only means moving
// its action's markup into a page module.
export default createController(routes.marketing, {
  actions: {
    start({ render }) {
      return render(
        <ProductTemplate
          name="start"
          title="Start today. Build your tomorrow."
          image="start"
          features={[
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
          ]}
          related={['websiteBuilder', 'payments', 'pricing']}
        />,
      )
    },
    sell({ render }) {
      return render(
        <ProductTemplate
          name="sell"
          title="More bang, less buck."
          image="online"
          features={[
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
          ]}
          related={['channels', 'checkout', 'enterprise']}
        />,
      )
    },
    enterprise({ render }) {
      return render(
        <ProductTemplate
          name="enterprise"
          title="Enterprise commerce without compromise"
          image="enterprise"
          features={[
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
          ]}
          related={['b2bEnterprise', 'markets', 'checkout']}
        />,
      )
    },
    checkout({ render }) {
      return render(
        <ProductTemplate
          name="checkout"
          title="Shopify Checkout"
          image="checkout"
          features={[
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
          ]}
          related={['payments', 'shop', 'discounts']}
        />,
      )
    },
    sidekick({ render }) {
      return render(
        <ProductTemplate
          name="sidekick"
          title="Starting a business? You’ve got backup."
          image="sidekick"
          features={[
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
          ]}
          related={['start', 'websiteBuilder', 'analytics']}
        />,
      )
    },
    websiteBuilder({ render }) {
      return render(
        <ProductTemplate
          name="websiteBuilder"
          title="Your idea. Your website. Your way."
          image="website-builder"
          features={[
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
          ]}
          related={['domains', 'online', 'sidekick']}
        />,
      )
    },
    domains({ render }) {
      return render(
        <ProductTemplate
          name="domains"
          title="Set up shop with the perfect domain"
          image="domains"
          features={[
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
          ]}
          related={['websiteBuilder', 'start', 'international']}
        />,
      )
    },
    customerAccounts({ render }) {
      return render(
        <ProductTemplate
          name="customerAccounts"
          title="A little more personal. A lot more useful."
          image="customer-accounts"
          features={[
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
          ]}
          related={['checkout', 'orders', 'marketingAutomationTools']}
        />,
      )
    },
    online({ render }) {
      return render(
        <ProductTemplate
          name="online"
          title="Build a store worth coming back to."
          image="online"
          features={[
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
          ]}
          related={['websiteBuilder', 'checkout', 'analytics']}
        />,
      )
    },
    pos({ render }) {
      return render(
        <ProductTemplate
          name="pos"
          title="Great in store. Connected everywhere."
          image="pos"
          features={[
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
          ]}
          related={['payments', 'orders', 'markets']}
        />,
      )
    },
    shop({ render }) {
      return render(
        <ProductTemplate
          name="shop"
          title="Reach the world’s best Shoppers"
          image="shop"
          features={[
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
          ]}
          related={['checkout', 'marketing', 'channels']}
        />,
      )
    },
    channels({ render }) {
      return render(
        <ProductTemplate
          name="channels"
          title="Be where your customers are."
          image="channels"
          features={[
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
          ]}
          related={['marketing', 'shop', 'agenticStorefronts']}
        />,
      )
    },
    international({ render }) {
      return render(
        <ProductTemplate
          name="international"
          title="Grow around the globe"
          image="international"
          features={[
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
          ]}
          related={['markets', 'shipping', 'payments']}
        />,
      )
    },
    b2bEnterprise({ render }) {
      return render(
        <ProductTemplate
          name="b2bEnterprise"
          title="Wholesale, with a whole new outlook."
          image="solutions-b2b-enterprise"
          features={[
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
          ]}
          related={['enterprise', 'customerAccounts', 'flow']}
        />,
      )
    },
    markets({ render }) {
      return render(
        <ProductTemplate
          name="markets"
          title="One store. So many possibilities."
          image="markets"
          features={[
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
          ]}
          related={['international', 'b2bEnterprise', 'analytics']}
        />,
      )
    },
    marketing({ render }) {
      return render(
        <ProductTemplate
          name="marketing"
          title="Bring your next customer closer."
          image="marketing"
          features={[
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
          ]}
          related={['marketingAutomationTools', 'analytics', 'channels']}
        />,
      )
    },
    marketingAutomationTools({ render }) {
      return render(
        <ProductTemplate
          name="marketingAutomationTools"
          title="Good timing. Better connections."
          image="marketing-automation-tools"
          features={[
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
          ]}
          related={['marketing', 'customerAccounts', 'flow']}
        />,
      )
    },
    discounts({ render }) {
      return render(
        <ProductTemplate
          name="discounts"
          title="Give shoppers a reason to say yes."
          image="discounts"
          features={[
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
          ]}
          related={['checkout', 'marketing', 'analytics']}
        />,
      )
    },
    analytics({ render }) {
      return render(
        <ProductTemplate
          name="analytics"
          title="Know your business. Find your next move."
          image="analytics"
          features={[
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
          ]}
          related={['marketing', 'markets', 'sidekick']}
        />,
      )
    },
    testAndLaunch({ render }) {
      return render(
        <ProductTemplate
          name="testAndLaunch"
          title="Make every change count"
          image="test-and-launch"
          features={[
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
          ]}
          related={['online', 'analytics', 'spring2026']}
        />,
      )
    },
    orders({ render }) {
      return render(
        <ProductTemplate
          name="orders"
          title="From order placed to order delivered."
          image="orders"
          features={[
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
          ]}
          related={['shipping', 'pos', 'flow']}
        />,
      )
    },
    shipping({ render }) {
      return render(
        <ProductTemplate
          name="shipping"
          title="Shipping, included"
          image="shipping"
          features={[
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
          ]}
          related={['orders', 'international', 'checkout']}
        />,
      )
    },
    finance({ render }) {
      return render(
        <ProductTemplate
          name="finance"
          title="Put your money where your business is"
          image="finance"
          features={[
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
          ]}
          related={['payments', 'analytics', 'enterprise']}
        />,
      )
    },
    flow({ render }) {
      return render(
        <ProductTemplate
          name="flow"
          title="Less busywork. More possibility."
          image="flow"
          features={[
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
          ]}
          related={['orders', 'marketingAutomationTools', 'sidekick']}
        />,
      )
    },
    payments({ render }) {
      return render(
        <ProductTemplate
          name="payments"
          title="Accept payments. Expect growth."
          image="payments"
          features={[
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
          ]}
          related={['checkout', 'finance', 'international']}
        />,
      )
    },
    tax({ render }) {
      return render(
        <ProductTemplate
          name="tax"
          title="A clearer path through sales tax."
          image="tax"
          features={[
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
          ]}
          related={['international', 'orders', 'finance']}
        />,
      )
    },
    ucp({ render }) {
      return render(
        <ProductTemplate
          name="ucp"
          title="Universal Commerce Protocol"
          image="ucp"
          features={[
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
          ]}
          related={['agenticStorefronts', 'checkout', 'spring2026']}
        />,
      )
    },
    editions({ render }) {
      return render(
        <ProductTemplate
          name="editions"
          title="Big ideas. New possibilities."
          image="editions-spring2026"
          features={[
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
          ]}
          related={['spring2026', 'sidekick', 'testAndLaunch']}
        />,
      )
    },
    spring2026({ render }) {
      return render(
        <ProductTemplate
          name="spring2026"
          title="Commerce. Everywhere."
          image="editions-spring2026"
          features={[
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
          ]}
          related={['agenticStorefronts', 'marketing', 'ucp']}
        />,
      )
    },
  },
})
