// Shopify's original images, served from Shopify's CDN. The CDN resizes each image to the
// requested `width` and returns the best format the browser accepts.
const cdn = 'https://cdn.shopify.com/b/shopify-brochure2-assets'

interface Image {
  src: string
  width: number
  height: number
  srcSet: string
}

function cdnImage(source: string, width: number, height: number): Image {
  let widths = [...new Set([400, 800, width])].filter((size) => size <= width)
  return {
    src: resize(source, width),
    width,
    height,
    srcSet: widths.map((size) => `${resize(source, size)} ${size}w`).join(', '),
  }
}

function resize(source: string, width: number) {
  let url = new URL(source)
  url.searchParams.set('width', String(width))
  return url.href
}

export const images = {
  'agentic-storefronts': cdnImage(`${cdn}/ce093c64df355191bbf22ceaf700fd63.png`, 1200, 676),
  analytics: cdnImage(`${cdn}/5b55ecc4d7274bd6f92fccec2d9032ec.png`, 680, 378),
  apps: cdnImage(`${cdn}/9354c77a37ba8e717fcc86cb4bbd366b.jpg`, 1200, 343),
  channels: cdnImage(`${cdn}/c5977fa7a5b6bb47fa536e8e0ffcf93c.png`, 1022, 802),
  checkout: cdnImage(`${cdn}/10f684ef2ec274589896b6f50313df54.png`, 1200, 1219),
  'customer-accounts': cdnImage(`${cdn}/4d63fb81617ed84450d6e0ff2ad1e463.png`, 1200, 675),
  developer: cdnImage(`${cdn}/988b6738089b476b12bb11624047cbee.png`, 1100, 713),
  discounts: cdnImage(`${cdn}/411506f8159cb2d1caa63a3ad1b46e4a.png`, 1200, 899),
  domains: cdnImage(`${cdn}/e3e25d3c9783e5a5504884b297ad4563.png`, 1200, 900),
  'editions-spring2026': cdnImage(
    'https://cdn.shopify.com/s/files/1/0647/5176/3550/files/0_9e0dee50-935d-4ed6-9902-5806efb9c803.png',
    800,
    600,
  ),
  enterprise: cdnImage(`${cdn}/9ff5b4d8a2c975f6144f27fc17eb997c.png`, 606, 616),
  finance: cdnImage(`${cdn}/b4b8fbd80ba0aa6d64309e3a9b3168f9.png`, 1200, 905),
  flow: cdnImage(`${cdn}/945dce06a6642cfe8caca3ff0366074a.png`, 1200, 1126),
  'global-customer-1': cdnImage(`${cdn}/966c4fe15bc05cfe25422b7c25e981ec.jpg`, 600, 668),
  'global-customer-2': cdnImage(`${cdn}/b5695aa84d13d681040a1f792102db4c.jpg`, 600, 668),
  'global-customer-3': cdnImage(`${cdn}/8c2c23882c250ec4a2b9e4e8bb2db7ed.jpg`, 600, 668),
  hero: cdnImage(`${cdn}/7ecd57f2fa3d7b997d29181a62c954ee.png`, 1600, 900),
  international: cdnImage(`${cdn}/77a4e09f891328854a1c923cb1cece42.png`, 1200, 1200),
  marketing: cdnImage(`${cdn}/31bbc41734e3b4780f6aa1bc01a3de89.png`, 1200, 800),
  'marketing-automation-tools': cdnImage(`${cdn}/416389b737f8581ebbd00ab1b79c1ca6.png`, 762, 643),
  markets: cdnImage(`${cdn}/3b04a0eb77b3f64a5f90673f9e4afad7.png`, 1200, 842),
  'merchant-1': cdnImage(`${cdn}/009e0d56f84770923ca3b27f2316b73b.jpg`, 575, 794),
  'merchant-2': cdnImage(`${cdn}/a4cb30be10c7967c08f80b935611b0b7.jpg`, 575, 745),
  online: cdnImage(`${cdn}/aba5196fc613f603baa20fe0f084acde.jpg`, 804, 1184),
  orders: cdnImage(`${cdn}/f2758f3e9b5f6e88b3af504f76c4d1f8.png`, 1200, 1273),
  payments: cdnImage(`${cdn}/82b7b46faeee8fde5457d560ca705037.webp`, 1200, 1200),
  pos: cdnImage(`${cdn}/3962318ef2dc919f97b289f4c0dc9c88.png`, 1200, 1201),
  shipping: cdnImage(`${cdn}/4b3b80eb1ba97834730e2835b525124b.webp`, 1200, 1020),
  shop: cdnImage(`${cdn}/fcf1fc0dd56c4a40d998a52417b36d2b.webp`, 1200, 623),
  sidekick: cdnImage(`${cdn}/cdfbaa1d9eb8bf92181a8092beb2ee09.jpg`, 1200, 674),
  'solutions-b2b-enterprise': cdnImage(`${cdn}/73c03f454eff3abe3013bbbbc9b82501.png`, 1104, 976),
  start: cdnImage(`${cdn}/618ba91a354f3033d9d04662c04ecf21.webp`, 1080, 1080),
  tax: cdnImage(`${cdn}/8b158b82d1c65c98c9d1579882be608d.webp`, 1200, 1200),
  'test-and-launch': cdnImage(`${cdn}/0e4749c13d1a684eda6a75a08737f620.png`, 1200, 1200),
  ucp: cdnImage(`${cdn}/db9af8377adacf9cc8da9476b0a3d500.png`, 900, 850),
  'website-builder': cdnImage(`${cdn}/232e7b80cc2df198eeeb585115da38a6.webp`, 1112, 352),
  'home-agentic-poster': cdnImage(
    `${cdn}/59ee2f1c4ee7318b33100d4bf6685cca.png?originalWidth=2090&originalHeight=1742`,
    1000,
    833,
  ),
  'home-store-poster': cdnImage(
    `${cdn}/b02da22517fcaf8e9d890e161ca6a728.webp?originalWidth=1134&originalHeight=680`,
    760,
    456,
  ),
  'home-global-poster': cdnImage(
    `${cdn}/44ab4e3257a89ca32bf4f6c3d03bd1a3.png?originalWidth=1248&originalHeight=1350`,
    1248,
    1350,
  ),
  'home-globe-poster': cdnImage(
    `${cdn}/4e78c1f8f5e17fc3a04ead5484597c46.png?originalWidth=2394&originalHeight=2084`,
    800,
    696,
  ),
  'home-sidekick-reduced': cdnImage(
    `${cdn}/2224e4228644fed814772cc9eaaa0439.jpg?originalWidth=2016&originalHeight=872`,
    2016,
    872,
  ),
  'testimonial-poster': cdnImage(
    `${cdn}/dfe835af574cb7911fd32056d3de0d7c.jpg?originalWidth=930&originalHeight=828`,
    930,
    828,
  ),
  'agentic-chats-poster': cdnImage(`${cdn}/ce093c64df355191bbf22ceaf700fd63.png`, 1236, 696),
  'agentic-ready-poster': cdnImage(`${cdn}/4d748679f52e3b918e40a9ebf7952cd0.png`, 1236, 696),
  'agentic-checkout-poster': cdnImage(`${cdn}/005a27aa99a4d755b069d184ea5289de.png`, 1236, 696),
  'agentic-data-poster': cdnImage(`${cdn}/7c289e31d0a312b40df278b64451765d.png`, 1236, 696),
  'home-guests-on-earth': cdnImage(
    `${cdn}/a420720ef25dc8a2fe3a9331c68ef6a9.jpg?originalWidth=916&originalHeight=600`,
    916,
    600,
  ),
  'home-our-place': cdnImage(
    `${cdn}/f857190a577f2873635fe3e045dec233.png?originalWidth=916&originalHeight=600`,
    916,
    600,
  ),
  'home-mattel': cdnImage(
    `${cdn}/5b31b5b8788c835cd8560ccba12fb086.jpg?originalWidth=914&originalHeight=600`,
    914,
    600,
  ),
  'agentic-admin-1': cdnImage(
    `${cdn}/214b4e5146f1559df2faa174785d2c65.webp?originalWidth=2175&originalHeight=1800&quality=90`,
    2175,
    1800,
  ),
  'agentic-admin-2': cdnImage(
    `${cdn}/62a52019899cb2009610818e14ac5453.webp?originalWidth=2175&originalHeight=1800&quality=90`,
    2175,
    1800,
  ),
  'agentic-admin-3': cdnImage(
    `${cdn}/fc65fc0abd97305555b85f791937b225.webp?originalWidth=2175&originalHeight=1800&quality=90`,
    2175,
    1800,
  ),
  'agentic-monos': cdnImage(`${cdn}/695aa2bcefeebdf61cb7578e4d627801.webp`, 808, 808),
  'agentic-steve-madden': cdnImage(`${cdn}/25fb508f24ec07a820c8f9a71574bfab.webp`, 808, 808),
}

export type ImageName = keyof typeof images

export const logos = {
  'shop-pay': `${cdn}/2fd05c36a60e97081de65d1568eb7ec0.svg`,
  openai: `${cdn}/2b976bfeb8021b8c32df464738f19e65.svg`,
  google: `${cdn}/8d9998fd3bb63e7115fc5e5ab67524fe.svg`,
  microsoft: `${cdn}/8ec8e9a50e589dd2cc13318df171868b.svg`,
  meta: `${cdn}/395d5e486c18a00c64c557f661a08f2c.svg`,
}
