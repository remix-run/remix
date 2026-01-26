import { hydrate, createHydrationRoot, type Handle, type RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'

////////////////////////////////////////////////////////////////////////////////
// SVG Placeholder Images
////////////////////////////////////////////////////////////////////////////////

function PlaceholderImage() {
  return (props: { seed: number; width?: number; height?: number }) => {
    let { seed, width = 400, height = 400 } = props
    // Generate deterministic colors based on seed
    let hue1 = (seed * 137) % 360
    let hue2 = (seed * 97 + 180) % 360
    let shapes = (seed % 4) + 2

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        css={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <defs>
          <linearGradient id={`grad-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: `hsl(${hue1}, 70%, 60%)` }} />
            <stop offset="100%" style={{ stopColor: `hsl(${hue2}, 70%, 40%)` }} />
          </linearGradient>
          <radialGradient id={`radial-${seed}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" style={{ stopColor: `hsl(${hue1}, 80%, 70%)` }} />
            <stop offset="100%" style={{ stopColor: `hsl(${hue2}, 60%, 30%)` }} />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill={`url(#grad-${seed})`} />
        {Array.from({ length: shapes }, (_, i) => {
          let cx = ((i + 1) * width) / (shapes + 1)
          let cy = height / 2 + ((i % 2 === 0 ? -1 : 1) * height) / 6
          let r = Math.min(width, height) / (4 + (i % 3))
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill={`url(#radial-${seed})`} opacity={0.6} />
          )
        })}
        <polygon
          points={`${width / 2},${height * 0.2} ${width * 0.8},${height * 0.8} ${width * 0.2},${height * 0.8}`}
          fill="rgba(255,255,255,0.1)"
        />
      </svg>
    )
  }
}

////////////////////////////////////////////////////////////////////////////////
// Image Gallery Carousel (Hydrated Component)
////////////////////////////////////////////////////////////////////////////////

let ImageGallery = hydrate(
  '/gallery.js#ImageGallery',
  (handle: Handle, setup: { images: number[]; title: string }) => {
    let currentIndex = 0

    function goTo(index: number) {
      currentIndex = index
      handle.update()
    }

    function next() {
      goTo((currentIndex + 1) % setup.images.length)
    }

    function prev() {
      goTo((currentIndex - 1 + setup.images.length) % setup.images.length)
    }

    return () => (
      <div
        css={{
          position: 'relative',
          borderRadius: '12px',
          overflow: 'hidden',
          backgroundColor: '#f0f0f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        }}
      >
        <div
          css={{
            position: 'relative',
            aspectRatio: '4/3',
            overflow: 'hidden',
          }}
        >
          <div
            css={{
              display: 'flex',
              transition: 'transform 0.3s ease-in-out',
              height: '100%',
            }}
            style={{
              transform: `translateX(-${currentIndex * 100}%)`,
            }}
          >
            {setup.images.map((seed, i) => (
              <div
                key={i}
                css={{
                  flexShrink: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                <PlaceholderImage seed={seed} />
              </div>
            ))}
          </div>
        </div>

        {/* Navigation arrows */}
        <button
          css={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.9)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'background-color 0.2s, transform 0.2s',
            '&:hover': {
              backgroundColor: '#fff',
              transform: 'translateY(-50%) scale(1.1)',
            },
            '&:active': {
              transform: 'translateY(-50%) scale(0.95)',
            },
          }}
          on={{ click: prev }}
        >
          ‹
        </button>
        <button
          css={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.9)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'background-color 0.2s, transform 0.2s',
            '&:hover': {
              backgroundColor: '#fff',
              transform: 'translateY(-50%) scale(1.1)',
            },
            '&:active': {
              transform: 'translateY(-50%) scale(0.95)',
            },
          }}
          on={{ click: next }}
        >
          ›
        </button>

        {/* Dot indicators */}
        <div
          css={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
          }}
        >
          {setup.images.map((_, i) => (
            <button
              key={i}
              css={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.2s, transform 0.2s',
                '&:hover': {
                  transform: 'scale(1.2)',
                },
              }}
              style={{
                backgroundColor: i === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
              on={{ click: () => goTo(i) }}
            />
          ))}
        </div>
      </div>
    )
  },
)

////////////////////////////////////////////////////////////////////////////////
// Static Components
////////////////////////////////////////////////////////////////////////////////

function Header() {
  return () => (
    <header
      css={{
        backgroundColor: '#1a1a2e',
        color: '#fff',
        padding: '0',
      }}
    >
      <div
        css={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          css={{
            fontSize: '24px',
            fontWeight: 'bold',
            letterSpacing: '-0.5px',
          }}
        >
          ✦ AURORA
        </div>
        <nav
          css={{
            display: 'flex',
            gap: '32px',
            '& a': {
              color: '#fff',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
              opacity: 0.8,
              transition: 'opacity 0.2s',
              '&:hover': {
                opacity: 1,
              },
            },
          }}
        >
          <a href="#">Home</a>
          <a href="#">Shop</a>
          <a href="#">Collections</a>
          <a href="#">About</a>
        </nav>
        <div
          css={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <span css={{ cursor: 'pointer', opacity: 0.8 }}>🔍</span>
          <span css={{ cursor: 'pointer', opacity: 0.8 }}>♡</span>
          <span css={{ cursor: 'pointer', opacity: 0.8 }}>🛒</span>
        </div>
      </div>
    </header>
  )
}

function HeroBanner() {
  return () => (
    <section
      css={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff',
        padding: '80px 24px',
        textAlign: 'center',
      }}
    >
      <div css={{ maxWidth: '800px', margin: '0 auto' }}>
        <p
          css={{
            fontSize: '14px',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            marginBottom: '16px',
            opacity: 0.9,
          }}
        >
          New Collection 2026
        </p>
        <h1
          css={{
            fontSize: '48px',
            fontWeight: '700',
            marginBottom: '24px',
            lineHeight: '1.2',
          }}
        >
          Discover Timeless Elegance
        </h1>
        <p
          css={{
            fontSize: '18px',
            marginBottom: '32px',
            opacity: 0.9,
            lineHeight: '1.6',
          }}
        >
          Explore our curated selection of premium products designed to elevate your lifestyle.
        </p>
        <a
          href="#"
          css={{
            display: 'inline-block',
            backgroundColor: '#fff',
            color: '#764ba2',
            padding: '16px 48px',
            borderRadius: '30px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '16px',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
            },
          }}
        >
          Shop Now
        </a>
      </div>
    </section>
  )
}

function ProductCard() {
  return (props: {
    title: string
    price: string
    originalPrice?: string
    images: number[]
    badge?: string
  }) => (
    <article
      css={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'transform 0.3s, box-shadow 0.3s',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
        },
      }}
    >
      <div css={{ position: 'relative' }}>
        {props.badge && (
          <span
            css={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              backgroundColor: props.badge === 'Sale' ? '#e74c3c' : '#27ae60',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              zIndex: 10,
            }}
          >
            {props.badge}
          </span>
        )}
        <ImageGallery setup={{ images: props.images, title: props.title }} />
      </div>
      <div css={{ padding: '20px' }}>
        <h3
          css={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '8px',
            color: '#1a1a2e',
          }}
        >
          {props.title}
        </h3>
        <div css={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            css={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#764ba2',
            }}
          >
            {props.price}
          </span>
          {props.originalPrice && (
            <span
              css={{
                fontSize: '16px',
                color: '#999',
                textDecoration: 'line-through',
              }}
            >
              {props.originalPrice}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

function FeaturedProducts() {
  return () => (
    <section css={{ padding: '80px 24px', backgroundColor: '#f8f9fa' }}>
      <div css={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div css={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2
            css={{
              fontSize: '36px',
              fontWeight: '700',
              color: '#1a1a2e',
              marginBottom: '16px',
            }}
          >
            Featured Products
          </h2>
          <p css={{ fontSize: '16px', color: '#666', maxWidth: '600px', margin: '0 auto' }}>
            Handpicked favorites from our latest collection. Each piece tells a story.
          </p>
        </div>
        <div
          css={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '32px',
          }}
        >
          <ProductCard
            title="Celestial Pendant"
            price="$249"
            originalPrice="$349"
            images={[101, 102, 103, 104]}
            badge="Sale"
          />
          <ProductCard title="Moonstone Ring" price="$189" images={[201, 202, 203]} badge="New" />
          <ProductCard title="Aurora Earrings" price="$159" images={[301, 302, 303, 304, 305]} />
          <ProductCard
            title="Starlight Bracelet"
            price="$219"
            originalPrice="$279"
            images={[401, 402]}
            badge="Sale"
          />
        </div>
      </div>
    </section>
  )
}

function CategoryShowcase() {
  return () => (
    <section css={{ padding: '80px 24px', backgroundColor: '#fff' }}>
      <div css={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h2
          css={{
            fontSize: '36px',
            fontWeight: '700',
            color: '#1a1a2e',
            marginBottom: '48px',
            textAlign: 'center',
          }}
        >
          Shop by Category
        </h2>
        <div
          css={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
            '@media (max-width: 768px)': {
              gridTemplateColumns: '1fr',
            },
          }}
        >
          {[
            { name: 'Necklaces', seed: 501, count: '48 items' },
            { name: 'Rings', seed: 502, count: '36 items' },
            { name: 'Earrings', seed: 503, count: '52 items' },
          ].map((cat) => (
            <a
              key={cat.name}
              href="#"
              css={{
                position: 'relative',
                borderRadius: '16px',
                overflow: 'hidden',
                aspectRatio: '4/3',
                display: 'block',
                textDecoration: 'none',
                '&:hover': {
                  '& .overlay': {
                    backgroundColor: 'rgba(26, 26, 46, 0.6)',
                  },
                },
              }}
            >
              <PlaceholderImage seed={cat.seed} />
              <div
                className="overlay"
                css={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(26, 26, 46, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  transition: 'background-color 0.3s',
                }}
              >
                <h3 css={{ fontSize: '28px', fontWeight: '700', marginBottom: '8px' }}>
                  {cat.name}
                </h3>
                <p css={{ fontSize: '14px', opacity: 0.9 }}>{cat.count}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  return () => (
    <section
      css={{
        padding: '80px 24px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        color: '#fff',
      }}
    >
      <div css={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <h2 css={{ fontSize: '36px', fontWeight: '700', marginBottom: '48px' }}>
          What Our Customers Say
        </h2>
        <div
          css={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '32px',
          }}
        >
          {[
            {
              text: "Absolutely stunning pieces! The quality exceeded my expectations. I've received so many compliments.",
              author: 'Sarah M.',
              role: 'Verified Buyer',
            },
            {
              text: 'The customer service was exceptional, and my order arrived beautifully packaged. Will definitely shop again!',
              author: 'James L.',
              role: 'Verified Buyer',
            },
            {
              text: "Every piece tells a story. I'm obsessed with my new collection. The craftsmanship is impeccable.",
              author: 'Emma R.',
              role: 'Verified Buyer',
            },
          ].map((t) => (
            <div
              key={t.author}
              css={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                padding: '32px',
                borderRadius: '16px',
                textAlign: 'left',
              }}
            >
              <div css={{ fontSize: '24px', marginBottom: '16px', opacity: 0.5 }}>"</div>
              <p css={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '24px', opacity: 0.9 }}>
                {t.text}
              </p>
              <div>
                <p css={{ fontWeight: '600', marginBottom: '4px' }}>{t.author}</p>
                <p css={{ fontSize: '14px', opacity: 0.7 }}>{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Newsletter() {
  return () => (
    <section css={{ padding: '80px 24px', backgroundColor: '#f8f9fa' }}>
      <div
        css={{
          maxWidth: '600px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <h2
          css={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#1a1a2e',
            marginBottom: '16px',
          }}
        >
          Stay in the Loop
        </h2>
        <p css={{ fontSize: '16px', color: '#666', marginBottom: '32px' }}>
          Subscribe to receive updates on new arrivals, special offers, and exclusive events.
        </p>
        <div css={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <input
            type="email"
            placeholder="Enter your email"
            css={{
              padding: '16px 24px',
              borderRadius: '30px',
              border: '1px solid #ddd',
              fontSize: '16px',
              width: '300px',
              outline: 'none',
              transition: 'border-color 0.2s',
              '&:focus': {
                borderColor: '#764ba2',
              },
            }}
          />
          <button
            css={{
              padding: '16px 32px',
              borderRadius: '30px',
              backgroundColor: '#764ba2',
              color: '#fff',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s, transform 0.2s',
              '&:hover': {
                backgroundColor: '#5a3d7a',
                transform: 'translateY(-2px)',
              },
            }}
          >
            Subscribe
          </button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return () => (
    <footer css={{ backgroundColor: '#1a1a2e', color: '#fff', padding: '64px 24px 32px' }}>
      <div css={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div
          css={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '48px',
            marginBottom: '48px',
          }}
        >
          <div>
            <div css={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>✦ AURORA</div>
            <p css={{ fontSize: '14px', opacity: 0.7, lineHeight: '1.8' }}>
              Crafting timeless elegance since 2018. Every piece is designed with passion and
              precision.
            </p>
          </div>
          <div>
            <h4 css={{ fontWeight: '600', marginBottom: '20px' }}>Shop</h4>
            <div
              css={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                '& a': {
                  color: '#fff',
                  textDecoration: 'none',
                  opacity: 0.7,
                  fontSize: '14px',
                  '&:hover': { opacity: 1 },
                },
              }}
            >
              <a href="#">New Arrivals</a>
              <a href="#">Best Sellers</a>
              <a href="#">Sale</a>
              <a href="#">Gift Cards</a>
            </div>
          </div>
          <div>
            <h4 css={{ fontWeight: '600', marginBottom: '20px' }}>Support</h4>
            <div
              css={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                '& a': {
                  color: '#fff',
                  textDecoration: 'none',
                  opacity: 0.7,
                  fontSize: '14px',
                  '&:hover': { opacity: 1 },
                },
              }}
            >
              <a href="#">Contact Us</a>
              <a href="#">FAQs</a>
              <a href="#">Shipping</a>
              <a href="#">Returns</a>
            </div>
          </div>
          <div>
            <h4 css={{ fontWeight: '600', marginBottom: '20px' }}>Follow Us</h4>
            <div css={{ display: 'flex', gap: '16px' }}>
              {['Instagram', 'Pinterest', 'Twitter'].map((social) => (
                <a
                  key={social}
                  href="#"
                  css={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.2s',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.2)',
                    },
                  }}
                >
                  <span css={{ fontSize: '14px' }}>{social[0]}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div
          css={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            paddingTop: '24px',
            textAlign: 'center',
            fontSize: '14px',
            opacity: 0.5,
          }}
        >
          © 2026 Aurora. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

////////////////////////////////////////////////////////////////////////////////
// App
////////////////////////////////////////////////////////////////////////////////

function App() {
  return () => (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Aurora - Elegant Jewelry</title>
        <style>
          {`* { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; }`}
        </style>
      </head>
      <body>
        <Header />
        <HeroBanner />
        <FeaturedProducts />
        <CategoryShowcase />
        <Testimonials />
        <Newsletter />
        <Footer />
      </body>
    </html>
  )
}

////////////////////////////////////////////////////////////////////////////////
// Browser document simulation
////////////////////////////////////////////////////////////////////////////////

// Module registry for the demo (simulates what a browser would request)
let modules: Record<string, Record<string, Function>> = {
  '/gallery.js': { ImageGallery },
}

// Server-side render
let stream = renderToStream(<App />)
let reader = stream.getReader()
let decoder = new TextDecoder()

async function write() {
  while (true) {
    let { done, value } = await reader.read()
    if (done) break
    document.write(decoder.decode(value, { stream: true }))
  }
  document.close()

  // Client-side hydration
  let root = createHydrationRoot({
    loadModule: (moduleUrl, exportName) => {
      let mod = modules[moduleUrl]
      if (!mod) throw new Error(`Module not found: ${moduleUrl}`)
      let component = mod[exportName]
      if (!component) throw new Error(`Export not found: ${exportName} in ${moduleUrl}`)
      return component
    },
  })

  // Listen for errors from hydrated components
  root.addEventListener('error', (event) => {
    console.error('Component error:', event.error)
  })

  await root.ready
  root.flush()

  console.log('Hydration complete! Click the carousel arrows to test interactivity.')
}

document.open()
write()
